"""Draws ONE reel (vertical 1080x1920 mp4) from a plan made by /api/cron/reels?op=prepare.
A picture per scene (slow zoom), the text on white strips with a coloured outline, line by line in step with the voice,
a soft siren under hospital / ambulance scenes, the voice-over with a waveform, source credit and the Pak Dharti logo. Needs: ffmpeg, playwright (chromium), pillow, numpy, requests.
Usage: python scripts/reels/render.py plan.json out.mp4      (a picture that is a local path also works, for tests)"""
import asyncio, base64, html, json, os, re, subprocess, sys, wave
import numpy as np, requests
from PIL import Image, ImageDraw, ImageOps, ImageFilter
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
W, H, FPS = 1080, 1920, 30
import time as _time
_T0 = _time.time()
def T(label): print(f"[time] {label}: {_time.time() - _T0:.0f}s", flush=True)
plan = json.load(open(sys.argv[1])); OUT = os.path.abspath(sys.argv[2])
WORK = os.path.abspath(os.environ.get("REEL_WORK", "reel_work")); os.makedirs(WORK, exist_ok=True)

def b64(path, mime): return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()
FONTS = {"jameel": "jameel-noori-nastaleeq.woff2", "alvi": "urdu/AlviLahoriNastaleeq.woff2", "nafees": "urdu/Nafees-Nastaleeq.woff",
         "hussaini": "urdu/HussainiNastaleeq.woff2", "pak": "urdu/PakNastaleeq.woff2", "khushkhati": "urdu/jameel-khushkhati.woff2"}
FFILE = FONTS.get(plan.get("font"), FONTS["jameel"])
FONT = b64(os.path.join(ROOT, "public/fonts", FFILE), "font/woff2" if FFILE.endswith("woff2") else "font/woff")
BGA = min(1.0, max(0.2, float(plan.get("bgAlpha") or 100) / 100))
STROKE = {"r": "#7a0000", "k": "#000000"}.get(plan.get("stroke"), "#7a0000")
COL = {"k": "#ffffff", "r": "#ff8f8f", "b": "#9cc3ff", "g": "#8fe6ab"}   # text colours on the dark caption box
POPPINS = b64(os.path.join(ROOT, "public/fonts/latin/Poppins-Bold.ttf"), "font/ttf")
LOGO = b64(os.path.join(ROOT, "public/brand/logo.png"), "image/png")

def fetch(url, dest):
    if not url: return None
    try:
        if re.match(r"https?://", url):
            r = requests.get(url, timeout=60, headers={"User-Agent": "PakDhartiTV-reels/1.0 (+https://www.pakdhartitv.com)"})
            if r.status_code in (400, 403) and "pixabay.com" in url:   # Pixabay sometimes refuses a plain download: ask again like a browser that comes from their site
                r = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "Referer": "https://pixabay.com/"})
            r.raise_for_status()
            open(dest, "wb").write(r.content)
        else:
            open(dest, "wb").write(open(url, "rb").read())
        Image.open(dest).verify(); return dest
    except Exception as e:
        print("picture skipped:", str(e)[:100]); return None

# ---- voice
vpath = os.path.join(WORK, "voice.wav")
fetch_ok = False
u = plan["audioUrl"]
if re.match(r"https?://", u):
    for _try in range(8):          # the site sometimes answers with an error page ("different request") instead of the voice: ask again until it is a real sound file
        _r = requests.get(u, timeout=120); _c = _r.content
        if _c[:4] == b"RIFF": break
        print("voice: not a sound file (try", _try + 1, ") http", _r.status_code, _r.headers.get("content-type"), len(_c), _c[:120], u, flush=True); _time.sleep(4)
    open(vpath, "wb").write(_c)
else: open(vpath, "wb").write(open(u, "rb").read())
SPEED = float(plan.get("speed") or 1)
if abs(SPEED - 1) > 0.01:                                   # voice speed set in Mission Control > Reel voice
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", vpath, "-filter:a", f"atempo={min(2.0, max(0.5, SPEED))}", os.path.join(WORK, "voice_fast.wav")], check=True)
    vpath = os.path.join(WORK, "voice_fast.wav")
with wave.open(vpath) as w:
    VR, VN = w.getframerate(), w.getnframes(); voice = np.frombuffer(w.readframes(VN), dtype=np.int16).astype(np.float32) / 32768
INTRO = 3.0 if plan.get("column") else 0.0          # a guest column: the first 3 seconds show only the writer's credit poster, then the voice and the text start
if INTRO: voice = np.concatenate([np.zeros(int(VR * INTRO), np.float32), voice]); VN = len(voice)
VSEC = VN / VR
OFF = 0.35; TAIL = 1.4
scenes = plan["scenes"]
# ---- timing from the voice itself: pauses between sentences / phrases (silence), snapped to where the text expects them
frame = int(VR * 0.02); nfr = len(voice) // frame
rms = np.sqrt((voice[: nfr * frame].reshape(nfr, frame) ** 2).mean(axis=1)) if nfr else np.zeros(1)
thr = 0.05 * float(np.percentile(rms, 95)) if nfr else 0
sil, run = [], None
for k, v_ in enumerate(rms):
    if v_ < thr:
        run = k if run is None else run
    elif run is not None:
        if (k - run) * 0.02 >= 0.14: sil.append((((run + k) / 2) * 0.02, (k - run) * 0.02))   # (middle of the pause, how long it lasts)
        run = None
def snap(t, lo, hi, tol):
    c = [(x, l) for x, l in sil if abs(x - t) <= tol and lo < x < hi]
    return min(c, key=lambda q: abs(q[0] - t) - 1.2 * q[1])[0] if c else t     # near the expected moment, and a longer pause wins over a short breath
