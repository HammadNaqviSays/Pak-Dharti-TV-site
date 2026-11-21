"use client";
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { REEL_FONTS, REEL_COLORS, REEL_ANIMS, REEL_STROKES, fontOf } from "@/lib/reelFonts";
import { BusyOverlay } from "../../Busy";
import SceneMedia from "../SceneMedia";
import FullPreview from "../../FullPreview";
import { previewVoiceAction, setReelVoiceAction, reelStatusAction, saveReelEditAction, uploadReelPicAction, uploadReelClipAction } from "../../reelsAction";

// shrink a chosen picture to ~1500 px JPEG in the browser before sending it
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1500 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
}

const ORDER = ["k", "r", "b", "g"];
const NAMES = { k: "Black", r: "Maroon", b: "Blue", g: "Green" };

// Words are plain (white on the dark caption box) unless the editor colours them.
const colorOf = (sc, i) => {
  const m = sc.marks.find((x) => x.i === i);
  return m ? m.c : "k";
};
const ON_DARK = { k: "#ffffff", r: "#ff8f8f", b: "#9cc3ff", g: "#8fe6ab" };   // the same colours the video uses on the dark box

const GRADE_CSS = { "": "", cinematic: "contrast(1.1) saturate(.9) brightness(.95)", warm: "sepia(.25) saturate(1.15)", cool: "hue-rotate(8deg) saturate(.95) brightness(.98)", mono: "grayscale(1) contrast(1.1)", tealorange: "contrast(1.1) saturate(1.2) hue-rotate(-8deg)" };
const PADX = 24, BORD = 7, CAPW = 900, CPL = 34, CPR = 34;

