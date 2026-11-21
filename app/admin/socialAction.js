"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article, Media, Setting, SocialQueue } from "@/models";
import { GAP_MS, DAILY_GAP_MS, waitFor, deliver, drainQueue } from "@/lib/socialQueue";
import { socialConfig } from "@/lib/autosocial";
import { pageForLang } from "@/lib/social";
import { deleteOldPosts } from "@/lib/socialReplace";
import { postExtras } from "@/lib/extraSocial";
import { SITE } from "@/lib/site";


/** Which pages are connected (no secrets). */
export async function socialStatusAction() {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  const out = {};
  for (const lang of ["ur", "en"]) {
    const p = pageForLang(lang);
    out[lang] = p ? { name: p.name, fb: !!p.fbPageId, ig: !!p.igUserId, token: !!(p.tokenEnv && process.env[p.tokenEnv]) } : null;
  }
  return out;
}

/** Has this story already gone to Facebook / Instagram (automatically or by hand)? Rate cards ("daily-…") are not tracked. */
async function postedState(slug, lang) {
  if (!slug || slug.startsWith("daily-")) return { fb: false, ig: false, at: null };
  const a = await Article.findOne({ slug }).select("social").lean();
  const sc = a?.social?.[lang] || {};
  return { fb: !!sc.fb, ig: !!sc.ig, at: sc.at || null };
}

/** For the Post-now panel: tells the editor before pressing the button that this story is already out. */
export async function socialStateAction(slug, lang) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  return postedState(String(slug || ""), lang === "en" ? "en" : "ur");
}

/** Send one story to Facebook and/or Instagram. FormData: slug, lang, fb, ig (1/0), fbText, fbComment, igText, card (JPEG file). */
export async function sendSocialAction(fd) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  const lang = fd.get("lang") === "en" ? "en" : "ur";
  const slug = String(fd.get("slug") || "");
  const page = pageForLang(lang);
  if (!page) return { error: `No ${lang === "ur" ? "Urdu" : "English"} page is connected yet.` };
  const wantFb = fd.get("fb") === "1", wantIg = fd.get("ig") === "1";
  if (!wantFb && !wantIg) return { error: "Choose Facebook or Instagram." };
  const file = fd.get("card");
  if (!file || typeof file === "string" || file.type !== "image/jpeg" || file.size < 5000) return { error: "Card image missing." };
  const fbText = String(fd.get("fbText") || "").trim(), igText = String(fd.get("igText") || "").trim();
  if ((wantFb && !fbText) || (wantIg && !igText)) return { error: "Post text is empty." };

  await connectDB();
  // already posted? say so and stop, unless the editor ticked "post anyway" (e.g. the old post was deleted)
  const replace = fd.get("replace") === "1";
  const force = fd.get("force") === "1" || replace;
  let removed = null;
  if (replace && slug && !slug.startsWith("daily-")) removed = await deleteOldPosts(slug, lang);   // Facebook, Threads, Bluesky: the old posts go first
  const was = replace ? { fb: false, ig: false, at: null } : await postedState(slug, lang);
  const dup = [wantFb && was.fb && "Facebook", wantIg && was.ig && "Instagram"].filter(Boolean);
  if (dup.length && !force) {
    return { duplicate: true, error: `This story is already on ${dup.join(" and ")}${was.at ? ` (posted ${new Date(was.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })} Pakistan time)` : ""}. Tick "Post anyway" if you really want it posted again.` };
  }
  const m = await Media.create({ data: Buffer.from(await file.arrayBuffer()), type: "image/jpeg", size: file.size, credit: `Social card ${slug}` });
  const item = { lang, slug, wantFb, wantIg, fbText, fbComment: String(fd.get("fbComment") || "").trim(), igText };
  const ahead = await SocialQueue.countDocuments({ lang, status: { $in: ["queued", "posting"] } });
  if (ahead && await SocialQueue.exists({ lang, slug, status: { $in: ["queued", "posting"] } })) return { error: "This story is already waiting in the posting queue." };
  const wait = await waitFor(lang, slug);
  // too early, or others are already waiting: join the queue (first in, first out); it goes out by itself when the gap is over
  if (!replace && (wait > 0 || ahead > 0)) {
    await SocialQueue.create({ ...item, media: String(m._id), status: "queued" });
    const waits = ahead ? ahead * GAP_MS + wait : wait;
    return { queued: true, position: ahead + 1, etaMin: Math.max(1, Math.ceil(waits / 60000)), etaAt: Date.now() + waits };
  }
  const res = await deliver({ ...item, mediaId: String(m._id) });
  if (replace) return { ...res, replaced: removed, ...(await replaceExtras(slug, lang, String(m._id))) };
  return res;
}