# first and last bit of speech: ignore leading/trailing silence
speech = [k * 0.02 for k, v_ in enumerate(rms) if v_ >= thr]; s_beg, s_end = (speech[0], speech[-1] + 0.02) if speech else (0.0, VSEC)
span = max(0.5, s_end - s_beg)
cs = [max(12, len(x["text"])) for x in scenes]; tot = sum(cs)
# The voice reads every scene as its own paragraph, so the scene ends are the LONG pauses (about 1 s). Estimating by letters alone drifts by
# a second or two (the next words then appear while the last ones are still spoken): choose, among the long pauses, the ones that fit best.
def pick_bounds(exps, pool, lims, floor, ceil, gap=0.8, P=8.0):
    """Choose one real pause of the voice for every expected boundary (increasing, at least `gap` apart); the pauses that fit best win,
    the longest ones are looked at first. Where no pause fits, the estimate is used."""
    for lim in lims:
        cand = [x for x, l in pool if l >= lim and floor < x < ceil]
        if len(cand) >= len(exps): break
    opts = [[(c, abs(c - e)) for c in cand] + [(e, P)] for e in exps]
    best = [{}]
    for k, o in enumerate(opts):
        cur = {}
        for j, (pos, cost) in enumerate(o):
            if k == 0: cur[j] = (cost, None) if pos > floor else None
            else:
                prev = [(best[k][pj][0], pj) for pj in best[k] if best[k][pj] and opts[k - 1][pj][0] + gap < pos]
                cur[j] = (min(prev)[0] + cost, min(prev)[1]) if prev else None
        best.append(cur)
    if not exps: return []
    fin = {j: v for j, v in best[len(exps)].items() if v}
    if not fin: return list(exps)
    j = min(fin, key=lambda q: fin[q][0]); out = []
    for k in range(len(exps), 0, -1):
        out.append(opts[k - 1][j][0]); j = best[k][j][1]
    return out[::-1]
# The voice reads every scene as its own paragraph, so the scene ends are the LONG pauses (about 1 s). Estimating by letters alone drifts by
# a second or two (the next words then appear while the last ones are still spoken): choose, among the long pauses, the ones that fit best.
exps = []; acc = 0
for k in range(len(scenes) - 1):
    acc += cs[k]; exps.append(s_beg + span * acc / tot)
bounds = [s_beg] + pick_bounds(exps, sil, (0.75, 0.55), s_beg + 0.8, s_end - 0.5)
bounds.append(s_end)
starts = [b_ + OFF for b_ in bounds[:-1]]
vis = [(0.0 if i == 0 else starts[i], (starts[i + 1] if i + 1 < len(scenes) else bounds[-1] + OFF + TAIL)) for i in range(len(scenes))]
TOTAL = vis[-1][1]


# ---- backgrounds: cover-crop to 4:5 taller than the frame so the slow zoom has room; fallback is a dark red gradient
def cover(path, i):
    out = os.path.join(WORK, f"bg{i}.jpg")
    cw, ch = int(W * 1.25), int(H * 1.25)
    if path:
        im = Image.open(path).convert("RGB")
        small = im.height < ch or im.width < cw
        im = ImageOps.fit(im, (cw, ch), Image.LANCZOS, centering=(0.5, 0.28))   # wide pictures: the middle part, made big; keep the top: heads must not be cut
        if small: im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))   # a small picture made big looks soft: sharpen a little
    else:
        im = Image.new("RGB", (cw, ch)); d = ImageDraw.Draw(im)
        for y in range(ch):
            t = y / ch; d.line([(0, y), (cw, y)], fill=(int(58 - 40 * t), int(14 - 9 * t), int(22 - 14 * t)))
    im.save(out, quality=90); return out
bgs = []; clipf = []
PICBND = {}      # per scene: when each picture starts (so the caption part follows its picture)
for i, s in enumerate(scenes):
    cf = None
    if s.get("clip"):                                       # the editor's own video clip for this scene
        try:
            cu = s["clip"]; cf = os.path.join(WORK, f"clip{i}.mp4")
            open(cf, "wb").write(requests.get(cu, timeout=120).content if re.match(r"https?://", cu) else open(cu, "rb").read())
        except Exception as e:
            print("clip skipped:", str(e)[:100]); cf = None
    p = None if cf else fetch(s.get("img"), os.path.join(WORK, f"src{i}"))
    extra = [] if cf else [e for e in (fetch(u, os.path.join(WORK, f"src{i}x{j}")) for j, u in enumerate((s.get("extra") or [])[:3])) if e]
    if extra and not cf:
        # several pictures in one scene: they follow each other (cut with a short dissolve), each with its own slow zoom
        pics = [cover(p, f"{i}m0")] + [cover(e, f"{i}m{j + 1}") for j, e in enumerate(extra)]
        dur_i = vis[i][1] - vis[i][0]; nw = max(1, len((s.get("text") or "").split())); k = len(pics)
        # a picture starts at the word the editor chose (default: equal parts of the line); at least 0.8 s each
        ats = [0] + [min(nw - 1, max(1, int(a))) if isinstance(a, (int, float)) else round(nw * (j + 1) / k) for j, a in enumerate((s.get("extraAt") or [])[:k - 1])]
        while len(ats) < k: ats.append(round(nw * len(ats) / k))
        # when the word is SPOKEN: share the scene's speech by the letters of its words (not by word count), then snap to a pause in the voice
        wl = [max(1, len(w)) for w in (s.get("text") or "").split()] or [1]; wt = sum(wl)
        def tword(a_):
            t_ = bounds[i] + (bounds[i + 1] - bounds[i]) * sum(wl[:a_]) / wt
            return snap(t_, bounds[i] + 0.3, bounds[i + 1] - 0.3, 0.3) + OFF - vis[i][0]
        bnd = [0.0]
        for j in range(1, k):
            bnd.append(min(dur_i - 0.8 * (k - j), max(bnd[-1] + 0.8, tword(ats[j]))))
        bnd.append(dur_i); PICBND[i] = [vis[i][0] + x for x in bnd]; parts = []
        for j, bp in enumerate(pics):
            seg = bnd[j + 1] - bnd[j]
            fo = os.path.join(WORK, f"m{i}_{j}.mp4"); fr = max(2, round((seg + 0.3) * FPS))
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", bp, "-vf", f"zoompan=z='min(zoom+0.0006,1.14)':x='iw/2-(iw/zoom/2)':y='0':d={fr}:s={W}x{H}:fps={FPS},format=yuv420p", "-frames:v", str(fr), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "17", fo], check=True)
            parts.append(fo)
        cf = os.path.join(WORK, f"multi{i}.mp4")
        ins = sum([["-i", x] for x in parts], []); n = len(parts); fc = ""; last = "0:v"
        for j in range(1, n):
            fc += f"[{last}][{j}:v]xfade=transition=fade:duration=0.2:offset={max(0.1, bnd[j] - 0.05):.2f}[x{j}];"; last = f"x{j}"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", fc.rstrip(";"), "-map", f"[{last}]", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "17", "-pix_fmt", "yuv420p", cf], check=True)
    clipf.append(cf)
    bgs.append(cover(p, i) if not cf else cover(None, i))
