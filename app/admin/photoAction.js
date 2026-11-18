"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { pickPhoto } from "@/lib/photoPick";

/** Finds a photo that fits the story (the person it is about, or a matching place) for the top of a card. Does not change the story. */
export async function fitPhotoAction(slug) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const a = await Article.findOne({ slug }, { category: 1, translations: 1 }).lean();
  if (!a) return { error: "Story not found" };
  try {
    const img = await pickPhoto(a);
    if (!img?.url || img.provider === "local") return { error: "No fitting free photo found for this story." };
    return { url: img.url, credit: [img.credit, img.license].filter(Boolean).join(" · ") || img.alt || img.provider };
  } catch (e) { return { error: String(e.message || e).slice(0, 120) }; }
}
