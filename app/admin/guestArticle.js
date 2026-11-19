"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article, Media, CATEGORIES } from "@/models";
import { makeSlug } from "@/lib/util";

const OK = ["image/jpeg", "image/png", "image/webp"];
const str = (fd, k, n = 400) => String(fd.get(k) || "").trim().slice(0, n);

async function saveImage(file, credit) {
  if (!file || typeof file !== "object" || !file.size) return null;
  if (!OK.includes(file.type)) throw new Error("Use JPG, PNG or WebP pictures.");
  if (file.size > 4 * 1024 * 1024) throw new Error("A picture is too large (max 4 MB).");
  const m = await Media.create({ data: Buffer.from(await file.arrayBuffer()), type: file.type, size: file.size, credit: credit || "Guest article" });
  return `/api/media/${m._id}`;
}

/** A written article from a guest writer or columnist: both language versions, the writer's name, photo and bio, the picture and its credit. */
export async function publishGuestArticleAction(fd) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  try {
    const titleEn = str(fd, "titleEn", 200), titleUr = str(fd, "titleUr", 200);
    const bodyEn = str(fd, "bodyEn", 60000), bodyUr = str(fd, "bodyUr", 60000);
    if (!titleEn || !bodyEn) return { error: "The English title and the English text are needed (the web address is made from the English title)." };
    if (bodyEn.length < 300) return { error: "The English text is very short." };
    if (!!titleUr !== !!bodyUr) return { error: "Urdu needs both a title and a text (or leave both empty)." };
    const name = str(fd, "authorName", 80);
    if (!name) return { error: "Write the writer's name." };
    const category = CATEGORIES.includes(str(fd, "category")) ? str(fd, "category") : "pakistan";
    const contentType = ["opinion", "feature"].includes(str(fd, "contentType")) ? str(fd, "contentType") : "opinion";
    const mode = str(fd, "mode") === "publish" ? "publish" : "draft";
    // "schedule": saved as a draft and published by the cron at this Pakistan time (datetime-local, e.g. 2026-11-20T09:00)
    let scheduledAt;
    if (str(fd, "mode") === "schedule") {
      const m = str(fd, "scheduleAt", 20).match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);
      if (!m) return { error: "Choose the date and time to publish." };
      scheduledAt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 5, +m[5]));
      if (scheduledAt.getTime() < Date.now() + 60e3) return { error: "The publish time must be in the future." };
    }

    await connectDB();
    const photoUrl = await saveImage(fd.get("authorPhoto"), `Writer photo: ${name}`);
    const imgUrl = await saveImage(fd.get("image"), `Article picture: ${titleEn}`);
    const imgCredit = str(fd, "imageCredit", 200);
    if (imgUrl && !imgCredit) return { error: "Write the credit for the article picture (who took it / where it is from)." };

    const plain = (b) => b.replace(/[#*_>\[\]()`]/g, " ").replace(/\s+/g, " ").trim();
    const tr = (title, summary, body) => ({ title, summary, body, metaDescription: (summary || plain(body)).slice(0, 155) });
    const translations = { en: tr(titleEn, str(fd, "summaryEn", 300), bodyEn) };
    if (titleUr && bodyUr) translations.ur = tr(titleUr, str(fd, "summaryUr", 300), bodyUr);

    const tags = str(fd, "tags", 300).split(/[,،]/).map((x) => x.trim()).filter(Boolean).slice(0, 8);
    const article = await Article.create({
      slug: makeSlug(titleEn), origin: "manual", contentType, category, translations, tags,
      image: imgUrl ? { url: imgUrl, thumb: imgUrl, alt: titleEn, credit: imgCredit, creditUrl: str(fd, "imageCreditUrl", 300) || undefined, provider: "own" } : undefined,
      author: {
        name, nameUr: str(fd, "authorNameUr", 80), role: str(fd, "authorRole", 120), roleUr: str(fd, "authorRoleUr", 120),
        bio: str(fd, "authorBio", 600), bioUr: str(fd, "authorBioUr", 600), photo: photoUrl || "", photoCredit: str(fd, "photoCredit", 150), url: str(fd, "authorUrl", 300),
      },
      status: mode === "publish" ? "published" : "draft",
      placement: { slot: "standard", priority: 60 },
      disclosure: { aiGenerated: false, humanReviewed: true, reviewedBy: name },
      publishedAt: mode === "publish" ? new Date() : undefined,
      ...(scheduledAt ? { scheduledAt } : {}),
    });
    return { ok: true, id: String(article._id), slug: article.slug, status: article.status };
  } catch (e) { return { error: String(e.message || e).slice(0, 200) }; }
}
