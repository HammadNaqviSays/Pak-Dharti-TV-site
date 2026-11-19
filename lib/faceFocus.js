// Finds the face in a story's picture (with the AI that already reads our pictures) and remembers where it is,
// so a cropped card always starts from the face instead of cutting it off. Pictures without a person are left to the CSS default.
import { connectDB } from "./db";
import { Article } from "@/models";
import { callAI, parseJSON } from "./ai";
import { SITE } from "./site";

const PROMPT = `Look at this picture. If a real person's face is clearly visible, return the box of the most prominent face as JSON only:
{"face":[ymin,xmin,ymax,xmax]} with every number from 0 to 1000 (fractions of the picture height / width, origin top-left).
If there is no clear human face, return {"face":null}. JSON only, no other words.`;

async function fetchPicture(url) {
  const full = url.startsWith("http") ? url : `${SITE.url}${url}`;
  const r = await fetch(full, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`picture ${r.status}`);
  const mime = (r.headers.get("content-type") || "").split(";")[0];
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new Error("not a usable picture");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 4 * 1024 * 1024) throw new Error("picture too large");
  return { data: buf.toString("base64"), mime };
}

/** Face anchor of one picture: { x, y } in percent, or null when there is no face. */
export async function faceAnchor(url) {
  const img = await fetchPicture(url);
  const { text } = await callAI({ prompt: PROMPT, maxTokens: 200, images: [img] });
  const box = parseJSON(text)?.face;
  if (!Array.isArray(box) || box.length !== 4 || box.some((n) => !Number.isFinite(Number(n)))) return null;
  const [y0, x0, y1, x1] = box.map((n) => Math.min(1000, Math.max(0, Number(n))));
  if (y1 <= y0 || x1 <= x0) return null;
  // anchor slightly above the middle of the face so the hair / crown stay in and the chin may go: the face itself must always show
  const cy = (y0 + y1) / 2 / 10, h = (y1 - y0) / 10;
  return { x: Math.round((x0 + x1) / 20), y: Math.round(Math.max(0, cy - h * 0.9)) };
}

/** Looks at the newest published stories whose picture has not been checked yet (a few per run, so the AI quota is spared). */
export async function sweepFocus(limit = 2) {
  await connectDB();
  const list = await Article.find(
    { status: "published", "image.url": { $exists: true, $ne: "" }, "image.focusDone": { $ne: true }, publishedAt: { $gte: new Date(Date.now() - 3 * 86400e3) } },
    { "image.url": 1 },
  ).sort({ publishedAt: -1 }).limit(limit).lean();
  let found = 0, none = 0, failed = 0;
  for (const a of list) {
    try {
      const f = await faceAnchor(a.image.url);
      await Article.updateOne({ _id: a._id }, { $set: f ? { "image.focusX": f.x, "image.focusY": f.y, "image.focusDone": true } : { "image.focusDone": true } });
      f ? found++ : none++;
    } catch {
      failed++;
      await Article.updateOne({ _id: a._id }, { $inc: { "image.focusTries": 1 } });
      await Article.updateOne({ _id: a._id, "image.focusTries": { $gte: 3 } }, { $set: { "image.focusDone": true } });   // give up after 3 tries
    }
  }
  return { checked: list.length, found, none, failed };
}
