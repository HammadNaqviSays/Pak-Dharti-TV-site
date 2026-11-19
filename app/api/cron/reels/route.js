// GET /api/cron/reels
//   (no op)      write the script for ONE new reel
//   ?op=prepare  claim one script, make the voice and find pictures → plan for the video machine (GitHub Actions)
//   ?op=done&id=…&sec=…   all pieces of the video are uploaded → status "ready" (you check it in Mission Control)
//   ?op=fail&id=…&err=…         the video machine gave up on this one
import { NextResponse } from "next/server";
import { isCron } from "@/lib/util";
import { makeNextReelScript } from "@/lib/reelScript";
import { prepareNextReel, finishReel, saveReelFile, releaseDrafts } from "@/lib/reelMedia";
import { connectDB } from "@/lib/db";
import { Reel, ReelFile } from "@/models";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const op = q.get("op") || "";
  try {
    if (op === "peek") { await connectDB(); await releaseDrafts(); return NextResponse.json({ waiting: await Reel.countDocuments({ status: "scripted", tries: { $lt: 3 } }) }); }
    if (op === "prepare") return NextResponse.json(await prepareNextReel());
    if (op === "done") return NextResponse.json(await finishReel(q.get("id"), { seconds: q.get("sec"), parts: Number(q.get("parts")) || 0, r2: q.get("r2") === "1" }));
    if (op === "fail") return NextResponse.json(await finishReel(q.get("id"), { error: q.get("err") || "render failed" }));
    const r = await makeNextReelScript();
    return NextResponse.json(r.reel ? { ok: true, slug: r.reel.slug, scenes: r.reel.scenes.length } : r);
  } catch (e) { return NextResponse.json({ error: String(e.message).slice(0, 200) }, { status: 500 }); }
}

// POST ?op=upload&id=…&part=N  (raw bytes of one piece of the video, up to 4 MB)
export async function POST(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const id = q.get("id"), part = Number(q.get("part"));
  if (q.get("op") !== "upload" || !/^[a-f0-9]{24}$/.test(id || "") || !(part >= 0 && part < 60)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length || buf.length > 4 * 1024 * 1024) return NextResponse.json({ error: "bad size" }, { status: 400 });
    if (part === 0) { await connectDB(); await ReelFile.deleteMany({ reel: id, kind: "video" }); }   // a new upload replaces the old one completely
    await saveReelFile(id, "video", part, buf);
    return NextResponse.json({ ok: true, part, bytes: buf.length });
  } catch (e) { return NextResponse.json({ error: String(e.message).slice(0, 200) }, { status: 500 }); }
}
