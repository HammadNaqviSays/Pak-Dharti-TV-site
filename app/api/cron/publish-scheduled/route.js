// GET /api/cron/publish-scheduled — publishes drafts whose scheduled time has come (columns / guest articles set up in advance).
// Asked by the Cloudflare timetable on every tick (at least every 15-20 minutes). Only drafts with scheduledAt are touched.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { isCron } from "@/lib/util";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const now = new Date();
    const out = [];
    for (;;) {
      const a = await Article.findOneAndUpdate(
        { status: "draft", scheduledAt: { $lte: now } },
        { $set: { status: "published", publishedAt: now }, $unset: { scheduledAt: 1 } },
        { new: true, projection: { slug: 1 } },
      );
      if (!a) break;
      out.push(a.slug);
      if (out.length >= 10) break;
    }
    if (out.length) revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, published: out });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e.message).slice(0, 160) }, { status: 200 }); }
}