/** A quick look at what the first moment of a line will look like (same sizes as the video, scaled down). Nothing is rendered; it follows the settings live. */
function LookPreview({ scenes, n, setN, fontFile, stroke, bgAlpha, badge, grade, mirror }) {
  const sc = scenes[n] || scenes[0];
  const words = sc.text.split(" ");
  const hasMore = !sc.clip && (sc.extra || []).length > 0;
  const cut0 = hasMore ? Math.min(words.length - 1, Math.max(1, Number.isFinite(Number((sc.extraAt || [])[0])) && (sc.extraAt || [])[0] != null ? Number(sc.extraAt[0]) : Math.round(words.length / (1 + Math.min(3, sc.extra.length))))) : words.length;
  const part = words.slice(0, cut0);                                      // the whole text of the first picture (it is shown in full, in as many lines as it needs)
  const size = sc.size || 78;
  const natRef = useRef(null);
  const [lines, setLines] = useState([]);
  useLayoutEffect(() => {
    const el = natRef.current; if (!el) return;
    const run = () => {
      const ws = [...el.querySelectorAll("span.w")]; const out = []; let top = null;
      ws.forEach((w, i) => { const t = Math.round(w.getBoundingClientRect().top / 6); if (top === null || t !== top) { out.push({ idx: [], l: 1e9, r: -1e9 }); top = t; }
        const o = out[out.length - 1]; const b = w.getBoundingClientRect(); o.idx.push(i); o.l = Math.min(o.l, b.left); o.r = Math.max(o.r, b.right); });
      setLines(out);
    };
    run();
    if (document.fonts?.ready) document.fonts.ready.then(run);
  }, [sc.text, size, fontFile, n]);
  const k = 0.3, W = 1080, H = 1920;
  const wmax = lines.length ? Math.max(...lines.map((x) => x.r - x.l)) : 0;
  const bc = stroke === "k" ? "#000" : "#7a0000";
  const wordEl = (w, i) => <span key={i} className="w" style={{ color: ON_DARK[colorOf(sc, i)] }}>{w}{" "}</span>;
  const img = sc.pic || sc.img;
  return (
    <div style={{ margin: ".6rem 0" }}>
      <label style={{ fontSize: ".85rem" }}>Preview line:{" "}
        <select value={n} onChange={(e) => setN(Number(e.target.value))}>{scenes.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select>
      </label>
      <div style={{ width: W * k, height: H * k, overflow: "hidden", borderRadius: 10, position: "relative", background: "#0b2a33", border: "1px solid #bbb", margin: ".4rem 0" }}>
        <div style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0, fontFamily: "ReelPreview, serif", direction: "rtl" }}>
          {img && <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 28%", filter: GRADE_CSS[grade] || "", transform: (mirror || sc.mirror) ? "scaleX(-1)" : "none" }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(4,28,36,.55) 0,rgba(4,28,36,.30) 30%,rgba(4,28,36,.62) 56%,rgba(3,18,24,.9) 100%)" }} />
          {badge && <div style={{ position: "absolute", right: 56, top: 96, background: "linear-gradient(180deg,#8a0000,#5a0000)", color: "#fff", border: "3px solid #e8c15a", borderRadius: 10, padding: "0 26px 10px", font: "60px/1.8 ReelPreview, serif", boxShadow: "0 4px 14px rgba(0,0,0,.4)" }}>{badge}</div>}
          <video src="/brand/reel-logo.webm" autoPlay loop muted playsInline style={{ position: "absolute", left: 40, top: 50, height: 170 }} />
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: H - 1630, width: "max-content", maxWidth: CAPW, fontSize: size }}>
            <div style={{ background: `rgba(58,58,62,${0.8 * (bgAlpha || 100) / 100})`, borderRadius: 22, borderLeft: "14px solid #e0152b", borderRight: "14px solid #e0152b", padding: `12px ${CPR}px 4px ${CPL}px`, direction: "rtl", textAlign: "center" }}>
              {lines.map((ln, j) => <div key={j} style={{ whiteSpace: "nowrap", lineHeight: 1.55, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,.35)" }}>{ln.idx.map((i) => wordEl(part[i], i))}</div>)}
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 196, height: 100, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, direction: "ltr" }}>
            {[8, 22, 40, 70, 90, 60, 36, 80, 50, 26, 12].map((h, i) => <i key={i} style={{ width: 12, height: h, borderRadius: 6, background: "#fff", display: "block" }} />)}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 130, background: "linear-gradient(180deg,#8a0000 0%,#6a0000 55%,#4c0000 100%)", borderTop: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, direction: "ltr" }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <i key={i} style={{ width: 58, height: 58, borderRadius: 29, border: "2px solid #fff", display: "block" }} />)}
            <b style={{ font: "700 38px sans-serif", color: "#fff" }}>PakDhartiTv.com</b>
          </div>
        </div>
        <div ref={natRef} style={{ position: "absolute", visibility: "hidden", right: 90, top: 0, width: CAPW - CPL - CPR - 28, fontSize: size, lineHeight: 1.55, fontFamily: "ReelPreview, serif", direction: "rtl", textAlign: "right", transform: "none", pointerEvents: "none", height: 0, overflow: "hidden" }}>
          {part.map((w, i) => <span key={i} className="w">{w}{" "}</span>)}
        </div>
      </div>
      <small className="hint">Quick look (not the real render): picture, box opacity, colours and badge follow your settings as you change them.</small>
    </div>
  );
}

