// GET /api/cron/rates — the daily rate cards (prayer times, dollar, gold, KSE, petrol) and the "days in jail" card.
// Started by the GitHub "Social posting" job (the cards need the image library, which cannot run on Cloudflare Workers).
import { NextResponse } from "next/server";
import { postRateCards } from "@/lib/ratePosts";
import { postDayCounts } from "@/lib/daycount";
import { isCron } from "@/lib/util";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const out = {};
  try { out.rates = await postRateCards(); } catch (e) { out.rates = { error: String(e.message).slice(0, 160) }; }
  try { out.days = await postDayCounts(); } catch (e) { out.days = { error: String(e.message).slice(0, 160) }; }
  return NextResponse.json({ ok: true, ...out });
}
