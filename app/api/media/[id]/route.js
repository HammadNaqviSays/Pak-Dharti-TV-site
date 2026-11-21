// GET /api/media/:id — serves an editor-uploaded photo or a social card. Pictures live in R2 (media/<id>); the ones not moved yet are still in MongoDB.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Media } from "@/models";
import { reelsBucket } from "@/lib/r2";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return new Response("Not found", { status: 404 });
  const headers = (type) => ({ "content-type": type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" });
  try {
    const b = await reelsBucket();
    if (b) {
      const o = await b.get(`media/${id}`);
      if (o) return new Response(o.body, { headers: headers(o.httpMetadata?.contentType) });
    }
  } catch { /* R2 unavailable: fall back to the database */ }
  await connectDB();
  const m = await Media.findById(id); // hydrated: m.data is a real Buffer
  if (!m || !m.data?.length) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.data), { headers: headers(m.type) });
}
