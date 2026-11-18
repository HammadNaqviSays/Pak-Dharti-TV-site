// GET  /api/cron/jobs        -> {keys:[...]} source page keys already handled (the collector skips those)
// POST /api/cron/jobs {items} -> reads each official ad, checks it against its own text, saves it (published or draft)
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isCron } from "@/lib/util";
import { ingestMany, knownKeys } from "@/lib/jobs";
import { connectDB } from "@/lib/db";
import { Job } from "@/models";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (new URL(req.url).searchParams.get("recent")) {
    try {
      await connectDB();
      const rows = await Job.find({ status: { $in: ["published", "draft"] } }).sort({ createdAt: -1 }).limit(40).select("status source title org lastDate lastDateText evidence issues positions sourceUrl").lean();
      return NextResponse.json({ ok: true, rows });
    } catch (e) { return NextResponse.json({ ok: false, error: String(e.message).slice(0, 160) }); }
  }
  try { return NextResponse.json({ ok: true, keys: await knownKeys() }); } catch (e) { return NextResponse.json({ ok: false, error: String(e.message).slice(0, 160) }); }
}

export async function POST(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { items } = await req.json();
    if (!Array.isArray(items) || !items.length) return NextResponse.json({ ok: true, none: true });
    const r = await ingestMany(items.slice(0, 6).map((x) => ({ source: String(x.source || ""), sourceName: String(x.sourceName || ""), url: String(x.url || ""), adUrl: x.adUrl ? String(x.adUrl) : "", text: String(x.text || "") })), 45000);
    if (r.published) { revalidatePath("/ur/jobs"); revalidatePath("/en/jobs"); }
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e.message).slice(0, 160) }); }
}
