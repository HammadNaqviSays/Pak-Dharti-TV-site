// "Days in jail" cards. One person per entry; the count is computed from the start date (Pakistan time), so the card is always right.
// Posted every day at 11:00 Pakistan time to Facebook + Instagram (only while Mission Control's automatic posting is ON).
import { connectDB } from "./db";
import { Setting } from "@/models";
import { socialConfig } from "./autosocial";
import { pageForLang, postFacebook, postInstagram } from "./social";
import { cardImageUrl } from "./cardMedia";

// start: first day in custody (the count on that day's anniversary matches the card: 5 Aug 2023 → 9 Nov 2026 = 1192)
export const PEOPLE = [
  { id: "imran", ur: "عمران خان", sinceUr: "5 اگست 2023", start: "2023-08-05", on: true },
];

const pkNow = () => new Date(Date.now() + 5 * 3600e3);
export const pkDay = () => pkNow().toISOString().slice(0, 10);
export function daysSince(start) {
  const t = pkNow();
  return Math.round((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.parse(`${start}T00:00:00Z`)) / 86400e3);
}

const siteBase = () => (process.env.SITE_URL || "https://pakdhartitv.com").replace(/\/$/, "");

function captionFor(p, n) {
  return `${p.ur} کو جیل میں ${n} دن ہو گئے۔\n\n${p.sinceUr} سے قید — اس معاملے کی ہر تازہ خبر پاک دھرتی ٹی وی پر۔\n\n#${p.ur.replace(/\s+/g, "_")} #پاک_دھرتی_ٹی_وی`;
}

export async function postDayCounts() {
  await connectDB();
  const cfg = await socialConfig();
  if (!cfg.auto) return { idle: true, reason: "off" };
  const page = pageForLang("ur");
  if (!page) return { idle: true, reason: "no page" };
  const hour = pkNow().getUTCHours();
  if (hour < 11 || hour >= 20) return { idle: true, reason: "not 11:00 yet" };   // 11:00 Pakistan time; a missed run is retried until 20:00
  const day = pkDay(), out = [];
  for (const p of PEOPLE.filter((x) => x.on)) {
    const key = `daycount:${p.id}`;
    const st = (await Setting.findOne({ key }).lean())?.value || {};
    if (st.day === day && (st.done || (st.tries || 0) >= 3)) continue;
    const tries = st.day === day ? (st.tries || 0) + 1 : 1;
    await Setting.updateOne({ key }, { $set: { value: { day, tries, done: false } } }, { upsert: true });
    const n = daysSince(p.start);
    const imageUrl = await cardImageUrl(`days_${p.id}`, day, siteBase());
    const r = { id: p.id, n };
    try {
      const fb = await postFacebook(page, { imageUrl, text: captionFor(p, n), comment: `روزانہ کی تازہ خبریں اور تفصیل: ${siteBase()}/ur/days` });
      r.fb = fb.postId;
    } catch (e) { r.fbError = String(e.message).slice(0, 160); }
    try {
      if (page.igUserId) r.ig = (await postInstagram(page, { imageUrl, caption: captionFor(p, n) })).mediaId;
    } catch (e) { r.igError = String(e.message).slice(0, 160); }
    await Setting.updateOne({ key }, { $set: { value: { day, tries, done: !!(r.fb || r.ig), result: r } } });
    out.push(r);
  }
  return { posted: out };
}
