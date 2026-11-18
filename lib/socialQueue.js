// Hand-made posts that came too early wait here and go out one by one (first in, first out) when the gap after the last post is over.
import { connectDB } from "./db";
import { Article, Setting, SocialQueue } from "@/models";
import { pageForLang, postFacebook, postInstagram } from "./social";

export const GAP_MS = 15 * 60 * 1000;        // one post per page every 15 minutes
export const DAILY_GAP_MS = 3 * 60 * 1000;   // the daily rate cards (dollar, gold, petrol…) may follow after 3 minutes
export const gapFor = (slug) => (String(slug || "").startsWith("daily-") ? DAILY_GAP_MS : GAP_MS);

/** Milliseconds until a post of this page may go out (0 = now). */
export async function waitFor(lang, slug) {
  const last = await Setting.findOne({ key: `social:last:${lang}` }).lean();
  return last?.value ? Math.max(0, gapFor(slug) - (Date.now() - Number(last.value))) : 0;
}

/** Posts one story now and remembers it. Returns { fb, ig }. */
export async function deliver({ lang, slug, wantFb, wantIg, mediaId, fbText, fbComment, igText }) {
  const page = pageForLang(lang);
  if (!page) return { fb: { error: "No page connected" }, ig: null };
  const base = (process.env.SITE_URL || "https://pakdhartitv.com").replace(/\/$/, "");
  const imageUrl = `${base}/api/media/${mediaId}`;
  const result = { fb: null, ig: null };
  try { if (wantFb) result.fb = await postFacebook(page, { imageUrl, text: fbText, comment: fbComment || "" }); }
  catch (e) { result.fb = { error: String(e.message).slice(0, 200) }; }
  try { if (wantIg) result.ig = await postInstagram(page, { imageUrl, caption: igText }); }
  catch (e) { result.ig = { error: String(e.message).slice(0, 200) }; }
  if ((result.fb && !result.fb.error) || (result.ig && !result.ig.error)) {
    await Setting.findOneAndUpdate({ key: `social:last:${lang}` }, { key: `social:last:${lang}`, value: String(Date.now()) }, { upsert: true });
    if (slug && !slug.startsWith("daily-")) {
      const set = { [`social.${lang}.done`]: true, [`social.${lang}.at`]: new Date(), [`social.${lang}.again`]: false };
      if (result.fb && !result.fb.error) set[`social.${lang}.fb`] = result.fb.postId || "manual";
      if (result.ig && !result.ig.error) set[`social.${lang}.ig`] = result.ig.mediaId || "manual";
      await Article.updateOne({ slug }, { $set: set });
    }
  }
  return result;
}

/** Sends the OLDEST waiting post of each page if its gap is over (at most one per page per call). */
export async function drainQueue() {
  await connectDB();
  const out = [];
  for (const lang of ["ur", "en"]) {
    const head = await SocialQueue.findOne({ lang, status: { $in: ["queued", "posting"] } }).sort({ createdAt: 1 }).lean();
    if (!head) continue;
    if (head.status === "posting" && head.claimAt && Date.now() - new Date(head.claimAt).getTime() < 4 * 60 * 1000) continue;   // someone is sending it right now
    if ((await waitFor(lang, head.slug)) > 0) continue;                      // too early: the oldest one waits, so the others wait behind it (first in, first out)
    const it = await SocialQueue.findOneAndUpdate(
      { _id: head._id, $or: [{ status: "queued" }, { status: "posting", claimAt: { $lt: new Date(Date.now() - 4 * 60 * 1000) } }] },
      { $set: { status: "posting", claimAt: new Date() } }, { new: true });
    if (!it) continue;
    try {
      const r = await deliver({ lang, slug: it.slug, wantFb: it.wantFb, wantIg: it.wantIg, mediaId: it.media, fbText: it.fbText, fbComment: it.fbComment, igText: it.igText });
      const ok = (r.fb && !r.fb.error) || (r.ig && !r.ig.error);
      await SocialQueue.updateOne({ _id: it._id }, { $set: { status: ok ? "done" : "failed", result: r, postedAt: ok ? new Date() : undefined, error: ok ? "" : String(r.fb?.error || r.ig?.error || "").slice(0, 200) } });
      out.push({ lang, slug: it.slug, ok });
    } catch (e) {
      await SocialQueue.updateOne({ _id: it._id }, { $set: { status: "failed", error: String(e.message).slice(0, 200) } });
      out.push({ lang, slug: it.slug, ok: false });
    }
  }
  return out;
}
