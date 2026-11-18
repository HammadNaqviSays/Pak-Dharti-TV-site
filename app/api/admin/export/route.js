// GET /api/admin/export?type=articles|daily — CSV export for the analysis notebook
import { connectDB } from "@/lib/db";
import { Article, DailyStat } from "@/models";
import { isAdmin } from "@/lib/util";
import { isLoggedIn } from "@/lib/session";

export const runtime = "nodejs";

const esc = (v) => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCSV = (header, rows) => [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n");

export async function GET(req) {
  if (!isAdmin(req) && !(await isLoggedIn())) return new Response("Unauthorized", { status: 401 });
  const type = new URL(req.url).searchParams.get("type") || "articles";
  await connectDB();

  let csv;
  if (type === "daily") {
    const rows = await DailyStat.find().lean();
    csv = toCSV(["day", "article_id", "lang", "category", "origin", "views"],
      rows.map((r) => ({ ...r, article_id: r.article })));
  } else {
    const rows = await Article.find({}, {
      slug: 1, origin: 1, contentType: 1, category: 1, status: 1, publishedAt: 1, createdAt: 1,
      stats: 1, ai: 1, sources: 1, disclosure: 1, "translations.en.title": 1, "translations.ur.title": 1,
      "translations.ar.title": 1, "translations.de.title": 1,
    }).lean();
    csv = toCSV(
      ["article_id", "slug", "title_en", "origin", "content_type", "category", "status", "created_at", "published_at",
       "views", "views_en", "views_ur", "views_ar", "views_de", "input_tokens", "output_tokens",
       "sources_count", "human_reviewed", "has_ur", "has_ar", "has_de"],
      rows.map((a) => ({
        article_id: a._id, slug: a.slug, title_en: a.translations?.en?.title, origin: a.origin,
        content_type: a.contentType, category: a.category, status: a.status,
        created_at: a.createdAt, published_at: a.publishedAt,
        views: a.stats?.views ?? 0, views_en: a.stats?.byLang?.en ?? 0, views_ur: a.stats?.byLang?.ur ?? 0,
        views_ar: a.stats?.byLang?.ar ?? 0, views_de: a.stats?.byLang?.de ?? 0,
        input_tokens: a.ai?.inputTokens ?? 0, output_tokens: a.ai?.outputTokens ?? 0,
        sources_count: a.sources?.length ?? 0, human_reviewed: !!a.disclosure?.humanReviewed,
        has_ur: !!a.translations?.ur, has_ar: !!a.translations?.ar, has_de: !!a.translations?.de,
      }))
    );
  }
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pakdharti_${type}.csv"`,
    },
  });
}
