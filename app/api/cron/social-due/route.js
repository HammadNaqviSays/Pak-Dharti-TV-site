// GET /api/cron/social-due — a cheap database look: is there anything the GitHub "Social posting" job would post right now?
// The Cloudflare timetable asks this every 15 minutes and starts the (minute-costing) GitHub job only when the answer is yes.
// When in doubt it says yes. Anything it cannot see (mandi, day count, ...) is covered by a fixed run every 2 hours.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Article, Setting, SocialQueue } from "@/models";
import { SCHEDULE } from "@/lib/ratePosts";
import { isCron } from "@/lib/util";

export const runtime = "nodejs";
export const maxDuration = 30;
const FRESH_HOURS = 6;

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectDB();
    const cfg = (await Setting.findOne({ key: "social:config" }).lean())?.value || {};
    if (cfg.auto === false) return NextResponse.json({ due: false, why: "automatic posting is off" });
    const now = new Date(Date.now() + 5 * 3600e3), hour = now.getUTCHours(), mins = hour * 60 + now.getUTCMinutes(), dow = now.getUTCDay(), day = now.toISOString().slice(0, 10);
    const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== null ? Number(v) : d);

    if (await SocialQueue.exists({ status: { $in: ["queued", "posting"] } })) return NextResponse.json({ due: true, why: "hand-made posts waiting" });
    if (await Article.exists({ $or: [{ "social.ur.igPending": true }, { "social.ur.fbPending": true }], "social.ur.at": { $gte: new Date(Date.now() - 24 * 3600e3) } })) return NextResponse.json({ due: true, why: "catch-up pending" });

    // a rate card whose time has come and that is not yet posted today
    for (const s of SCHEDULE) {
      if (mins < s.from || mins >= s.to) continue;
      if (s.weekdays && (dow === 0 || dow === 6)) continue;
      const st = (await Setting.findOne({ key: `ratepost:${s.kind}` }).lean())?.value || {};
      if (st.day === day && st.done && !(st.igPending && (st.igTries || 0) < 3)) continue;
      if (st.day === day && (st.tries || 0) >= 3) continue;
      if (st.day === day && !st.done && st.at && Date.now() - st.at < 30 * 60e3) continue;
      return NextResponse.json({ due: true, why: `rate card ${s.kind}` });
    }

    // a fresh story, inside the posting hours, with the gap and the daily limit respected
    const from = num(cfg.fromHour, 6), to = num(cfg.toHour, 23), gapMin = num(cfg.gapMin, 14), maxDay = num(cfg.maxPerDay, 50);
    if (hour >= from && hour < to) {
      const last = (await Setting.findOne({ key: "social:last:ur" }).lean())?.value;
      const gapOk = !last || Date.now() - Number(last) >= gapMin * 60e3;
      const dayN = Number((await Setting.findOne({ key: `social:day:ur:${day}` }).lean())?.value || 0);
      if (gapOk && dayN < maxDay) {
        const base = { status: "published", $or: [{ origin: "auto", contentType: "news" }, { autoSocial: true }], "translations.ur.title": { $exists: true, $ne: "" }, "social.ur.done": { $ne: true }, "social.ur.tries": { $not: { $gte: 2 } } };
        if (await Article.exists({ ...base, publishedAt: { $gte: new Date(Date.now() - FRESH_HOURS * 3600e3) } })) return NextResponse.json({ due: true, why: "fresh story" });
        if (await Article.exists({ ...base, "social.ur.again": true })) return NextResponse.json({ due: true, why: "story to send again" });
      }
    }
    return NextResponse.json({ due: false, why: "nothing to post" });
  } catch (e) { return NextResponse.json({ due: true, why: "check failed, running anyway", error: String(e.message).slice(0, 120) }); }
}