export default function ReelEditor({ data }) {
  const [font, setFont] = useState(data.font);
  const [stroke, setStroke] = useState(data.stroke);
  const [badge, setBadge] = useState(data.badge);
  const [grade, setGrade] = useState(data.grade);
  const [noise, setNoise] = useState(data.noise);
  const [noiseAmt, setNoiseAmt] = useState(data.noiseAmt);
  const [mirror, setMirror] = useState(data.mirror);
  const [bgAlpha, setBgAlpha] = useState(data.bgAlpha || 100);
  const [scenes, setScenes] = useState(data.scenes);
  const [playFull, setPlayFull] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(data.status);
  const [since, setSince] = useState(0);        // seconds in the current status
  const [failMsg, setFailMsg] = useState("");
  const [done, setDone] = useState(false);
  const making = ["scripted", "rendering"].includes(status);
  // while the video is being made: ask the site every 8 seconds and tell clearly when it stops (ready or failed)
  useEffect(() => {
    if (!making) return;
    let live = true;
    const tick = async () => {
      try {
        const r = await reelStatusAction(data.id);
        if (!live || r?.error) return;
        setSince(r.sec);
        if (r.status !== status) {
          setStatus(r.status);
          if (r.status === "ready" || r.status === "approved" || r.status === "posted") {
            setDone(true);
          try { document.title = "✅ Video ready - Pak Dharti TV"; const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); o.connect(a.destination); o.frequency.value = 880; o.start(); setTimeout(() => o.stop(), 400); } catch {}
            setTimeout(() => { try { window.location.reload(); } catch {} }, 1500);   // the page refreshes itself and shows the finished video
          } else if (r.status === "failed") setFailMsg(r.error || "The video maker could not finish.");
        }
      } catch { /* a busy moment on the server: the next check tries again */ }
    };
    const t = setInterval(tick, 5000);
    const vis = () => { if (document.visibilityState === "visible") tick(); };   // coming back to this tab checks at once
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [making, status, data.id]);
  const [pv, setPv] = useState(0);
  const [voice, setVoice] = useState(data.voice || data.defVoice);
  const [vmsg, setVmsg] = useState(""), [vsrc, setVsrc] = useState(""), [vbusy, setVbusy] = useState(false);
  const listenVoice = async () => {
    setVbusy(true); setVsrc(""); setVmsg("Making a short sample… (a few seconds)");
    const r = await previewVoiceAction(data.id, voice);
    setVbusy(false);
    if (r?.error) { setVmsg(r.error); return; }
    setVsrc(r.src); setVmsg("Listen. If you like it, press 'Use this voice'.");
  };
  const useVoice = async () => {
    setVbusy(true);
    const r = await setReelVoiceAction(data.id, voice === data.defVoice ? "" : voice);
    setVbusy(false);
    setVmsg(r?.error ? r.error : `✅ ${voice} will speak this video. Press 'Save and make video again' to hear it in the video.`);
  };
  const f = fontOf(font);
  const set = (n, patch) => setScenes((a) => a.map((s, i) => (i === n ? { ...s, ...patch } : s)));

  const cycle = (n, i) => {
    const sc = scenes[n];
    const cur = colorOf(sc, i);
    const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
    // once the editor touches colours, the automatic red is written out explicitly
    const words = sc.text.split(" ");
    const base = sc.edited || sc.marks.length ? sc.marks : words.map((_, k) => ({ i: k, c: colorOf(sc, k) })).filter((m) => m.c !== "k");
    const marks = base.filter((m) => m.i !== i);
    if (next !== "k") marks.push({ i, c: next });
    set(n, { marks, edited: true });
  };

  const upload = async (n, file) => {
    if (!file) return;
    setMsg("Uploading the picture…");
    try {
      const blob = await shrink(file); const fd = new FormData();
      fd.set("id", data.id); fd.set("n", String(n)); fd.set("file", new File([blob], "p.jpg", { type: "image/jpeg" }));
      const r = await uploadReelPicAction(fd);
      if (r?.error) setMsg(r.error); else { set(n, { pic: r.url, alt: 0 }); setMsg("Picture added. Press Save and make the video again."); }
    } catch { setMsg("Could not read that picture."); }
  };

  const uploadClip = async (n, file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setMsg("Clip is too big (max 20 MB). Please trim it first."); return; }
    const PIECE = 3 * 1024 * 1024, total = Math.ceil(file.size / PIECE);
    try {
      let url = "";
      for (let p = 0; p < total; p++) {
        setMsg(`Uploading clip… ${p + 1}/${total}`);
        const fd = new FormData();
        fd.set("id", data.id); fd.set("n", String(n)); fd.set("part", String(p)); fd.set("total", String(total));
        fd.set("file", new File([file.slice(p * PIECE, (p + 1) * PIECE)], "c.bin"));
        const r = await uploadReelClipAction(fd);
        if (r?.error) { setMsg(r.error); return; }
        url = r.url;
      }
      set(n, { clip: url, pic: "" }); setMsg("Clip added. Press Save and make the video again.");
    } catch { setMsg("Clip upload failed, try again."); }
  };

  const save = async (remake) => {
    setBusy(true); setMsg("");
    const r = await saveReelEditAction(data.id, { font, stroke, badge, grade, noise, noiseAmt, mirror, bgAlpha, scenes: scenes.map((s) => ({ mirror: s.mirror, text: s.text, marks: s.edited ? s.marks : words0(s), anim: s.anim, size: s.size })) }, remake);
    setBusy(false);
    if (!r?.error && remake) { setStatus("scripted"); setSince(0); setDone(false); setFailMsg(""); }
    setMsg(r?.error ? r.error : remake ? "✅ Saved. Your video is now in the queue. Keep this page open: it will tell you when the video is ready." : "✅ Saved.");
  };
  const words0 = (s) => s.text.split(" ").map((_, k) => ({ i: k, c: colorOf(s, k) })).filter((m) => m.c !== "k");

  return (
    <>
      <BusyOverlay show={busy} text="Saving. Please wait…" />
      <style>{`@font-face{font-family:"ReelPreview";src:url(/fonts/${f.file})}
      .rs{display:inline;background:#fff;border:5px solid ${stroke === "k" ? "#000" : "#7a0000"};padding:6px 14px 10px;box-decoration-break:clone;-webkit-box-decoration-break:clone;line-height:2}
      .rw{cursor:pointer}.rw:hover{outline:2px dashed #888}`}</style>
      <h2>Edit look</h2>
      <p className="hint" lang="ur" dir="rtl" style={{ fontFamily: "\"Jameel Noori Nastaleeq\", serif", fontSize: "1.2rem" }}>{data.title}</p>
      <p className="hint">Tap a word to change its colour (black, red, blue, green). Choose how each text comes in, its size and the font. Lines come in one by one with the voice; the first lines are justified automatically.</p>
      <div style={{ border: "1px solid #ccc", borderRadius: 10, padding: ".7rem .9rem", margin: ".6rem 0", fontFamily: "system-ui, sans-serif", fontSize: ".9rem" }}>
        <strong>Voice-over</strong>{" "}
        <select value={voice} onChange={(e) => { setVoice(e.target.value); setVsrc(""); setVmsg(""); }}>
          {data.voices.map((v) => <option key={v} value={v}>{v}{v === data.defVoice ? " (default)" : ""}</option>)}
        </select>{" "}
        <button type="button" className="btn secondary" disabled={vbusy} onClick={listenVoice}>▶ Listen first</button>{" "}
        <button type="button" className="btn publish" disabled={vbusy} onClick={useVoice}>Use this voice</button>
        {vsrc && <div><audio controls autoPlay src={vsrc} style={{ marginTop: ".4rem", width: "100%", maxWidth: 360 }} /></div>}
        {vmsg && <div style={{ marginTop: ".3rem" }}>{vmsg}</div>}
      </div>
      <LookPreview scenes={scenes} n={pv} setN={setPv} fontFile={f.file} stroke={stroke} bgAlpha={bgAlpha} badge={badge} grade={grade} mirror={mirror} />
      <label>Font:{" "}
        <select value={font} onChange={(e) => setFont(e.target.value)}>{REEL_FONTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
      </label>
      <label style={{ marginInlineStart: "1rem" }}>Outline:{" "}
        <select value={stroke} onChange={(e) => setStroke(e.target.value)}>{Object.entries(REEL_STROKES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </label>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: ".6rem" }}>
        <label>Top tag:{" "}<input dir="rtl" value={badge} placeholder="auto (blank) · - for none" onChange={(e) => setBadge(e.target.value)} style={{ width: 170 }} /></label>
        <label>Colour look:{" "}
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">None</option><option value="cinematic">Cinematic</option><option value="warm">Warm</option><option value="cool">Cool</option><option value="mono">Black &amp; white</option><option value="tealorange">Teal &amp; orange</option>
          </select>
        </label>
        <label>Noise:{" "}
          <select value={noise} onChange={(e) => setNoise(e.target.value)}><option value="none">None</option><option value="white">White noise</option><option value="black">Black noise</option></select>
        </label>
        {noise !== "none" && <label>Strength:{" "}
          <select value={noiseAmt} onChange={(e) => setNoiseAmt(e.target.value)}><option value="low">Light</option><option value="mid">Medium</option><option value="high">Heavy</option></select>
        </label>}
        <label>Strip behind the words: <input type="range" min="20" max="100" step="5" value={bgAlpha} onChange={(e) => setBgAlpha(Number(e.target.value))} /> {bgAlpha}%</label>
        <label><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror all pictures/clips</label>
      </div>
      <p className="hint">Look, noise and mirror change only the style. They do not make someone else's picture or video free to use: use your own, licensed or free material and keep the credit.</p>
      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: "1.2rem", marginTop: "1rem" }}>
        {scenes.map((sc, n) => (
          <li key={n} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: ".8rem" }}>
            <div style={{ background: "#183a44", padding: "1rem", borderRadius: 8, direction: "rtl", fontFamily: "ReelPreview, serif", fontSize: `${Math.max(18, (sc.size || 64) * 0.42)}px` }}>
              <span className="rs">
                {sc.text.split(" ").map((w, i) => (
                  <span key={i} className="rw" onClick={() => cycle(n, i)} style={{ color: REEL_COLORS[colorOf(sc, i)] }}>{w}{" "}</span>
                ))}
              </span>
            </div>
            <textarea dir="rtl" value={sc.text} rows={2} onChange={(e) => set(n, { text: e.target.value, marks: [], edited: false })} style={{ width: "100%", marginTop: ".5rem", fontFamily: "\"Jameel Noori Nastaleeq\", serif", fontSize: "1.1rem" }} />
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginTop: ".4rem" }}>
              <label>Comes in:{" "}
                <select value={sc.anim} onChange={(e) => set(n, { anim: e.target.value })}>{Object.entries(REEL_ANIMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              <label>Size: {sc.size ? sc.size : "auto"}{" "}
                <input type="range" min="0" max="100" step="4" value={sc.size} onChange={(e) => set(n, { size: Number(e.target.value) })} />
              </label>
              <small>Scene {n + 1} · {sc.kw}</small>
            </div>
            <SceneMedia id={data.id} n={n} text={sc.text} pic={sc.pic} clip={sc.clip} extra={sc.extra || []} extraAt={sc.extraAt || []} thumb={sc.pic || sc.img} onPicture={(u) => set(n, { pic: u })} />
            <label style={{ display: "inline-block", marginTop: ".3rem" }}><input type="checkbox" checked={!!sc.mirror} onChange={(e) => set(n, { mirror: e.target.checked })} /> Mirror</label>
          </li>
        ))}
      </ol>
      <div style={{ display: "flex", gap: ".6rem", margin: "1rem 0", flexWrap: "wrap" }}>
        <button className="btn secondary" disabled={busy} onClick={() => save(false)}>Save</button>
        <button className="btn publish" disabled={busy || making} onClick={() => save(true)}>{making ? "Video is being made…" : "Save and make the video again"}</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      {making && (
        <p role="status" style={{ background: "#fff6dd", border: "1px solid #e6c34d", borderRadius: 10, padding: ".7rem 1rem" }}>
          {status === "rendering" ? "⚙️ The video is being made right now (about 7 minutes)." : "⏳ In the queue: waiting for the video maker to pick it up (it can take up to 3 hours, or run Reels on GitHub)."}
          <br /><small>Checking every few seconds. This page tells you when it stops.</small>
        </p>
      )}
      {!making && done && (
        <p role="status" style={{ background: "#e3f6e8", border: "1px solid #3aa655", borderRadius: 10, padding: ".7rem 1rem" }}>
          ✅ <b>The video is ready.</b> <button type="button" className="btn publish" style={{ padding: ".2rem .7rem" }} onClick={() => setPlayFull(true)}>▶ Full preview</button> <a href={`/api/reels/${data.id}/video`} target="_blank" rel="noopener">(new tab)</a> or go back to the <a href="/admin/reels">Reels list</a> to approve it.
        </p>
      )}
      {playFull && (
        <FullPreview onClose={() => setPlayFull(false)} note="Watch the whole video, check the edges, top and bottom, then close.">
          <video src={`/api/reels/${data.id}/video`} controls autoPlay playsInline style={{ maxHeight: "86vh", maxWidth: "96vw", aspectRatio: "9 / 16", background: "#000", borderRadius: 4 }} />
        </FullPreview>
      )}
      {!making && status === "failed" && failMsg && (
        <p role="alert" style={{ background: "#fde8e8", border: "1px solid #c0392b", borderRadius: 10, padding: ".7rem 1rem" }}>⚠️ <b>The video could not be made:</b> {failMsg} Press "Save and make the video again" to try again.</p>
      )}
    </>
  );
}
