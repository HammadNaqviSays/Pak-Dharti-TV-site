"use server";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Reel, Article } from "@/models";
import { shareTags } from "@/lib/caption";
import { SITE } from "@/lib/site";
import { reelsBucket } from "@/lib/r2";
import { facebookReel, instagramReel, threadsVideo, blueskyVideo, videoUrlOf } from "@/lib/reelPost";

const NAMES = { facebook: "Facebook", instagram: "Instagram", threads: "Threads", bluesky: "Bluesky" };

/** Title, caption, hashtags and the story link of one reel, as it will be posted (also shown to copy for TikTok / YouTube / WhatsApp). */
export async function reelTexts(reel, source = "reel") {
  const a = await Article.findOne({ slug: reel.slug }).lean();
  const tags = a ? await shareTags(a, "ur") : "#پاک_دھرتی_ٹی_وی";
  const url = `${SITE.url}/ur/news/${reel.slug}?utm_source=${source}&utm_medium=reel`;
  const title = (reel.title || "").trim(), caption = (reel.caption || "").trim();
  return { title, caption, tags, url, text: `${title}${caption ? `\n\n${caption}` : ""}\n\n${url}\n\n${tags}` };
}

/** One button: post this reel to one platform. Returns { ok, msg }. Posting twice to the same place is refused. */
export async function postReelAction(id, platform) {
  if (!(await isLoggedIn())) return { ok: false, msg: "Login again" };
  if (!NAMES[platform]) return { ok: false, msg: "Unknown place" };
  await connectDB();
  const reel = await Reel.findById(id);
  if (!reel || !["ready", "approved", "posted"].includes(reel.status)) return { ok: false, msg: "Reel is not ready" };
  if (reel.posts?.[platform]?.at) return { ok: false, msg: `Already posted on ${NAMES[platform]}` };
  const b = await reelsBucket();
  const hasWeb = !!(b && await b.head(`${id}/web.mp4`));
  const videoUrl = videoUrlOf(String(reel._id), hasWeb);
  const t = await reelTexts(reel, platform);
  try {
    let ref;
    if (platform === "facebook") ref = await facebookReel({ videoUrl, text: t.text });
    else if (platform === "instagram") ref = await instagramReel({ videoUrl, text: t.text });
    else if (platform === "threads") ref = await threadsVideo({ videoUrl, text: t.text });
    else ref = await blueskyVideo({ videoUrl, text: t.text, title: t.title, url: `${SITE.url}/ur/news/${reel.slug}`, tags: t.tags });
    reel.set(`posts.${platform}`, { at: new Date(), ref: String(ref || "ok") });
    reel.markModified("posts");
    if (reel.status !== "posted") { reel.status = "posted"; reel.postedAt = new Date(); }
    await reel.save();
    revalidatePath("/admin/reels");
    return { ok: true, msg: `✅ ${NAMES[platform]} par post ho gaya` };
  } catch (e) { return { ok: false, msg: `❌ ${NAMES[platform]}: ${String(e.message).slice(0, 160)}` }; }
}

/** Texts for the copy box (TikTok, YouTube, WhatsApp channel). */
export async function reelTextsAction(id) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  await connectDB();
  const reel = await Reel.findById(id).lean();
  if (!reel) return { error: "Not found" };
  return await reelTexts(reel, "share");
}
