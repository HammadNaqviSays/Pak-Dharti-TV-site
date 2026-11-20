"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { storyUrl, shareTags } from "@/lib/caption";
import { cleanUrdu } from "@/lib/urdu";
import { SITE } from "@/lib/site";

const enc = encodeURIComponent;

/** The ready share address for one story on X, Threads or Pinterest, in the order: title, blank line, link, blank line, related hashtags (in the post's language). */
export async function shareHrefAction(slug, lang, site) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  await connectDB();
  const a = await Article.findOne({ slug: String(slug), status: "published" }).lean();
  if (!a) return { error: "Story not found" };
  const l = lang === "en" ? "en" : "ur";
  const raw = (a.translations?.[l]?.title || a.translations?.en?.title || "").trim();
  const title = l === "ur" ? cleanUrdu(raw) : raw;
  const url = storyUrl(a.slug, l, site);
  const tags = await shareTags(a, l);
  if (site === "pinterest") {
    const img = a.image?.url ? (a.image.url.startsWith("http") ? a.image.url : `${SITE.url}${a.image.url}`) : `${SITE.url}/${l}/news/${a.slug}/opengraph-image`;
    return { href: `https://pinterest.com/pin/create/button/?url=${enc(url)}&media=${enc(img)}&description=${enc(`${title}\n\n${tags}`)}` };
  }
  let t = tags;
  if (site === "x") {            // X counts a link as 23 characters and allows 280: drop hashtags from the end, then trim the title
    const room = (tg, ti) => ti.length + 2 + 23 + (tg ? 2 + tg.length : 0);
    let list = tags.split(" ");
    while (list.length > 1 && room(list.join(" "), title) > 280) list.splice(-2, 1);
    t = list.join(" ");
    if (room(t, title) > 280) t = "";
  }
  const text = `${title}\n\n${url}${t ? `\n\n${t}` : ""}`;
  return { href: site === "x" ? `https://x.com/intent/post?text=${enc(text)}` : `https://www.threads.net/intent/post?text=${enc(text)}` };
}