T("pictures prepared")

SIREN = [False for s in scenes]     # the ambulance sound is switched off (the editor did not want it)

# Look: photo with a dark tint; the text on WHITE strips with a coloured outline (red or black); the editor can colour words.
PADX, BORD = 24, 7
CPL, CPR = 34, 34     # caption box: padding left / right (the red bar on the right edge is 14 px)
CAPW, CAPR = 900, 90        # caption strips: 780 px wide (72% of the picture), centred; keeps clear of the Like/Share buttons of TikTok, Reels, Shorts
CSS_BASE = f"""@font-face{{font-family:J;src:url({FONT})}} @font-face{{font-family:P;src:url({POPPINS})}}
*{{box-sizing:border-box;margin:0}} html,body{{width:{W}px;height:{H}px;background:transparent;font-family:J,serif;color:#111;direction:rtl}}"""
CSS_STATIC = CSS_BASE + """
.tint{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,28,36,.55) 0,rgba(4,28,36,.30) 30%,rgba(4,28,36,.62) 56%,rgba(3,18,24,.9) 100%)}
.bar{position:absolute;top:26px;left:56px;right:56px;display:flex;gap:8px;direction:ltr} .bar i{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.28)} .bar i.on{background:#fff}
.band{position:absolute;left:0;right:0;bottom:0;height:130px;background:linear-gradient(180deg,#8a0000 0%,#6a0000 55%,#4c0000 100%);border-top:4px solid #fff;display:flex;align-items:center;justify-content:center;gap:16px;direction:ltr}
.badge{position:absolute;right:56px;top:96px;background:linear-gradient(180deg,#8a0000,#5a0000);color:#fff;border:3px solid #e8c15a;border-radius:10px;padding:0 26px 10px;font:60px/1.8 J,serif;direction:rtl;box-shadow:0 4px 14px rgba(0,0,0,.4)}
.cc{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.colcard{width:900px;display:flex;flex-direction:column;align-items:center;gap:18px;direction:rtl;text-align:center;background:linear-gradient(180deg,rgba(138,0,0,.96),rgba(90,0,0,.96));border:4px solid #e8c15a;border-radius:26px;padding:34px 36px 30px;box-shadow:0 10px 30px rgba(0,0,0,.55)}
.wph{width:260px;height:260px;border-radius:50%;object-fit:cover;object-position:center top;border:6px solid #e8c15a}
.colby{font:56px/1.6 J,serif;color:#f6d77a;-webkit-text-stroke:1px #f6d77a}.coltt{font:56px/1.7 J,serif;color:#fff;-webkit-text-stroke:1px #fff}
.band svg{width:58px;height:58px;flex:none;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.band svg .f{fill:#fff;stroke:none}
.band .sep{width:3px;height:48px;background:rgba(255,255,255,.55);border-radius:2px}
.band b{font:700 38px P,sans-serif;color:#fff;letter-spacing:.3px;text-shadow:0 2px 0 rgba(0,0,0,.35)}"""
CSS_TEXT = CSS_BASE + f"""
.blk{{position:absolute;left:50%;transform:translateX(-50%);width:max-content}}
.cap{{background:rgba(58,58,62,{0.8 * BGA:.3f});border-radius:22px;border-left:14px solid #e0152b;border-right:14px solid #e0152b;padding:12px {CPR}px 4px {CPL}px;direction:rtl;text-align:center}}
.ln{{white-space:nowrap;line-height:1.55;color:#fff;-webkit-text-stroke:.6px currentColor;text-shadow:0 2px 6px rgba(0,0,0,.35)}}
.nat{{position:absolute;right:{CAPR}px;top:0;width:{CAPW - CPL - CPR - 28}px;line-height:1.55;text-align:right;visibility:hidden}}"""

