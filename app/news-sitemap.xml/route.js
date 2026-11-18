import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { SITE } from "@/lib/site";
import { isThinForSearch } from "@/lib/indexGate";

// Google News sitemap: only stories published in the last 2 days, as Google expects.
export const revalidate = 600;

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function GET() {
  let items = [];
  try {
    await connectDB();
    const since = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const arts = await Article.find({ status: "published", publishedAt: { $gte: since } }, { slug: 1, category: 1, publishedAt: 1, updatedAt: 1, "translations.en.title": 1, "translations.en.summary": 1, "translations.ur.title": 1, "translations.ur.summary": 1 })
      .sort({ publishedAt: -1 }).limit(1000).lean();
    for (const a of arts) {
      if (a.category === "poetry" || isThinForSearch(a)) continue;
      for (const l of ["en", "ur"]) {
        const t = a.translations?.[l];
        if (!t?.title) continue;
        items.push(
          `<url><loc>${esc(`${SITE.url}/${l}/news/${a.slug}`)}</loc><news:news><news:publication><news:name>Pak Dharti TV</news:name><news:language>${l}</news:language></news:publication><news:publication_date>${new Date(a.publishedAt).toISOString()}</news:publication_date><news:title>${esc(t.title)}</news:title></news:news></url>`
        );
      }
    }
  } catch {}
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${items.join("")}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } });
}
