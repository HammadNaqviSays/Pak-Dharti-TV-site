// GET /api/reels/<id>/audio|video — serves a reel file kept in the database (with Range, so players can seek).
import { readReelFile } from "@/lib/reelMedia";
import { Reel, Article } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { id, kind } = await params;
  if (!/^[a-f0-9]{24}$/.test(id) || !/^(audio|video|clip\d{1,2}|pic\d{1,2}(x[1-3])?|stk\d{1,2})$/.test(kind)) return new Response("Not found", { status: 404 });
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
