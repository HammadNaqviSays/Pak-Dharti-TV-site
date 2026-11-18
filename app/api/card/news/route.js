// Preview / public copy of the server-drawn news card of a story: /api/card/news?slug=...&lang=ur
import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { cardForArticle } from "@/lib/autosocial";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  const u = new URL(req.url);
  const slug = u.searchParams.get("slug") || "";
  const lang = u.searchParams.get("lang") === "en" ? "en" : "ur";
  const origin = (process.env.SITE_URL || u.origin).replace(/\/$/, "");
  try {
    await connectDB();
    const a = await Article.findOne(slug ? { slug, status: "published" } : { status: "published", origin: "auto", contentType: "news" }, null, slug ? undefined : { sort: { publishedAt: -1 } })
      .select("slug translations sources image category visual").lean();
    if (!a) return new Response("not found", { status: 404 });
    const { card } = await cardForArticle(a, lang, origin);
    return new Response(card, { headers: { "content-type": "image/jpeg", "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e) {
    return new Response(`card error: ${String(e.message).slice(0, 200)}`, { status: 500 });
  }
}
