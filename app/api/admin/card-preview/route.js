// Mission Control only: draws the real server card for a story, with the look settings from the query (nothing is saved).
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { cardForArticle } from "@/lib/autosocial";
import { normLook } from "@/lib/cardLook";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  if (!(await isLoggedIn())) return new Response("Not logged in", { status: 401 });
  const q = new URL(req.url).searchParams;
  await connectDB();
  const a = await Article.findOne({ slug: q.get("slug") || "", status: "published" }).lean();
  if (!a) return new Response("Story not found", { status: 404 });
  const base = (process.env.SITE_URL || "https://pakdhartitv.com").replace(/\/$/, "");
  try {
    const { card } = await cardForArticle(a, q.get("lang") === "en" ? "en" : "ur", base, normLook(Object.fromEntries(q)));
    return new Response(new Uint8Array(card), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response(`Could not draw the card: ${e.message}`, { status: 500 });
  }
}