BAND_IMG = os.path.join(ROOT, "public/brand/reel-band.png")      # your own designed strip (1080 x 130) replaces the built-in one when this file exists
ICONS = {  # every icon: same circle, same size, same stroke; glyph inside
 "fb": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><g transform="translate(12 12) scale(.76) translate(-12 -12)" style="stroke-width:2.5"><path class="f" d="M13.3 20v-7.2h2.4l.4-2.8h-2.8V8.4c0-.8.3-1.3 1.4-1.3h1.5V4.6c-.3 0-1.1-.1-2.1-.1-2.1 0-3.500 1.300-3.500 3.600V10H8.200v2.800h2.400V20z"/></g></svg>',
 "ig": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><g transform="translate(12 12) scale(.76) translate(-12 -12)" style="stroke-width:2.5"><rect x="3" y="3" width="18" height="18" rx="5.2"/><circle cx="12" cy="12" r="4.1"/><circle class="f" cx="17.2" cy="6.8" r="1.3"/></g></svg>',
 "tt": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><g transform="translate(12 12) scale(.76) translate(-12 -12)" style="stroke-width:2.5"><path class="f" d="M12.900 3h2.300c.2 1.800 1.300 3 3.100 3.200v2.400c-1.200 0-2.300-.4-3.100-1v6.200a5.100 5.100 0 1 1-5.100-5.100v2.500a2.600 2.600 0 1 0 2.600 2.600z"/></g></svg>',
 "yt": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><g transform="translate(12 12) scale(.76) translate(-12 -12)" style="stroke-width:2.5"><rect x="2" y="5" width="20" height="14" rx="4.200"/><path class="f" d="M10 8.800l5.600 3.200L10 15.200z"/></g></svg>',
 "in": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><g transform="translate(12 12) scale(.76) translate(-12 -12)" style="stroke-width:2.5"><path class="f" d="M3.500 9h3.600v11.500H3.500zM5.300 3.200a2.100 2.100 0 1 1 0 4.200 2.100 2.100 0 0 1 0-4.200zM9.500 9H13v1.600c.6-1.100 1.900-1.900 3.600-1.900 3.600 0 4.400 2.300 4.400 5.400v6.400h-3.600v-5.700c0-1.400-.1-2.700-1.700-2.700s-1.900 1.300-1.900 2.600v5.800H9.500z"/></g></svg>',
 "th": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><g transform="translate(12 12) scale(.62) translate(-12 -12)" style="stroke-width:2.6"><path d="M16.800 11.200c-.5-3.200-2.400-4.700-5.100-4.700-3 0-4.900 2.200-4.900 5.500 0 4 2 5.800 5 5.800 2.500 0 4-1.200 4-3 0-3.600-5.700-3.200-5.700-.6 0 1 .8 1.700 1.800 1.700 1.500 0 2.200-1.200 2.300-2.600"/><path d="M12 22c-5.500 0-8.700-3.200-8.700-10S6.500 2 12 2s8.700 3.200 8.700 10c0 2.200-1 3.300-2.200 3.300"/></g></svg>',
 "bs": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><g transform="translate(12 12) scale(.62) translate(-12 -12)" style="stroke-width:0"><path class="f" d="M12 11c-.9-1.800-3.400-5.100-5.700-6.700C4.100 2.700 2.800 3.200 2.800 5.100c0 .4.200 3.200.4 3.700.6 2 2.700 2.600 4.600 2.300-3.400.6-4.200 2.500-2.400 4.400 3.300 3.400 4.800-.9 5.200-2 .1-.3.200-.4.200-.3s.1 0 .2.300c.4 1.100 1.900 5.400 5.200 2 1.800-1.900 1-3.800-2.400-4.400 1.900.3 4-.3 4.600-2.300.2-.5.4-3.300.4-3.700 0-1.900-1.300-2.400-3.500-.8C15.400 5.900 12.900 9.200 12 11z"/></g></svg>',
 "web": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><g transform="translate(12 12) scale(.76) translate(-12 -12)" style="stroke-width:2.5"><ellipse cx="12" cy="12" rx="4.800" ry="10"/><path d="M2 12h20M4.200 6.800h15.600M4.200 17.200h15.600"/></g></svg>',
}
HAS_LOGO_ANIM = any(os.path.exists(os.path.join(ROOT, "public/brand", n)) for n in ["reel-logo.webm", "reel-logo.mov", "reel-logo.apng", "reel-logo.gif", "reel-logo.webp", "reel-logo.mp4", "reel-logo.png"])
def static_page(i):
    bar = "".join(f'<i class="{"on" if j <= i else ""}"></i>' for j in range(len(scenes)))
    if os.path.exists(BAND_IMG):
        band = f'<img src="{b64(BAND_IMG, "image/png")}" style="position:absolute;left:0;bottom:0;width:{W}px;height:130px">'
    else:
        pad = ""
        band = f'<div class="band" style="{pad}">{ICONS["fb"]}{ICONS["ig"]}{ICONS["tt"]}{ICONS["yt"]}{ICONS["th"]}{ICONS["bs"]}{ICONS["in"]}{ICONS["web"]}<b>PakDhartiTv.com</b></div>'
    badge = f'<div class="badge">{html.escape(plan["badge"])}</div>' if plan.get("badge") else ""
    return (f'<html><head><meta charset="utf-8"><style>{CSS_STATIC}</style></head><body><div class="tint"></div>{badge}{band}</body></html>')

def word_html(i):
    sc = scenes[i]; words = sc["text"].split()
    marks = {m["i"]: m["c"] for m in (sc.get("marks") or [])}
    return [f'<span class="w" style="color:{COL.get(marks.get(k, "k"), COL["k"])}">{html.escape(w)}</span>' for k, w in enumerate(words)], words

JS_LINES = """() => { const ws=[...document.querySelectorAll('.nat .w')]; const lines=[]; let top=null;
  ws.forEach((w,i)=>{ const t=Math.round(w.getBoundingClientRect().top/6); if(top===null||t!==top){lines.push([]);top=t;} lines[lines.length-1].push(i); });
  const widths=lines.map(l=>{const a=ws[l[0]].getBoundingClientRect(),b=ws[l[l.length-1]].getBoundingClientRect();return Math.max(a.right,b.right)-Math.min(a.left,b.left);});
  return {lines,widths}; }"""

def block_html(spans, size, lines, wmax, top):
    out = [f'<div class="ln">{" ".join(spans[k] for k in l)}</div>' for l in lines]
    return f'<div class="blk" id="b" style="top:{top}px;font-size:{size}px"><div class="cap">{"".join(out)}</div></div>'

def pic_groups(sc, words):
    """one group per picture: the whole text of that picture's part (no chopping); one picture = the whole line"""
    nw = len(words); k = 1 if sc.get("clip") else 1 + len((sc.get("extra") or [])[:3])
    ats = [0] + [min(nw - 1, max(1, int(x))) if isinstance(x, (int, float)) else round(nw * (j + 1) / k) for j, x in enumerate((sc.get("extraAt") or [])[:k - 1])]
    while len(ats) < k: ats.append(round(nw * len(ats) / k))
    cuts = sorted(ats) + [nw]
    return [list(range(cuts[j], cuts[j + 1])) for j in range(k) if cuts[j + 1] > cuts[j]] or [list(range(nw))]

BOTTOM = 1630
async def setbody(pg, body):
    """change only the page's content: the big font is loaded once and stays (before, every page re-read the whole 9 MB font)"""
    await pg.evaluate("async b => { document.body.innerHTML = b; document.body.offsetHeight; await document.fonts.ready; }", body)

async def layout(pg, spans, size):
    await setbody(pg, f'<div class="nat" style="font-size:{size}px">{" ".join(spans)}</div>')
    lay = await pg.evaluate(JS_LINES)
    await setbody(pg, block_html(spans, size, lay["lines"], max(lay["widths"]), 0))
    return lay["lines"], max(lay["widths"]), await pg.evaluate("document.getElementById('b').offsetHeight")

