// Scheduled rate cards on the Urdu Facebook page + Instagram: prayer times, dollar, gold, KSE, petrol.
// No AI at all (the card is drawn on the server, the caption is fixed text), so it works when Gemini is out of quota.
// Each card is posted once per Pakistan day, inside its time window; a missed run is retried until the window ends.
// Only while Mission Control's automatic posting is ON (same switch as the news posts).
import { connectDB } from "./db";
import { Setting } from "@/models";
import { socialConfig } from "./autosocial";
import { pageForLang, postFacebook, postInstagram } from "./social";
import { cardImageUrl } from "./cardMedia";

// from / to are Pakistan time in minutes since midnight; weekdays: Mon-Fri only (markets are closed at the weekend)
export const SCHEDULE = [
  { kind: "prayer", from: 4 * 60 + 15, to: 10 * 60, head: "🕌 آج کی نماز کے اوقات", tags: "#نماز #اوقات_نماز #PrayerTimes" },
  { kind: "currency", from: 10 * 60, to: 18 * 60, weekdays: true, head: "💱 آج کا ڈالر اور کرنسی ریٹ", tags: "#ڈالر_ریٹ #DollarRate #Pakistan" },
  { kind: "gold", from: 10 * 60 + 30, to: 18 * 60, weekdays: true, head: "🪙 آج سونے کا نرخ", tags: "#سونے_کا_نرخ #GoldRate #Pakistan" },
  { kind: "kse", from: 15 * 60 + 45, to: 22 * 60, weekdays: true, head: "📈 اسٹاک مارکیٹ — کے ایس ای 100", tags: "#PSX #KSE100 #اسٹاک_مارکیٹ" },
  { kind: "fuel", from: 18 * 60, to: 23 * 60, head: "⛽ پیٹرول اور ڈیزل کی قیمتیں", tags: "#پیٹرول #PetrolPrice #Pakistan" },
];

const pkNow = () => new Date(Date.now() + 5 * 3600e3);
const base = () => (process.env.SITE_URL || "https://pakdhartitv.com").replace(/\/$/, "");
const dateUr = () => new Intl.DateTimeFormat("ur-PK", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date());

function captionFor(s) {
  return `${s.head}\n📅 ${dateUr()}\n\nتفصیل کارڈ پر دیکھیں۔ ہر تازہ خبر کے لیے پیج فالو کریں۔\n\n— پاک دھرتی ٹی وی\n${s.tags}`;
}

export async function postRateCards() {
  await connectDB();
  const cfg = await socialConfig();
  if (!cfg.auto) return { idle: true, reason: "off" };
  const page = pageForLang("ur");
  if (!page) return { idle: true, reason: "no page" };
  const t = pkNow(), mins = t.getUTCHours() * 60 + t.getUTCMinutes(), dow = t.getUTCDay(), day = t.toISOString().slice(0, 10);
  const out = [];
  // one rate-card run at a time (a second overlapping run would post the same card again)
  const lockKey = "ratepost:lock";
  try { await Setting.findOneAndUpdate({ key: lockKey, $or: [{ value: { $lt: Date.now() - 240000 } }, { value: { $exists: false } }] }, { key: lockKey, value: Date.now() }, { upsert: true }); }
  catch { return { idle: true, reason: "another run is posting" }; }
  try {
  for (const s of SCHEDULE) {
    if (out.length >= 1) break;
    if (mins < s.from || mins >= s.to) continue;
    if (s.weekdays && (dow === 0 || dow === 6)) continue;
    const key = `ratepost:${s.kind}`;
    const st = (await Setting.findOne({ key }).lean())?.value || {};
    // Facebook took today's card but Instagram did not: Instagram only, never Facebook again, at most 3 tries
    if (st.day === day && st.done && st.igPending && (st.igTries || 0) < 3 && page.igUserId) {
      const iu = await cardImageUrl(s.kind, day, base());
      await Setting.updateOne({ key }, { $set: { "value.igTries": (st.igTries || 0) + 1 } });
      try { const ig = (await postInstagram(page, { imageUrl: iu, caption: captionFor(s) })).mediaId; await Setting.updateOne({ key }, { $set: { "value.igPending": false, "value.ig": ig } }); out.push({ kind: s.kind, igCatchUp: ig }); }
      catch (e) { out.push({ kind: s.kind, igCatchUpError: String(e.message).slice(0, 120) }); }
      continue;
    }
    if (st.day === day && (st.done || (st.tries || 0) >= 3)) continue;
    // shared gap: a card and a story are never posted closer together than the gap (story -> card -> story ...)
    const lastPost = Number((await Setting.findOne({ key: "social:last:ur" }).lean())?.value || 0);
    if (lastPost && Date.now() - lastPost < cfg.gapMin * 60e3) { out.push({ kind: s.kind, idle: "gap" }); break; }
    // a run that started this card and has not finished (crashed or timed out after Facebook took it) is not repeated for 30 minutes
    if (st.day === day && !st.done && st.at && Date.now() - st.at < 30 * 60e3) continue;
    const tries = st.day === day ? (st.tries || 0) + 1 : 1;
    await Setting.updateOne({ key }, { $set: { value: { day, tries, done: false, at: Date.now() } } }, { upsert: true });
    const imageUrl = await cardImageUrl(s.kind, day, base());
    const r = { kind: s.kind };
    const text = captionFor(s);
    try { r.fb = (await postFacebook(page, { imageUrl, text })).postId; } catch (e) { r.fbError = String(e.message).slice(0, 160); }
    // written the moment Facebook accepts the card, before the slower Instagram step
    if (r.fb) await Setting.updateOne({ key }, { $set: { value: { day, tries, done: true, at: Date.now(), result: { kind: s.kind, fb: r.fb } } } });
    try { if (page.igUserId) r.ig = (await postInstagram(page, { imageUrl, caption: text })).mediaId; } catch (e) { r.igError = String(e.message).slice(0, 160); }
    await Setting.updateOne({ key }, { $set: { value: { day, tries, done: !!(r.fb || r.ig), at: Date.now(), result: r, igPending: !!(r.fb && page.igUserId && !r.ig), igTries: 0 } } });
    if (r.fb || r.ig) await Setting.findOneAndUpdate({ key: "social:last:ur" }, { key: "social:last:ur", value: String(Date.now()) }, { upsert: true });
    out.push(r);
  }
  } finally { try { await Setting.updateOne({ key: lockKey }, { value: 0 }); } catch { /* expires by itself */ } }
  const posted = out.filter((x) => !x.idle);
  return posted.length ? { posted } : { idle: true, ...(out.length ? { reason: "gap" } : {}) };
}