/** The new card also goes to Threads and Bluesky (when the old posts were replaced). */
async function replaceExtras(slug, lang, mediaId) {
  try {
    const a = await Article.findOne({ slug }).lean();
    if (!a) return {};
    const base = SITE.url;
    const ex = await postExtras({ title: a.translations?.[lang]?.title || "", summary: a.translations?.[lang]?.summary || "", url: `${base}/${lang}/news/${a.slug}`, imageUrl: `${base}/api/media/${mediaId}`, tags: (a.socialTags?.[lang] || []).map((x) => `#${String(x).replace(/[#\s]+/g, "")}`).join(" ") }, ["bluesky", "threads"]);
    const mark = {};
    if (ex.bluesky?.ok) { mark[`social.${lang}.bsky`] = true; mark[`social.${lang}.bskyUri`] = ex.bluesky.uri || ""; }
    if (ex.threads?.ok) { mark[`social.${lang}.th`] = true; mark[`social.${lang}.thId`] = ex.threads.id || ""; }
    if (Object.keys(mark).length) await Article.updateOne({ slug }, { $set: mark });
    return { extra: { bluesky: ex.bluesky || null, threads: ex.threads || null } };
  } catch (e) { return { extra: { error: String(e.message).slice(0, 120) } }; }
}

/** The waiting posts (oldest first) with the minutes still to wait; opening the panel also sends the next one if its time has come. */
export async function socialQueueAction() {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  await drainQueue();
  const rows = await SocialQueue.find({ status: { $in: ["queued", "posting"] } }).sort({ createdAt: 1 }).lean();
  const recent = await SocialQueue.find({ status: { $in: ["done", "failed"] }, updatedAt: { $gte: new Date(Date.now() - 3 * 3600e3) } }).sort({ updatedAt: -1 }).limit(5).lean();
  const wait = {};
  for (const l of ["ur", "en"]) wait[l] = await waitFor(l, "x");
  let n = { ur: 0, en: 0 };
  const list = rows.map((r) => { const ms = n[r.lang] * GAP_MS + (r.status === "posting" ? 0 : wait[r.lang]); n[r.lang] += 1; return { id: String(r._id), slug: r.slug, lang: r.lang, status: r.status, fb: r.wantFb, ig: r.wantIg, etaSec: Math.round(ms / 1000), etaAt: Date.now() + ms }; });
  return { list, recent: recent.map((r) => ({ id: String(r._id), slug: r.slug, status: r.status, error: r.error || "" })) };
}

export async function cancelQueuedPostAction(id) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  await SocialQueue.updateOne({ _id: String(id), status: "queued" }, { $set: { status: "cancelled" } });
  return { ok: true };
}

/** Save the automatic-posting switch and limits (Mission Control). */
export async function saveSocialConfigAction(auto, maxPerDay, gapMin, fromHour = 6, toHour = 23) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const from = Math.min(23, Math.max(0, Math.round(Number(fromHour)) || 0)), to = Math.min(24, Math.max(1, Math.round(Number(toHour)) || 23));
  const value = { auto: !!auto, maxPerDay: Math.min(100, Math.max(1, Math.round(Number(maxPerDay)) || 50)), gapMin: Math.min(120, Math.max(10, Math.round(Number(gapMin)) || 20)), fromHour: from, toHour: Math.max(to, from + 1) };
  await Setting.findOneAndUpdate({ key: "social:config" }, { key: "social:config", value }, { upsert: true });
  return { ok: true, ...value };
}

/** Current switch, limits and how many were posted today (server-side helper for the panel). */
export async function socialPanelData() {
  if (!(await isLoggedIn())) throw new Error("Not logged in");
  await connectDB();
  const cfg = await socialConfig();
  const day = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  const posted = {};
  let last = 0;
  for (const lang of ["ur", "en"]) {
    posted[lang] = Number((await Setting.findOne({ key: `social:day:${lang}:${day}` }).lean())?.value || 0);
    last = Math.max(last, Number((await Setting.findOne({ key: `social:last:${lang}` }).lean())?.value || 0));
  }
  return { ...cfg, posted, last, pages: ["ur", "en"].filter((l) => pageForLang(l)) };
}


/** Send older stories again: the ones posted in the last `hours` hours get a fresh card + caption, newest first, `count` at most.
 *  They are picked by the automatic posting like fresh stories (same gap and daily limit). For posts nobody could see. */
export async function requeueOldPostsAction(hours = 72, count = 10, lang = "ur") {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const h = Math.min(240, Math.max(1, Math.round(Number(hours)) || 72)), n = Math.min(60, Math.max(1, Math.round(Number(count)) || 10));
  const l = lang === "en" ? "en" : "ur";
  const rows = await Article.find({ [`social.${l}.done`]: true, [`social.${l}.at`]: { $gte: new Date(Date.now() - h * 3600e3) } })
    .sort({ [`social.${l}.at`]: -1 }).limit(n).select("_id").lean();
  if (!rows.length) return { ok: true, queued: 0 };
  await Article.updateMany({ _id: { $in: rows.map((r) => r._id) } }, { $set: { [`social.${l}.done`]: false, [`social.${l}.tries`]: 0, [`social.${l}.again`]: true } });
  return { ok: true, queued: rows.length };
}
