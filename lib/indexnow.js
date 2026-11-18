// IndexNow: tells Bing (and other IndexNow search engines) the moment a story is published, so it is found in minutes, not weeks.
// The key is public by design: it only proves this site owns the file served at /indexnow-key.txt.
import { connectDB } from "./db";
import { Article } from "@/models";
import { SITE } from "./site";
import { isThinForSearch } from "./indexGate";

export const INDEXNOW_KEY = "43eda42b4f792dc80d42806f68153387";

/** Sends the stories published in the last 6 hours that were not sent yet. Safe to call often. */
export async function pingRecent() {
  await connectDB();
  const arts = await Article.find({ status: "published", publishedAt: { $gte: new Date(Date.now() - 6 * 3600e3) }, "social.indexnow": { $ne: true } }, { slug: 1, category: 1, translations: 1, visual: 1 }).limit(60).lean();
  const ok = arts.filter((a) => a.category !== "poetry" && !isThinForSearch(a));
  const urls = ok.flatMap((a) => ["en", "ur"].filter((l) => a.translations?.[l]?.title).map((l) => `${SITE.url}/${l}/news/${a.slug}`));
  if (!urls.length) return { sent: 0 };
  const host = new URL(SITE.url).host;
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE.url}/indexnow-key.txt`, urlList: urls.slice(0, 200) }),
    signal: AbortSignal.timeout(6000),
  });
  if (r.status >= 200 && r.status < 300) await Article.updateMany({ _id: { $in: arts.map((a) => a._id) } }, { $set: { "social.indexnow": true } });
  return { sent: urls.length, status: r.status };
}
