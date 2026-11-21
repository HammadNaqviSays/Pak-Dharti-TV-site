import { connectDB } from "@/lib/db";
import { Article, LANGS } from "@/models";
import { SITE } from "@/lib/site";
import { DICT } from "@/lib/i18n";

// RSS 2.0 feed of the latest stories, one per language: /en/feed.xml and /ur/feed.xml
export const revalidate = 600;

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function GET(_req, { params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return new Response("Not found", { status: 404 });
  let items = [];
  try {
    await connectDB();
    const arts = await Article.find({ status: "published" }, { slug: 1, image: 1, "social.ur.ogCard": 1, "social.en.ogCard": 1, "social.ur.card": 1, "social.en.card": 1, category: 1, publishedAt: 1, updatedAt: 1, "translations.en.title": 1, "translations.en.summary": 1, "translations.ur.title": 1, "translations.ur.summary": 1, "translations.en.metaDescription": 1, "translations.ur.metaDescription": 1 }).sort({ publishedAt: -1 }).limit(60).lean();
    for (const a of arts) {
      const t = a.translations?.[lang];
      if (!t?.title || (a.category === "poetry" && lang !== "ur")) continue;
      const link = `${SITE.url}/${lang}/news/${a.slug}`;
      // the picture of the item (Pinterest takes it for the pin): the news card of the story when it exists, else the story photo
      const cid = a.social?.[lang]?.ogCard || a.social?.[lang]?.card;
      const pic = cid ? `${SITE.url}/api/media/${cid}` : (a.image?.url ? (a.image.url.startsWith("http") ? a.image.url : `${SITE.url}${a.image.url}`) : "");
      const media = pic ? `<enclosure url="${esc(pic)}" type="image/jpeg" length="0"/><media:content url="${esc(pic)}" medium="image" type="image/jpeg"/>` : "";
      items.push(`<item><title>${esc(t.title)}</title><link>${esc(link)}</link><guid isPermaLink="true">${esc(link)}</guid><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate><category>${esc(DICT[lang].cats?.[a.category] || a.category)}</category><description>${esc(t.summary || t.metaDescription || "")}</description>${media}</item>`);
      if (items.length >= 40) break;
    }
  } catch {}
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>${esc(DICT[lang].site)}</title><link>${SITE.url}/${lang}</link><atom:link href="${SITE.url}/${lang}/feed.xml" rel="self" type="application/rss+xml"/><description>${esc(lang === "ur" ? "پاکستان اور دنیا کی تازہ ترین خبریں" : "Latest news from Pakistan and the world")}</description><language>${lang}</language>${items.join("")}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } });
}
