// The mandi (wholesale market) card: posted as soon as AMIS Punjab shows prices that differ from the ones last posted.
//   GET  /api/cron/mandi        -> { post: true, data } when a new card should be drawn and posted, else { idle, reason }
//   POST /api/cron/mandi        -> body = the PNG drawn by the GitHub job; saves it and posts it to Facebook + Instagram
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Setting, Media } from "@/models";
import { socialConfig } from "@/lib/autosocial";
import { pageForLang, postFacebook, postInstagram } from "@/lib/social";
import { mandiNow } from "@/lib/mandi";
import { caption } from "@/lib/dailyCaptions";
import { isCron } from "@/lib/util";

export const runtime = "nodejs";
export const maxDuration = 60;

const pkNow = () => new Date(Date.now() + 5 * 3600e3);
const KEY = "mandipost";
const base = () => (process.env.SITE_URL || "https://www.pakdhartitv.com").replace(/\/$/, "");

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const cfg = await socialConfig();
    if (!cfg.auto) return NextResponse.json({ idle: true, reason: "off" });
    const t = pkNow(), hour = t.getUTCHours(), day = t.toISOString().slice(0, 10);
    if (hour < 7 || hour >= 21) return NextResponse.json({ idle: true, reason: "outside 07:00-21:00" });
    const st = (await Setting.findOne({ key: KEY }).lean())?.value || {};
    if (st.day === day && (st.done || (st.tries || 0) >= 3)) return NextResponse.json({ idle: true, reason: "already posted today" });
    if (st.day === day && !st.done && st.at && Date.now() - st.at < 20 * 60e3) return NextResponse.json({ idle: true, reason: "a post is in progress" });
    const m = await mandiNow();
    const sig = JSON.stringify(m.prices);
    if (st.sig === sig) return NextResponse.json({ idle: true, reason: "prices not changed since the last post" });
    await Setting.updateOne({ key: KEY }, { $set: { value: { ...st, day, tries: st.day === day ? (st.tries || 0) + 1 : 1, done: false, at: Date.now(), pendingSig: sig } } }, { upsert: true });
    return NextResponse.json({ post: true, day, data: { prices: m.prices, asOf: new Date(m.changedAt || m.fetchedAt).toISOString() } });
  } catch (e) { return NextResponse.json({ idle: true, error: String(e.message).slice(0, 160) }); }
}

export async function POST(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const png = Buffer.from(await req.arrayBuffer());
    if (png.length < 20000) return NextResponse.json({ ok: false, error: "card too small" });
    const st = (await Setting.findOne({ key: KEY }).lean())?.value || {};
    const day = pkNow().toISOString().slice(0, 10);
    const sharp = (await import("sharp")).default;     // Instagram accepts JPEG only
    const jpg = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    const m = await Media.create({ data: jpg, type: "image/jpeg", size: jpg.length, credit: `Auto mandi card ${day}` });
    const imageUrl = `${base()}/api/media/${m._id}`;
    const page = pageForLang("ur");
    if (!page) return NextResponse.json({ ok: false, error: "no page" });
    const d = { mandi: { prices: (await Setting.findOne({ key: "mandi" }).lean())?.value?.prices, asOf: new Date().toISOString() } };
    const text = caption("mandi", "facebook", d);
    const r = {};
    try { r.fb = (await postFacebook(page, { imageUrl, text })).postId; } catch (e) { r.fbError = String(e.message).slice(0, 160); }
    try { if (page.igUserId) r.ig = (await postInstagram(page, { imageUrl, caption: text })).mediaId; } catch (e) { r.igError = String(e.message).slice(0, 160); }
    const ok = !!(r.fb || r.ig);
    await Setting.updateOne({ key: KEY }, { $set: { value: { ...st, day, done: ok, sig: ok ? st.pendingSig : st.sig, at: Date.now(), result: r } } }, { upsert: true });
    return NextResponse.json({ ok, ...r });
  } catch (e) { return NextResponse.json({ ok: false, error: String(e.message).slice(0, 160) }); }
}
