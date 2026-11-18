// GET /api/media/:id — serves an editor-uploaded photo (stored in MongoDB), cached for a year
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Media } from "@/models";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return new Response("Not found", { status: 404 });
  await connectDB();
  const m = await Media.findById(id); // hydrated: m.data is a real Buffer
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.data), {
    headers: {
      "content-type": m.type,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
