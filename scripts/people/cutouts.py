"""Cut-outs for the people library, in the style news channels use: a clean head-and-shoulders "bust".
1. Finds the person (u2net human mask). No person → the photo is not a portrait (e.g. a building) and is removed.
2. Finds the head (top of the person) and crops head, shoulders and chest — chairs, flowers, microphones lower down drop out.
3. Removes the background (rembg u2net_human_seg, with alpha matting for cleaner hair edges).
4. Fades the bottom edge softly, so the body never ends in a ragged line.
Sends transparent WebP to the site.  GET /api/cron/people?op=needs-cutout  →  POST ?op=cutout"""
import base64, io, os, time
import numpy as np
import requests
from PIL import Image
from rembg import new_session, remove

SITE = os.environ.get("SITE", "https://pak-dharti-tv.vercel.app")
TOKEN = os.environ["TOKEN"]
BUDGET = float(os.environ.get("MINUTES", "35")) * 60
H = {"x-cron-token": TOKEN}
S = requests.Session()
S.headers["User-Agent"] = "PakDhartiTV-PeopleLibrary/1.0 (news site; https://pak-dharti-tv.vercel.app; contact via site)"
def head_box(im, session):
    """(x, y, w) of the head in im, from the person mask: the top of the mask is the top of the head,
    the head's width is the mask width a little below the top. None when no person is found."""
    small = im.copy(); small.thumbnail((640, 640))
    m = np.array(remove(small, session=session, only_mask=True)) > 128
    if m.mean() < 0.03: return None
    rows = np.where(m.any(axis=1))[0]
    top, bot = rows[0], rows[-1]
    hgt = bot - top
    widths = []
    for frac in (0.06, 0.09, 0.12):
        r = m[min(bot, top + int(hgt * frac))]
        xs = np.where(r)[0]
        if len(xs): widths.append((xs[-1] - xs[0], (xs[0] + xs[-1]) / 2))
    if not widths: return None
    w, cx = sorted(widths)[len(widths) // 2]
    k = im.width / small.width
    w = max(w, small.width * 0.06)
    return cx * k, top * k, w * k


def cut(img_bytes, session):
    im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    im.thumbnail((2000, 2000))
    head = head_box(im, session)
    if head is None: return "noface"
    cx, ty, w = head
    if w < im.width * 0.06: return "noface"           # a crowd / far away: not usable as a portrait
    # head-and-shoulders box under the top of the head
    left, right = max(0, int(cx - 1.75 * w)), min(im.width, int(cx + 1.75 * w))
    top, bottom = max(0, int(ty - 0.25 * w)), min(im.height, int(ty + 3.4 * w))
    crop = im.crop((left, top, right, bottom))
    out = remove(crop, session=session, alpha_matting=True, alpha_matting_foreground_threshold=240,
                 alpha_matting_background_threshold=12, alpha_matting_erode_size=8, post_process_mask=True)
    a = np.array(out.getchannel("A")).astype(np.float32)
    if (a > 128).mean() < 0.12: return None            # the model found almost nothing
    # keep only the main person: the connected shape under the head (other people, hands, cushions drop out)
    try:
        from scipy import ndimage
        lab, n = ndimage.label(ndimage.binary_dilation(a > 60, iterations=2))
        if n > 1:
            hx = int(min(a.shape[1] - 1, max(0, cx - left))); hy = int(min(a.shape[0] - 1, max(0, (ty - top) + 0.6 * w)))
            keep = lab[hy, hx] or np.bincount(lab.ravel())[1:].argmax() + 1
            a[lab != keep] = 0
    except Exception as e:  # noqa
        print("component filter skipped", e)
    # soft fade over the bottom 14% of the crop (no ragged cut at the chest)
    hh = a.shape[0]; f0 = int(hh * 0.86)
    ramp = np.ones(hh, dtype=np.float32); ramp[f0:] = np.linspace(1, 0, hh - f0) ** 1.4
    a = a * ramp[:, None]
    out.putalpha(Image.fromarray(a.clip(0, 255).astype(np.uint8)))
    box = out.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    if not box: return None
    out = out.crop(box)
    out.thumbnail((1200, 1500))
    buf = io.BytesIO()
    out.save(buf, "WEBP", quality=92, method=6)
    return buf.getvalue(), out.width, out.height


def fetch(url):
    for i in range(3):
        r = S.get(url, timeout=60)
        if r.status_code == 429: time.sleep(10 * (i + 1)); continue
        r.raise_for_status()
        if not r.headers.get("content-type", "").startswith("image/"): raise ValueError("not an image")
        return r.content
    raise ValueError("busy (429)")


def main():
    start = time.time()
    session = new_session("u2net_human_seg")
    done = failed = noface = 0
    while time.time() - start < BUDGET:
        items = S.get(f"{SITE}/api/cron/people?op=needs-cutout&limit=20", headers=H, timeout=60).json().get("items", [])
        if not items: break
        for it in items:
            if time.time() - start > BUDGET: break
            body = {"person": it["person"], "url": it["url"]}
            try:
                u = it["url"] if it["url"].startswith("http") else SITE + it["url"]   # handouts are stored on the site
                res = cut(fetch(u), session)
                if res == "noface": body.update({"failed": True, "noface": True}); noface += 1
                elif res:
                    data, w, h = res
                    body.update({"data": base64.b64encode(data).decode(), "type": "image/webp", "width": w, "height": h})
                else:
                    body["failed"] = True
            except Exception as e:  # noqa
                print("failed", it["name"], e)
                body["failed"] = True
            try:
                S.post(f"{SITE}/api/cron/people?op=cutout", json=body, headers=H, timeout=60)
            except Exception as e:  # noqa
                print("post failed", e)
            if body.get("failed"): failed += 1
            else: done += 1
            time.sleep(1.0)
    msg = f"cut-outs made: {done}, could not cut: {failed} (no face / not a portrait: {noface}), minutes: {round((time.time() - start) / 60, 1)}"
    print(msg)
    print(f"::notice title=cutouts::{msg}")


if __name__ == "__main__":
    main()