async def draw():
    """per scene: the static layer + its groups (sentences); each group = lines of words + one transparent PNG with all its lines"""
    stat, per = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport=dict(width=W, height=H))
        for i in range(len(scenes)):
            if i == 0:                                   # the static layer (tint, badge, bottom band) is the same for every scene: draw it once
                await pg.set_content(static_page(i)); await pg.wait_for_timeout(50)
                sp = os.path.join(WORK, "s00.png"); await pg.screenshot(path=sp, omit_background=True)
                await pg.set_content(f'<html><head><meta charset="utf-8"><style>{CSS_TEXT}</style></head><body></body></html>')   # the text page: font loaded here, once
            stat.append(sp)
            spans, words = word_html(i); groups = pic_groups(scenes[i], words)
            forced = int(scenes[i].get("size") or 0); size = forced or 78
            while True:
                lays = [await layout(pg, [spans[k] for k in g], size) for g in groups]
                if forced or max(l[2] for l in lays) <= 720 or size <= 40: break
                size -= 4
            gl = []
            for n, g in enumerate(groups):
                lines, wmax, hgt = lays[n]
                await setbody(pg, block_html([spans[k] for k in g], size, lines, wmax, BOTTOM - hgt))
                pngs = []
                for q in range(len(lines) + 1):          # 0 = the empty box, then 1, 2, ... lines filled in
                    await pg.evaluate("q => document.querySelectorAll('.ln').forEach((e, j) => e.style.visibility = j < q ? 'visible' : 'hidden')", q)
                    lp = os.path.join(WORK, f"l{i:02d}_{n}_{q}.png"); await pg.screenshot(path=lp, omit_background=True); pngs.append(lp)
                gl.append({"png": pngs[0], "pngs": pngs, "lines": lines, "chars": sum(len(words[k]) + 1 for k in g)})
            per.append({"groups": gl})
        await b.close()
    return stat, per
stat_pngs, per = asyncio.run(draw()); T("caption pictures drawn")

CARD_PNG = None
col = plan.get("column")
if col:   # a guest column: the writer's photo, her credit and the title, centred on the screen for the first seconds only
    async def draw_card():
        ph = ""
        pp = fetch(col.get("photo"), os.path.join(WORK, "writer.jpg")) if col.get("photo") else None
        if pp: ph = f'<img class="wph" src="{b64(pp, "image/jpeg")}">'
        h = (f'<html><head><meta charset="utf-8"><style>{CSS_STATIC}</style></head><body><div class="cc"><div class="colcard">{ph}'
             f'<div class="colby">{html.escape(col.get("by") or "")}</div><div class="coltt">{html.escape(col.get("title") or "")}</div></div></div></body></html>')
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await b.new_page(viewport=dict(width=W, height=H))
            await pg.set_content(h); await pg.wait_for_timeout(150)
            out_ = os.path.join(WORK, "colcard.png"); await pg.screenshot(path=out_, omit_background=True); await b.close()
        return out_
    CARD_PNG = asyncio.run(draw_card()); T("column card drawn")

