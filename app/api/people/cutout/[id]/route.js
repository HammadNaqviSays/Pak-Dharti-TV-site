// Serves a person's cut-out (transparent background) for the card designs.
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PersonCutout } from "@/models";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return new Response("Not found", { status: 404 });
  await connectDB();
  const c = await PersonCutout.findById(id); // hydrated: c.data is a real Buffer
  const headers = { "Content-Type": c?.type || "image/webp", "Cache-Control": "public, max-age=31536000, immutable" };
  if (c?.blobUrl) {
    const r = await fetch(c.blobUrl);
    if (!r.ok) return new Response("Not found", { status: 404 });
    return new Response(r.body, { headers });
  }
  if (!c?.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(c.data), { headers });
}
