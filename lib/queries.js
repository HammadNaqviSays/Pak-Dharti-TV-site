import { connectDB } from "./db";
import { Article, Reel } from "@/models";
import { keywords, overlap } from "./dedupe";
import { cleanUrduFields, urduHasForeignScript } from "./urdu";

// Cards only need titles and summaries: leaving the long Markdown body out keeps the homepage query small
// (it was several MB per page view, which is what made the Cloudflare version slow).
const TITLES = Object.fromEntries(["en", "ur", "ar", "de"].flatMap((l) => [[`translations.${l}.title`, 1], [`translations.${l}.summary`, 1]]));
const CARD = { slug: 1, category: 1, contentType: 1, image: 1, publishedAt: 1, ...TITLES, placement: 1, "stats.views": 1 };

export async function getHomepage() {
  const T0 = Date.now();
  await connectDB();
  console.log(`[home] db ready ${Date.now() - T0}ms`);
  const now = new Date();
  const breakingQ = Article.find({
    status: "published",
    "placement.slot": { $in: ["breaking", "featured"] },
    "placement.pinnedUntil": { $gt: now },
    // a pin never holds the top spot for more than 12 hours, so fresh news always comes through
    publishedAt: { $gte: new Date(now.getTime() - 12 * 3600e3) },
  }, CARD).sort({ "placement.priority": -1, publishedAt: -1 }).limit(4).lean();
  const recentQ = Article.find({ status: "published" }, CARD)
    .sort({ publishedAt: -1 }).limit(80).lean();
  const [breaking, recent] = await Promise.all([breakingQ, recentQ]);

  console.log(`[home] queries done ${Date.now() - T0}ms (recent ${recent.length})`);
  const pinnedIds = new Set(breaking.map((b) => String(b._id)));
  const latest = recent.filter((a) => !pinnedIds.has(String(a._id)));

  // Up to 4 stories per section for the category blocks
  const byCategory = {};
  for (const a of recent) {
    (byCategory[a.category] ||= []);
    if (byCategory[a.category].length < 4) byCategory[a.category].push(a);
  }
  // Headlines for the ticker: pinned first, then newest
  const ticker = [...breaking, ...latest].slice(0, 10);

  return { breaking, latest, byCategory, ticker };
}

export async function getCategory(category, limit = 40) {
  await connectDB();
  return Article.find({ status: "published", category }, CARD)
    .sort({ publishedAt: -1 }).limit(limit).lean();
}

export async function getMostRead(limit = 6) {
  await connectDB();
  const since = new Date(Date.now() - 30 * 86400e3);
  return Article.find({ status: "published", publishedAt: { $gte: since } }, { slug: 1, ...TITLES })
    .sort({ "stats.views": -1, publishedAt: -1 }).limit(limit).lean();
}

export async function getTicker() {
  await connectDB();
  return Article.find({ status: "published" }, { slug: 1, ...TITLES })
    .sort({ "placement.priority": -1, publishedAt: -1 }).limit(10).lean();
}

export async function getArticle(slug) {
  await connectDB();
  return Article.findOne({ slug, status: "published" }).lean();
}

/** The approved reel video of a story (kept in R2), or null. Only a small record is read; the video is not touched. */
export async function getReelFor(slug) {
  try {
    await connectDB();
    const r = await Reel.findOne({ slug, status: "approved", r2: true }).sort({ createdAt: -1 }).select("durationSec title").lean();
    return r ? { id: String(r._id), sec: r.durationSec || 0 } : null;
  } catch { return null; }
}

/** Related stories: same-topic first (shared keywords in the headline/summary), then the same category. */
export async function getRelated(article, limit = 4) {
  await connectDB();
  const { category, slug: excludeSlug } = article;
  const pool = await Article.find({ status: "published", slug: { $ne: excludeSlug } }, CARD)
    .sort({ publishedAt: -1 }).limit(150).lean();
  const text = (x) => `${x.translations?.en?.title || ""} ${x.translations?.en?.summary || ""}`;
  const k = keywords(text(article));
  const scored = pool.map((x) => ({ x, s: overlap(k, keywords(text(x))) }));
  const topic = scored.filter((r) => r.s >= 0.25).sort((a, b) => b.s - a.s).map((r) => r.x);
  const picked = topic.slice(0, limit);
  for (const x of pool) {
    if (picked.length >= limit) break;
    if (x.category === category && !picked.includes(x)) picked.push(x);
  }
  return picked;
}

/** Picks the requested language, falling back to English. */
export function pickText(article, lang) {
  const t = lang === "ur" ? cleanUrduFields(article.translations?.ur) : article.translations?.[lang];
  // Already-published Urdu text that contains another script (e.g. Bengali) falls back to English instead of showing it
  if (lang === "ur" && urduHasForeignScript(t)) return { ...article.translations.en, fallback: true };
  return t ? { ...t, fallback: false } : { ...article.translations.en, fallback: lang !== "en" };
}