# ---- the end card: for the LAST scene (the voice says the full story is on Pak Dharti TV) a full-screen Pak Dharti TV page is laid over the video; the voice goes on
END_NAME, END_ROLE = "حماد نقوی", "چیف ایڈیٹر · پاک دھرتی ٹی وی"      # shown under the photo
HOST = os.path.join(ROOT, "public/brand/host.jpg")
END_PNG = None
if os.path.exists(HOST) and not plan.get("noEnd") and not os.environ.get("REEL_NO_END"):
    _I = lambda path, d: f'<i><svg viewBox="0 0 24 24">{d}</svg></i>'
    END_ICONS = "".join([
        '<i><svg viewBox="0 0 24 24"><path fill="#1877F2" d="M14 8V6.5c0-.7.2-1.2 1.3-1.2H17V2.2C16.6 2.1 15.7 2 14.6 2 12.1 2 10.4 3.5 10.4 6.3V8H7.5v3.3h2.9V22H14V11.3h2.6L17 8z"/></svg></i>',
        '<i><svg viewBox="0 0 24 24" fill="none" stroke="#E1306C" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r=".9" fill="#E1306C"/></svg></i>',
        '<i><svg viewBox="0 0 24 24"><path fill="#E60023" d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.900l1.200-5s-.3-.6-.3-1.500c0-1.400.8-2.400 1.800-2.400.9 0 1.300.6 1.300 1.400 0 .9-.5 2.100-.8 3.300-.2 1 .5 1.800 1.500 1.800 1.800 0 3.100-1.900 3.100-4.600 0-2.400-1.700-4.100-4.200-4.100-2.900 0-4.600 2.200-4.600 4.400 0 .9.300 1.800.8 2.300.1.100.1.200.1.300l-.3 1.100c0 .2-.1.200-.3.100-1.300-.6-2.100-2.500-2.100-4 0-3.300 2.400-6.300 6.900-6.300 3.600 0 6.400 2.600 6.400 6 0 3.600-2.300 6.500-5.400 6.500-1.100 0-2.100-.6-2.400-1.200l-.7 2.500c-.2.900-.9 2.100-1.300 2.800A10 10 0 1 0 12 2z"/></svg></i>',
        '<i><svg viewBox="0 0 24 24"><path fill="#000" d="M17.700 3h3.300l-7.200 8.300L22.300 21h-6.700l-5.200-6.800L4.400 21H1.100l7.700-8.800L.7 3h6.800l4.700 6.200zm-1.200 15.900h1.800L6.600 4.900H4.600z"/></svg></i>',
        '<i><svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round"><path d="M16.800 11.200c-.5-3.200-2.400-4.700-5.100-4.700-3 0-4.900 2.200-4.900 5.500 0 4 2 5.800 5 5.800 2.500 0 4-1.200 4-3 0-3.600-5.700-3.200-5.700-.6 0 1 .8 1.700 1.800 1.700 1.500 0 2.200-1.200 2.300-2.600"/><path d="M12 22c-5.500 0-8.700-3.200-8.700-10S6.500 2 12 2s8.700 3.200 8.700 10c0 2.200-1 3.300-2.200 3.300"/></svg></i>',
        '<i><svg viewBox="0 0 24 24"><path fill="#FF0000" d="M23 7.2c-.3-1-1-1.700-2-2C19.300 4.800 12 4.800 12 4.800s-7.300 0-9 .4c-1 .3-1.700 1-2 2C.6 8.900.6 12 .6 12s0 3.100.4 4.800c.3 1 1 1.700 2 2 1.700.4 9 .4 9 .4s7.300 0 9-.4c1-.3 1.700-1 2-2 .4-1.700.4-4.800.4-4.800s0-3.100-.4-4.800z"/><path fill="#fff" d="M9.800 15.200V8.800L15.400 12z"/></svg></i>',
        '<i><svg viewBox="0 0 24 24"><path fill="#0085FF" d="M12 11c-.9-1.800-3.400-5.100-5.700-6.700C4.100 2.700 2.800 3.200 2.800 5.100c0 .4.200 3.200.4 3.700.6 2 2.700 2.600 4.600 2.300-3.400.6-4.200 2.500-2.400 4.400 3.300 3.400 4.800-.9 5.200-2 .1-.3.200-.4.200-.3s.1 0 .2.300c.4 1.100 1.900 5.400 5.200 2 1.800-1.900 1-3.800-2.400-4.400 1.900.3 4-.3 4.600-2.300.2-.5.4-3.300.4-3.700 0-1.900-1.300-2.400-3.500-.8C15.400 5.900 12.900 9.200 12 11z"/></svg></i>'])
    END_HTML = f"""<html><head><meta charset="utf-8"><style>
@font-face{{font-family:JN;src:url({b64(os.path.join(ROOT, "public/fonts/jameel-noori-nastaleeq.woff2"), "font/woff2")})}}
*{{box-sizing:border-box;margin:0}}
body{{width:{W}px;height:{H}px;background:linear-gradient(180deg,#A30606 0%,#7A0000 45%,#3a0000 100%);font-family:JN,serif;color:#fff;position:relative;overflow:hidden;text-align:center}}
.logo{{position:absolute;top:90px;left:50%;transform:translateX(-50%);width:230px}}
.t1{{position:absolute;top:330px;width:100%;font-size:96px;font-weight:900;-webkit-text-stroke:2px #fff;word-spacing:12px;text-shadow:0 4px 14px #0008;line-height:1.9;direction:rtl}}
.ph{{position:absolute;top:560px;left:50%;transform:translateX(-50%);width:640px;height:800px;border-radius:28px;object-fit:cover;object-position:50% 20%;border:6px solid #fff;box-shadow:0 20px 60px #0008}}
.nm{{position:absolute;top:1385px;width:100%;font-size:66px;font-weight:900;-webkit-text-stroke:1px #fff;direction:rtl}}
.nm small{{display:block;font-size:44px;opacity:.95;font-weight:400;-webkit-text-stroke:0;margin-top:6px}}
.url{{position:absolute;bottom:250px;left:50%;transform:translateX(-50%);background:#fff;color:#7A0000;font:700 58px Arial,sans-serif;padding:18px 54px;border-radius:60px;white-space:nowrap}}
.fol{{position:absolute;bottom:175px;width:100%;font-size:38px;direction:rtl;opacity:.9}}
.ic{{position:absolute;bottom:50px;left:0;width:100%;display:flex;justify-content:center;gap:20px}}
.ic i{{width:88px;height:88px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-style:normal}}
.ic svg{{width:54px;height:54px}}
</style></head><body>
<img class="logo" src="{LOGO}">
<div class="t1">مکمل خبر پاک دھرتی ٹی وی پر</div>
<img class="ph" src="{b64(HOST, "image/jpeg")}">
<div class="nm">{html.escape(END_NAME)}<small>{html.escape(END_ROLE)}</small></div>
<div class="url">www.pakdhartitv.com</div>
<div class="ic">{END_ICONS}</div>
<div class="fol">فالو کریں · شیئر کریں</div>
</body></html>"""
    async def draw_end():
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await b.new_page(viewport=dict(width=W, height=H))
            await pg.set_content(END_HTML); await pg.wait_for_timeout(300)
            out_ = os.path.join(WORK, "endcard.png"); await pg.screenshot(path=out_); await b.close()
        return out_
    END_PNG = asyncio.run(draw_end()); T("end card drawn")

line_t = []   # when each group (sentence) of each scene comes in
for i, d in enumerate(per):
    cnt = [g["chars"] for g in d["groups"]]; allc = sum(cnt); t0_, t1_ = bounds[i], bounds[i + 1]
    ts = [starts[i] if i else (INTRO if INTRO else 0.2)]; acc = 0; ex = []
    for n in range(1, len(cnt)):
        acc += cnt[n - 1]; ex.append(t0_ + (t1_ - t0_) * acc / allc)
    ts += [x + OFF for x in pick_bounds(ex, sil, (0.3, 0.2), t0_ + 0.5, t1_ - 0.4, gap=0.6, P=1.5)]   # fallback
    if i in PICBND and len(PICBND[i]) - 1 == len(cnt): ts = [ts[0]] + PICBND[i][1:-1]            # caption part changes exactly when its picture does
    line_t.append(ts)

# ---- sound: voice + low siren under hospital scenes
SR = 44100; a = np.zeros(int(TOTAL * SR) + SR, dtype=np.float32)
v = np.interp(np.arange(int(VSEC * SR)) / SR * VR, np.arange(len(voice)), voice).astype(np.float32)
v = v / max(0.05, float(np.max(np.abs(v)))) * 0.9
s0 = int(OFF * SR); a[s0:s0 + len(v)] += v
def siren(t0, t1, vol=0.07):
    s0, s1 = int(t0 * SR), int(t1 * SR); tt = np.arange(s1 - s0) / SR
    ph = 2 * np.pi * np.cumsum(800 + 170 * np.sin(2 * np.pi * 0.55 * tt)) / SR; w = np.sin(ph) + 0.25 * np.sin(2 * ph)
    fade = np.minimum(1, np.minimum(tt / 0.6, (tt[-1] - tt) / 0.6)); a[s0:s1] += (vol * w * fade).astype(np.float32)
for i, on in enumerate(SIREN):
    if on: siren(*vis[i])
