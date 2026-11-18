"""Quality check sheet for cut-outs: for the most important people, shows
   original photo | current cut-out | other models (IS-Net, BiRefNet lite)
on a checkerboard, so the edges (hair, shoulders, leftovers of the background) can be judged.
Writes review/cutouts.jpg (pushed to the 'people-review' branch by the workflow)."""
import io, os, time
import requests
from PIL import Image, ImageDraw, ImageFont
from rembg import new_session, remove
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SITE = os.environ.get("SITE", "https://pak-dharti-tv.vercel.app")
TOKEN = os.environ["TOKEN"]
N = int(os.environ.get("REVIEW_N", "12"))
S = requests.Session()
S.headers["User-Agent"] = "PakDhartiTV-PeopleLibrary/1.0 (news site)"
CELL = 360


def checker(w, h, s=18):
    im = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2: d.rectangle([x, y, x + s - 1, y + s - 1], fill=(205, 205, 205))
    return im


def fit(im, w, h):
    im = im.copy(); im.thumbnail((w, h))
    return im


def place(sheet, im, x, y):
    bg = checker(CELL, CELL) if im.mode == "RGBA" else Image.new("RGB", (CELL, CELL), (30, 30, 30))
    im = fit(im, CELL - 10, CELL - 10)
    ox, oy = (CELL - im.width) // 2, (CELL - im.height) // 2
    if im.mode == "RGBA": bg.paste(im, (ox, oy), im)
    else: bg.paste(im, (ox, oy))
    sheet.paste(bg, (x, y))


def main():
    from cutouts import cut as bust_cut  # the method used for the library
    items = S.get(f"{SITE}/api/cron/people?op=sample-cutouts&n={N}", headers={"x-cron-token": TOKEN}, timeout=60).json()["items"]
    models = []
    models.append(("new bust (face crop + matting)", new_session("u2net_human_seg")))
    for name in [m.strip() for m in os.environ.get("MODELS", "").split(",") if m.strip()]:
        try:
            t0 = time.time(); models.append((name, new_session(name))); print("loaded", name, round(time.time() - t0, 1), flush=True)
        except Exception as e:  # noqa
            print("could not load", name, e, flush=True)
    cols = 2 + len(models)
    sheet = Image.new("RGB", (CELL * cols + 10 * (cols + 1), (CELL + 34) * len(items) + 40), (250, 250, 250))
    d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
    except Exception: font = ImageFont.load_default()
    d.text((10, 8), "original  |  current (u2net human)  |  " + "  |  ".join(m[0] for m in models), fill=(0, 0, 0), font=font)
    times = {m[0]: [] for m in models}
    for i, it in enumerate(items):
        y = 40 + i * (CELL + 34)
        d.text((10, y), it["name"], fill=(120, 0, 0), font=font)
        try:
            orig = Image.open(io.BytesIO(S.get(it["url"], timeout=60).content)).convert("RGB")
            cur = Image.open(io.BytesIO(S.get(SITE + it["cutout"], timeout=60).content)).convert("RGBA")
            src = orig.copy(); src.thumbnail((1400, 1400))
            place(sheet, orig, 10, y + 28); place(sheet, cur, 20 + CELL, y + 28)
            raw = S.get(it["url"], timeout=60).content
            for k, (name, sess) in enumerate(models):
                t = time.time()
                if name.startswith("new bust"):
                    r = bust_cut(raw, sess)
                    if not isinstance(r, tuple):
                        times[name].append(time.time() - t)
                        d.text((10 + (2 + k) * (CELL + 10) + 10, y + 120), str(r or "nothing found"), fill=(200, 0, 0), font=font); continue
                    b = Image.open(io.BytesIO(r[0])).convert("RGBA")
                else:
                    b = remove(src, session=sess)
                times[name].append(time.time() - t)
                box = b.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
                if box: b = b.crop(box)
                place(sheet, b, 10 + (2 + k) * (CELL + 10), y + 28)
            print("done", it["name"], flush=True)
            os.makedirs("review", exist_ok=True); sheet.save("review/cutouts.jpg", quality=88)
        except Exception as e:  # noqa
            d.text((10, y + 60), f"error: {e}", fill=(200, 0, 0), font=font)
    os.makedirs("review", exist_ok=True)
    sheet.save("review/cutouts.jpg", quality=88)
    print("::notice title=review::" + f"{len(items)} people; seconds per photo: " + ", ".join(f"{k} {round(sum(v) / max(1, len(v)), 1)}" for k, v in times.items()))


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa
        import traceback
        tb = traceback.format_exc().replace("\n", " | ")
        print(f"::warning title=review error::{tb[-900:]}")
        raise
