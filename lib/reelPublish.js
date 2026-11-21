// Posting one finished reel to one place (used by the buttons in Mission Control and by the timetable for scheduled reels).
import { Article } from "@/models";
import { shareTags } from "./caption";
import { SITE } from "./site";
import { reelsBucket } from "./r2";
import { facebookReel, instagramReel, threadsVideo, blueskyVideo, videoUrlOf, keysPresent } from "./reelPost";

export const PLATFORMS = { facebook: "Facebook", instagram: "Instagram", threads: "Threads", bluesky: "Bluesky" };

/** Title, caption, hashtags and the story link of one reel, as it will be posted. */
export async function reelTexts(reel, source = "reel") {
  const a = await Article.findOne({ slug: reel.slug }).lean();
  const tags = a ? await shareTags(a, "ur") : "#پاک_دھرتی_ٹی_وی";
  const url = `${SITE.url}/ur/news/${reel.slug}?utm_source=${source}&utm_medium=reel`;
  const title = (reel.title || "").trim(), caption = (reel.caption || "").trim();
  return { title, caption, tags, url, text: `${title}${caption ? `\n\n${caption}` : ""}\n\n${url}\n\n${tags}` };
}

/** Posts the reel (a mongoose document) to one platform and records it. Returns { ok, msg }. Never posts twice to the same place. */
export async function postReelTo(reel, platform) {
  const name = PLATFORMS[platform];
  if (!name) return { ok: false, msg: "Unknown place" };
  if (!["ready", "approved", "posted"].includes(reel.status)) return { ok: false, msg: "The reel is not ready yet" };
  if (reel.posts?.[platform]?.at) return { ok: false, msg: `Already published on ${name}` };
  const b = await reelsBucket();
  const hasWeb = !!(b && await b.head(`${reel._id}/web.mp4`));
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
    return { ok: true, msg: `✅ Published on ${name}` };
  } catch (e) { return { ok: false, msg: `❌ ${name}: ${String(e.message).slice(0, 160)}` }; }
}
export { keysPresent };