a = np.clip(a[: int(TOTAL * SR)], -1, 1)
with wave.open(os.path.join(WORK, "mix.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((a * 32767).astype(np.int16).tobytes())

# ---- video: each scene = slow-zoom photo + static layer + its lines arriving one by one in step with the voice
D = 0.22     # the caption slides in fast
def make_clip(i, t0, t1):
    dur = t1 - t0; frames = max(2, round(dur * FPS)); out = os.path.join(WORK, f"c{i}.mp4")
    zoom = "min(zoom+0.0005,1.16)" if i % 2 == 0 else "if(eq(on,1),1.16,max(zoom-0.0005,1.0))"
    anim = scenes[i].get("anim") or "right"
    inputs = ["-loop", "1", "-i", bgs[i], "-loop", "1", "-i", stat_pngs[i]]
    mir = "hflip," if scenes[i].get("mirror") or plan.get("mirror") else ""
    if clipf[i]:                                             # video clip: fill the frame, no zoom
        inputs = ["-stream_loop", "-1", "-i", clipf[i], "-loop", "1", "-i", stat_pngs[i]]
        src = f"[0:v]{mir}scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p"
    else:
        src = f"[0:v]{mir}zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='0':d={frames}:s={W}x{H}:fps={FPS},format=yuv420p"
    GRADES = {"cinematic": "eq=contrast=1.12:saturation=0.88:brightness=-0.02,curves=all='0/0 0.25/0.2 0.75/0.82 1/1'",
              "warm": "colorbalance=rs=.08:gs=.02:bs=-.08:rm=.06:bm=-.06,eq=saturation=1.08",
              "cool": "colorbalance=rs=-.07:bs=.09:rm=-.05:bm=.07,eq=saturation=0.95",
              "mono": "hue=s=0,eq=contrast=1.15",
              "tealorange": "colorbalance=rs=-.06:bs=.08:rh=.1:bh=-.1,eq=saturation=1.15:contrast=1.08"}
    g = GRADES.get(plan.get("grade") or "")
    if g: src += "," + g
    nz = plan.get("noise") or "none"
    if nz in ("white", "black"):
        amt = {"low": 0.05, "mid": 0.09, "high": 0.16}.get(plan.get("noiseAmt") or "mid", 0.18)
        mode = "screen" if nz == "white" else "multiply"
        base = "80" if nz == "white" else "c8"                # white grain lightens, black grain darkens
        src += f"[b0];color=c=0x{base}{base}{base}:s={W}x{H}:r={FPS},noise=alls=100:allf=t+u,format=yuv420p[nz];[b0][nz]blend=all_mode={mode}:all_opacity={amt}:shortest=1[b]"
    else:
        src += "[b]"
    fc = (src + f";[1:v]format=rgba[st];[b][st]overlay=0:0:format=auto[c0];")
    ci = 2; cur = "c0"; fc_n = 0
    for n, g in enumerate(per[i]["groups"]):
        S = max(0.0, line_t[i][n] - t0)                       # moment inside this clip
        E = (line_t[i][n + 1] - t0) if n + 1 < len(line_t[i]) else dur + 5
        nl = len(g["pngs"]) - 1
        span = max(0.2, min(1.8, E - S - D - 0.3)); dl = max(0.12, min(0.6, span / nl))      # the lines fill one after another over ~1.5 s
        tk = [S + D + 0.08 + q * dl for q in range(nl)]                                      # when line 1..nl appears
        wins = [(S, tk[0])] + [(tk[q], tk[q + 1] if q + 1 < nl else E) for q in range(nl)]
        for q, (w0, w1) in enumerate(wins):
            inputs += ["-loop", "1", "-i", g["pngs"][q]]
            if q == 0:
                e = f"max(t-{S:.3f},0)/{D}"; mv = f"pow(1-min({e},1),3)"
                if anim == "left": x, y = f"-W*{mv}", "0"
                elif anim == "bottom": x, y = "0", f"H*{mv}"
                elif anim == "fade": x, y = "0", "0"
                else: x, y = f"W*{mv}", "0"
                pre = f"format=rgba,fade=t=in:st={S:.3f}:d=0.3:alpha=1" if anim == "fade" else "format=rgba"
            else:
                x, y, pre = "0", "0", "format=rgba"
            fc += f"[{ci}:v]{pre}[t{fc_n}];[{cur}][t{fc_n}]overlay=x='{x}':y='{y}':enable='between(t,{w0:.3f},{w1:.3f})':format=auto[c{fc_n + 1}];"
            cur = f"c{fc_n + 1}"; fc_n += 1; ci += 1
    fc += f"[{cur}]format=yuv420p[v]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", fc,
        "-map", "[v]", "-frames:v", str(frames), "-r", str(FPS), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "17", out], check=True)   # a middle step: quick, the final encode makes it small
    return out
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=max(1, min(3, os.cpu_count() or 2))) as _ex:     # scenes are independent: make several at once
    clips = list(_ex.map(lambda a_: make_clip(*a_), [(i, v0, v1) for i, (v0, v1) in enumerate(vis)]))
T("scene clips made")
with open(os.path.join(WORK, "bg.txt"), "w") as f:
    for c in clips: f.write(f"file '{c}'\n")
# your animated logo (optional): public/brand/reel-logo.webm (transparent, ready-sized, 189 px high); it plays in the top-left corner
LOGO_FILE = next((os.path.join(ROOT, "public/brand", n) for n in ["reel-logo.webm", "reel-logo.mov", "reel-logo.apng", "reel-logo.gif", "reel-logo.webp", "reel-logo.mp4", "reel-logo.png"] if os.path.exists(os.path.join(ROOT, "public/brand", n))), None)
# a soft light that sweeps across the bottom strip every few seconds (a small picture moved by ffmpeg: costs almost nothing)
from PIL import Image as _Im
SHINE = os.path.join(WORK, "shine.png")
_sh = _Im.new("RGBA", (200, 130), (255, 255, 255, 0))
_px = _sh.load()
for _x in range(200):
    for _y in range(130):
        _d = abs((_x - 100) + (_y - 65) * 0.6)          # slanted stripe
        _a = max(0.0, 1 - _d / 55.0) ** 2 * 0.32
        _px[_x, _y] = (255, 255, 255, int(255 * _a))
_sh.save(SHINE)
if LOGO_FILE:
    # a transparent .webm needs the libvpx decoder to keep its see-through background
    LOGO_IN = (["-ignore_loop", "0"] if LOGO_FILE.endswith(".gif") else ["-stream_loop", "-1"]) + (["-c:v", "libvpx-vp9"] if LOGO_FILE.endswith(".webm") else []) + ["-i", LOGO_FILE]
    SH_IDX, LG_IDX = 4, 3
