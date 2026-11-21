// GET /api/reels/<id>/audio|video — serves a reel file kept in the database (with Range, so players can seek).
import { readReelFile } from "@/lib/reelMedia";
import { freshDB } from "@/lib/db";
import { Reel, Article } from "@/models";
import { reelsBucket } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { id, kind } = await params;
  if (!/^[a-f0-9]{24}$/.test(id) || !/^(audio|video|clip\d{1,2}|pic\d{1,2}(x[1-3])?|stk\d{1,2}|web|poster)$/.test(kind)) return new Response("Not found", { status: 404 });
  // finished videos (and the light website copy / poster) are in R2: streamed straight from there, with Range, nothing loaded into memory
  if (kind === "video" || kind === "web" || kind === "poster") {
    const b = await reelsBucket();
    if (b) {
      const key = `${id}/${kind === "web" ? "web.mp4" : kind === "poster" ? "poster.jpg" : "video.mp4"}`;
      const head = await b.head(key);
      if (head) {
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
        const size = head.size;
        const ct = kind === "poster" ? "image/jpeg" : "video/mp4";
        const dlq = new URL(req.url).searchParams.get("download");
        if (kind === "video" && dlq) { try { const r = await Reel.findById(id).select("slug").lean(); if (r?.slug) await Article.updateOne({ slug: r.slug }, { $set: { "reel.dlAt": new Date() } }); } catch {} }
        const h = { "content-type": ct, "accept-ranges": "bytes", "cache-control": kind === "video" ? "private, max-age=3600" : "public, max-age=86400", "content-disposition": dlq ? `attachment; filename="pak-dharti-reel-${id.slice(-6)}.mp4"` : "inline" };
        if (m && (m[1] || m[2])) {
          const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2] || 0));
          const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
          if (start > end || start >= size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
          const o = await b.get(key, { range: { offset: start, length: end - start + 1 } });
          return new Response(o.body, { status: 206, headers: { ...h, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
        }
        const o = await b.get(key);
        return new Response(o.body, { headers: { ...h, "content-length": String(size) } });
      }
    }
    if (kind === "web" || kind === "poster") return new Response("Not found", { status: 404 });
  }
  if (kind === "audio") freshDB();   // the video machine asks for it right after the work of another call: use a connection of this request
  const buf = await readReelFile(id, kind);
  if (!buf) return new Response("Not found", { status: 404 });
  const type = kind === "video" || kind.startsWith("clip") ? "video/mp4" : kind === "audio" ? "audio/wav" : "image/jpeg";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  if (kind === "video" && new URL(req.url).searchParams.get("download")) {
    try { const r = await Reel.findById(id).select("slug").lean(); if (r?.slug) await Article.updateOne({ slug: r.slug }, { $set: { "reel.dlAt": new Date() } }); } catch {}
  }
  const dl = new URL(req.url).searchParams.get("download") ? `attachment; filename="pak-dharti-reel-${id.slice(-6)}.mp4"` : "inline";
  const h = { "content-type": type, "content-disposition": dl, "accept-ranges": "bytes", "cache-control": "private, max-age=3600" };
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, buf.length - Number(m[2] || 0));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${buf.length}` } });
    return new Response(buf.subarray(start, end + 1), { status: 206, headers: { ...h, "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": String(end - start + 1) } });
  }
  return new Response(buf, { headers: { ...h, "content-length": String(buf.length) } });
}
