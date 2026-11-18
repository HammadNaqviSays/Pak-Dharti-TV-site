// GET /api/cron/social — post ONE fresh story to Facebook (and Instagram). Its own function, so it has the full 60 seconds:
// before, posting only ran at the tail of the story-writing job and was skipped whenever writing took more than 35 seconds.
import { NextResponse } from "next/server";
import { autoPost } from "@/lib/autosocial";
import { isCron } from "@/lib/util";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, social: await autoPost({ burst: new URL(req.url).searchParams.get("burst") === "1" }) }); }
  catch (e) { return NextResponse.json({ ok: false, error: String(e.message).slice(0, 160) }, { status: 200 }); }
}