else:
    LOGO_IN = []; SH_IDX = 3
SH_IN = ["-loop", "1", "-i", SHINE] + (["-loop", "1", "-i", CARD_PNG] if CARD_PNG else []) + (["-loop", "1", "-i", END_PNG] if END_PNG else [])
SH_F = f"[vw][{SH_IDX}:v]overlay=x='-200+mod(t\\,3.4)*({W}+400)/3.4':y={H - 130}:format=auto:shortest=1[vs];"
CARD_IDX = (SH_IDX + 1)
if LOGO_FILE:
    LOGO_F = SH_F + f"[{LG_IDX}:v]format=rgba,scale=trunc(iw*0.9/2)*2:-2[lg];[vs][lg]overlay=40:50:format=auto:shortest=0,format=yuv420p[v]"
else:
    LOGO_F = SH_F + "[vs]format=yuv420p[v]"
if CARD_PNG:    # the column card: in the middle of the screen for about 3 seconds (fades in and out), then gone
    LOGO_F = LOGO_F[:-3] + "[vz];" + f"[{CARD_IDX}:v]format=rgba,fade=t=in:st=0.2:d=0.4:alpha=1,fade=t=out:st=2.6:d=0.4:alpha=1[cc];[vz][cc]overlay=0:0:enable='between(t,0.2,3.05)':format=auto,format=yuv420p[v]"
if END_PNG:     # the end card covers everything (logo, strip, bars) from the start of the last scene to the end; it fades in
    _END_IDX = SH_IDX + 1 + (1 if CARD_PNG else 0); _ES = max(0.0, vis[-1][0])
    LOGO_F = LOGO_F[:-3] + f"[vq];[{_END_IDX}:v]format=rgba,fade=t=in:st={_ES:.2f}:d=0.35:alpha=1[ee];[vq][ee]overlay=0:0:enable='gte(t,{_ES:.2f})':format=auto,format=yuv420p[v]"
# ---- voice bars: a sound-level display that jumps with the voice and disappears in silence ----
BW, BH, NB = 880, 100, 44                       # picture size, number of bars (mirrored: loud low tones in the middle, high tones outside)
def make_bars(wav_path, out_mov, total):
    with wave.open(wav_path) as wf:
        sr, ch = wf.getframerate(), wf.getnchannels()
        x = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    nfr = int(total * FPS) + 1; win = 2048; half = NB // 2
    edges = np.geomspace(90, 5200, half + 1); freqs = np.fft.rfftfreq(win, 1 / sr); hann = np.hanning(win).astype(np.float32)
    idx = [np.where((freqs >= edges[k]) & (freqs < edges[k + 1]))[0] for k in range(half)]
    spec = np.zeros((nfr, half), np.float32)
    for f in range(nfr):
        c = int(f / FPS * sr); seg = x[max(0, c - win // 2): c + win // 2]
        if len(seg) < win: seg = np.pad(seg, (0, win - len(seg)))
        m = np.abs(np.fft.rfft(seg * hann))
        spec[f] = [np.sqrt(m[i].mean()) if len(i) else 0.0 for i in idx]
    g = max(1e-6, float(np.percentile(spec, 97)))
    ref = np.maximum(np.percentile(spec, 97, axis=0), 0.3 * g)       # every bar is measured against its own loud moments, so all of them move
    level = np.clip(spec / ref[None, :], 0, 1.15)
    out = np.zeros_like(level); cur = np.zeros(half, np.float32)
    for f in range(nfr):                         # fast rise, smooth fall
        v = level[f]; cur = np.where(v > cur, cur + (v - cur) * 0.7, cur * 0.80 + v * 0.2)
        out[f] = cur
    out = np.where(out < 0.07, 0, out) ** 0.85
    SS = 2; bw, gap = 12 * SS, 8 * SS
    x0 = (BW * SS - (NB * bw + (NB - 1) * gap)) // 2
    order = list(range(half - 1, -1, -1)) + list(range(half))      # outside = high tones, middle = low tones
    pr = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{BW}x{BH}", "-r", str(FPS), "-i", "-",
                           "-c:v", "png", "-pix_fmt", "rgba", out_mov], stdin=subprocess.PIPE)
    for f in range(nfr):
        im = Image.new("RGBA", (BW * SS, BH * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        for j, b in enumerate(order):
            v = float(out[f, b])
            if v <= 0: continue
            hh = max(5 * SS, int(v * (BH * SS / 2 - 4 * SS)))
            bx = x0 + j * (bw + gap); cy = BH * SS // 2
            d.rounded_rectangle([bx + 2 * SS, cy - hh + 3 * SS, bx + bw + 2 * SS, cy + hh + 3 * SS], radius=bw // 2, fill=(0, 0, 0, 90))   # soft shadow
            d.rounded_rectangle([bx, cy - hh, bx + bw, cy + hh], radius=bw // 2, fill=(255, 255, 255, 245))
        pr.stdin.write(im.resize((BW, BH), Image.LANCZOS).tobytes())
    pr.stdin.close(); pr.wait()
BARS = os.path.join(WORK, "bars.mov")
make_bars(os.path.join(WORK, "mix.wav"), BARS, TOTAL); T("voice bars made")
IDX = 2; BARS_IDX = IDX; IDX += 1
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(WORK, "bg.txt"), "-i", os.path.join(WORK, "mix.wav"), "-i", BARS,
    *LOGO_IN, *SH_IN, "-filter_complex", f"[1:a]anull[a1];[0:v][{BARS_IDX}:v]overlay=100:1672:format=auto:shortest=0[vw];" + LOGO_F,
    # settings every phone/WhatsApp accepts: H.264 Main, 8-bit 4:2:0, 30 fps constant, stereo AAC 44.1 kHz, index at the front
    "-map", "[v]", "-map", "[a1]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-profile:v", "main", "-level", "4.0", "-pix_fmt", "yuv420p", "-r", str(FPS), "-fps_mode", "cfr",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2", "-shortest",
    "-t", f"{TOTAL:.2f}", "-movflags", "+faststart", "-tag:v", "avc1", OUT], check=True)
print("seconds", round(TOTAL, 1), "bytes", os.path.getsize(OUT), "groups", [len(d["groups"]) for d in per])
