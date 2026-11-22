"use server";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Article } from "@/models";
import { makeSlug } from "@/lib/util";
import { categoryImage } from "@/lib/images";
import { GUIDE, guideBody } from "@/lib/guideData";

/** Publish one checked information story (English + Urdu) on the site. It is not sent to social media by itself: use the card and reel buttons on its preview page. */
export async function publishGuideAction(key) {
  try {
    if (!(await isLoggedIn())) return { ok: false, msg: "Login again" };
    const g = GUIDE.find((x) => x.key === key);
    if (!g) return { ok: false, msg: "Unknown entry" };
    freshDB(); await connectDB();
    const tag = `guide:${g.key}`;
    const ex = await Article.findOne({ tags: tag }).select("_id slug status").lean();
    if (ex) return { ok: true, id: String(ex._id), slug: ex.slug, msg: "Already on the site" };
    const tr = (lang) => ({ title: g[lang].title, summary: g[lang].summary, body: guideBody(g, lang), metaDescription: g[lang].summary.slice(0, 155) });
    const a = await Article.create({
      slug: makeSlug(g.en.title), origin: "manual", contentType: "feature", category: "pakistan",
      translations: { en: tr("en"), ur: tr("ur") }, tags: [tag, ...g.tags], image: categoryImage("pakistan"),
      sources: g.sources.map(([name, url]) => ({ name, url })),
      status: "published", publishedAt: new Date(), disclosure: { aiGenerated: false, humanReviewed: true, reviewedBy: "Pak Dharti TV desk" },
    });
    revalidatePath("/admin/info");
    return { ok: true, id: String(a._id), slug: a.slug, msg: "Published" };
  } catch (e) { return { ok: false, msg: "❌ " + String(e?.message || e).slice(0, 160) }; }
}
