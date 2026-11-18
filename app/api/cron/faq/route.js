// GET /api/cron/faq?n=4 — makes the "quick answers" (Urdu, English, Roman Urdu) for the newest published stories that have none.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { fillFaq } from "@/lib/faq";
import { isCron } from "@/lib/util";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const n = Math.min(8, Math.max(1, Number(new URL(req.url).searchParams.get("n")) || 3));
  try {
    const r = await fillFaq(n, 45000);
    if (r.done) revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e.message).slice(0, 160) }); }
}
