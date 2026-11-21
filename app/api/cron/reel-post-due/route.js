// GET /api/cron/reel-post-due — posts the reels whose scheduled time has come (one reel per call, all its places one after the other).
// A place that fails is tried again on the next ticks (3 tries in all), the places that went through are never repeated.
import { NextResponse } from "next/server";
import { isCron } from "@/lib/util";
import { connectDB } from "@/lib/db";
import { Reel } from "@/models";
import { PLATFORMS, postReelTo, keysPresent } from "@/lib/reelPublish";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const reel = await Reel.findOneAndUpdate(
    { postAt: { $lte: new Date() }, $or: [{ postLock: null }, { postLock: { $lt: new Date(Date.now() - 10 * 60000) } }] },
    { $set: { postLock: new Date() } }, { sort: { postAt: 1 }, new: true });
  if (!reel) return NextResponse.json({ due: 0 });
  const keys = keysPresent(), out = {};
  for (const p of Object.keys(PLATFORMS)) {
    if (!keys[p] || reel.posts?.[p]?.at) continue;
    const r = await postReelTo(reel, p); out[p] = r.msg;
  }
  const left = Object.keys(PLATFORMS).filter((p) => keys[p] && !reel.posts?.[p]?.at);
  const tries = (reel.postTries || 0) + 1;
  const errs = Object.values(out).filter((m) => m.startsWith("❌")).join(" | ").slice(0, 300);
  if (!left.length || tries >= 3) await Reel.updateOne({ _id: reel._id }, { $set: { postAt: null, postLock: null, postTries: tries, postErr: left.length ? errs : "" } });
  else await Reel.updateOne({ _id: reel._id }, { $set: { postLock: null, postTries: tries, postErr: errs } });
  return NextResponse.json({ reel: String(reel._id), out, left, tries });
}
