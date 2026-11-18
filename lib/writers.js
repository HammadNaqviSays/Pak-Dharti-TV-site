import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { writerSlug } from "@/lib/writerSlug";

export { writerSlug } from "@/lib/writerSlug";

/** All published pieces by one writer (newest first), and the writer's details from the newest piece. */
export async function getWriter(slug) {
  await connectDB();
  const items = await Article.find({ status: "published", "author.name": { $exists: true, $ne: "" } },
    { slug: 1, image: 1, publishedAt: 1, author: 1, translations: 1, contentType: 1 }).sort({ publishedAt: -1 }).limit(200).lean();
  const mine = items.filter((a) => writerSlug(a.author.name) === slug);
  return mine.length ? { author: mine[0].author, items: mine } : null;
}
