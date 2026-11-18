// GET /api/cron/ingest  —  cheap step: pull RSS feeds into SourceItem (call every 20 min)
import { NextResponse } from "next/server";
import { ingestFeeds } from "@/lib/autopilot";
import { isCron } from "@/lib/util";
import { updateFuelFromNews } from "@/lib/fuel";
import { updateGoldFromNews } from "@/lib/goldNews";
import { intlGoldTola } from "@/lib/rates";
import { getOil } from "@/lib/oil";
import { fetchIndex } from "@/lib/psx";
import { connectDB } from "@/lib/db";
import { Setting } from "@/models";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const feeds = await ingestFeeds();
  let fuel = null;
  try { fuel = await updateFuelFromNews(); } catch {}
  try { await updateGoldFromNews({ intlTola24: await intlGoldTola() }); } catch {}
  try { await getOil(); } catch {}
  // KSE-100: refresh the stored value every run (the daily card reads it)
  let kse;
  try {
    const v = await fetchIndex();
    await connectDB(); await Setting.updateOne({ key: "kse100" }, { $set: { value: v } }, { upsert: true });
    kse = { day: v.day, open: v.open, close: v.close, change: v.change, pct: v.pct, raw: v.raw };
  } catch (e) { kse = { error: e.message }; }
  return NextResponse.json({ ok: true, kse, feeds, fuel: fuel?.petrol ? { petrol: fuel.petrol, diesel: fuel.diesel } : null });
}
