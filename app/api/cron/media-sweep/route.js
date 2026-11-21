// GET /api/cron/media-sweep — moves pictures from MongoDB to R2 (media/<id>), a few per call, then empties the database copy.
// The copy is checked in R2 (size) before the database copy is removed. Called every few minutes by the timetable and, for the first big move, in a loop from GitHub.
import { NextResponse } from "next/server";
import { isCron } from "@/lib/util";
import { connectDB, freshDB, withDB } from "@/lib/db";
import { Media } from "@/models";
import { reelsBucket } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  freshDB();
  const q = new URL(req.url).searchParams;
  const budgetMs = Math.min(40000, Math.max(5000, Number(q.get("ms")) || 25000));
  const t0 = Date.now();
  try {
    const b = await reelsBucket();
    if (!b) return NextResponse.json({ error: "R2 not available" }, { status: 500 });
    await connectDB();
    if (q.get("op") === "count") {
      const left = await withDB(() => Media.countDocuments({ r2: { $ne: true } }));
      return NextResponse.json({ left });
    }
    let moved = 0, bytes = 0, skipped = 0;
    while (Date.now() - t0 < budgetMs) {
      const m = await withDB(() => Media.findOne({ r2: { $ne: true } }, null, { sort: { _id: 1 } }));
      if (!m) break;
      if (!m.data?.length) { await withDB(() => Media.updateOne({ _id: m._id }, { $set: { r2: true } })); skipped++; continue; }
      const buf = Buffer.from(m.data);
      await b.put(`media/${m._id}`, new Uint8Array(buf), { httpMetadata: { contentType: m.type || "image/jpeg" } });
      const head = await b.head(`media/${m._id}`);
      if (!head || head.size !== buf.length) return NextResponse.json({ error: `check failed for ${m._id}`, moved }, { status: 500 });
      await withDB(() => Media.updateOne({ _id: m._id }, { $set: { r2: true }, $unset: { data: 1 } }));
      moved++; bytes += buf.length;
    }
    const left = await withDB(() => Media.countDocuments({ r2: { $ne: true } }));
    return NextResponse.json({ moved, mb: Math.round(bytes / 1048576 * 10) / 10, skipped, left, ms: Date.now() - t0 });
  } catch (e) { return NextResponse.json({ error: String(e.message).slice(0, 200) }, { status: 500 }); }
}
