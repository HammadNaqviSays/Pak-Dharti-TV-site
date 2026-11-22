"use server";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Article, Reel } from "@/models";
import { prefillPictures } from "@/lib/reelMedia";
import { makeSlug } from "@/lib/util";
import { categoryImage } from "@/lib/images";
import { GUIDE, guideBody } from "@/lib/guideData";

/** Publish one checked information story (English + Urdu) on the site. It is not sent to social media by itself: use the card and reel buttons on its preview page. */
export async function publishGuideAction(key, mode = "publish") {
  try {
    if (!(await isLoggedIn())) return { ok: false, msg: "Login again" };
    const g = GUIDE.find((x) => x.key === key);
    if (!g) return { ok: false, msg: "Unknown entry" };
    freshDB(); await connectDB();
    const tag = `guide:${g.key}`;
    const ex = await Article.findOne({ tags: tag }).select("_id slug status").lean();
    if (ex) {
      if (mode === "publish" && ex.status !== "published") { await Article.updateOne({ _id: ex._id }, { $set: { status: "published", publishedAt: new Date() } }); revalidatePath("/admin/info"); return { ok: true, id: String(ex._id), slug: ex.slug, status: "published", msg: "Published" }; }
      return { ok: true, id: String(ex._id), slug: ex.slug, status: ex.status, msg: ex.status === "published" ? "Already on the site" : "Draft is ready" };
    }
    const tr = (lang) => ({ title: g[lang].title, summary: g[lang].summary, body: guideBody(g, lang), metaDescription: g[lang].summary.slice(0, 155) });
    const a = await Article.create({
      slug: makeSlug(g.en.title), origin: "manual", contentType: "feature", category: "pakistan",
      translations: { en: tr("en"), ur: tr("ur") }, tags: [tag, ...g.tags], image: categoryImage("pakistan"),
      sources: g.sources.map(([name, url]) => ({ name, url })),
      status: mode === "publish" ? "published" : "draft", ...(mode === "publish" ? { publishedAt: new Date() } : {}), disclosure: { aiGenerated: false, humanReviewed: true, reviewedBy: "Pak Dharti TV desk" },
    });
    revalidatePath("/admin/info");
    return { ok: true, id: String(a._id), slug: a.slug, status: a.status, msg: mode === "publish" ? "Published" : "Draft is ready" };
  } catch (e) { return { ok: false, msg: "❌ " + String(e?.message || e).slice(0, 160) }; }
}

/** The hand-written reel script of an entry (checked words, not machine-written): saved as a draft reel; the pictures are looked up, then it is edited and made like any other reel. */
export async function makeGuideReelAction(key) {
  try {
    if (!(await isLoggedIn())) return { ok: false, msg: "Login again" };
    const g = GUIDE.find((x) => x.key === key);
    if (!g?.reel) return { ok: false, msg: "This entry has no video script yet" };
    const p = await publishGuideAction(key, "draft");
    if (!p.ok) return p;
    freshDB(); await connectDB();
    const have = await Reel.findOne({ slug: p.slug, status: { $ne: "rejected" } }, { _id: 1 }).lean();
    if (have) return { ok: true, id: String(have._id), aid: p.id, slug: p.slug, msg: "The video already exists" };
    const r = await Reel.create({ slug: p.slug, lang: "ur", status: "draft", title: g.reel.title, caption: g.reel.caption, scenes: g.reel.scenes.map((x) => ({ text: x.text, kw: x.kw, who: "", src: "" })) });
    await Article.updateOne({ slug: p.slug }, { $set: { "reel.id": String(r._id), "reel.at": new Date() } });
    await prefillPictures(r._id).catch(() => {});
    return { ok: true, id: String(r._id), aid: p.id, slug: p.slug, msg: "The video script is ready: open Admin → Reels" };
  } catch (e) { return { ok: false, msg: "❌ " + String(e?.message || e).slice(0, 160) }; }
}
