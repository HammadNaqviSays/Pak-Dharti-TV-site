"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { buildCaptions, cardHook } from "@/lib/caption";

/** Post text (Facebook + Instagram) for one story, in "ur" or "en". */
export async function captionAction(slug, lang) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const a = await Article.findOne({ slug }, { slug: 1, translations: 1, sources: 1 }).lean();
  if (!a) return { error: "Story not found" };
  try { return await buildCaptions(a, lang === "en" ? "en" : "ur"); }
  catch (e) { return { error: String(e.message || e).slice(0, 160) }; }
}


/** A fresh curiosity headline (question / open detail) for the card maker's headline box. */
export async function curiousHeadlineAction(slug, lang) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const a = await Article.findOne({ slug }, { slug: 1, translations: 1, social: 1 }).lean();
  if (!a) return { error: "Story not found" };
  const h = await cardHook(a, lang === "en" ? "en" : "ur", { fresh: true });
  return h ? { text: h } : { error: "Could not make one now. Try again." };
}
