// POST /api/track { slug, lang } — counts one human page view (feeds the analytics)
import { connectDB } from "@/lib/db";
import { Article, DailyStat, LANGS } from "@/models";

export const runtime = "nodejs";
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i;

export async function POST(req) {
  if (BOT.test(req.headers.get("user-agent") || "")) return new Response(null, { status: 204 });
  const { slug, lang } = await req.json().catch(() => ({}));
  if (typeof slug !== "string" || slug.length > 120 || !LANGS.includes(lang)) {
    return new Response(null, { status: 400 });
  }
  await connectDB();
  const a = await Article.findOneAndUpdate(
    { slug, status: "published" },
    { $inc: { "stats.views": 1, [`stats.byLang.${lang}`]: 1 } },
    { projection: { _id: 1, category: 1, origin: 1 } }
  );
  if (!a) return new Response(null, { status: 404 });

  const day = new Date().toISOString().slice(0, 10);
  await DailyStat.updateOne(
    { day, article: a._id, lang },
    { $inc: { views: 1 }, $setOnInsert: { category: a.category, origin: a.origin } },
    { upsert: true }
  );
  return new Response(null, { status: 204 });
}
