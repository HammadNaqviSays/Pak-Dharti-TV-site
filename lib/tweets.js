// Tweets of well-known people as Pak Dharti cards.
// X's paid API is not needed: the public oEmbed endpoint (publish.twitter.com) returns the text, author and
// date of any public post from its link. Links are also collected automatically from the news pages our
// stories are built on (see quality.js → fullText), so the editor sees "tweets in today's news".
import { connectDB } from "./db";
import { Setting } from "@/models";
import { callAI, parseJSON } from "./ai";

export const STATUS_RE = /https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})/g;

/** Canonical https://x.com/handle/status/id, or null. */
export function normalizeTweetUrl(u = "") {
  const m = [...String(u).matchAll(STATUS_RE)][0];
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&mdash;/g, "—").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** { url, handle, name, text, lang, date } from the public oEmbed endpoint. */
export async function fetchTweet(link) {
  const url = normalizeTweetUrl(link);
  if (!url) throw new Error("This is not a link to a post on X (x.com/…/status/…).");
  const r = await fetch(`https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url.replace("x.com", "twitter.com"))}`,
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; PakDhartiTV/1.0)" }, signal: AbortSignal.timeout(9000), cache: "no-store" });
  if (r.status === 404) throw new Error("X says this post does not exist or is not public (deleted, protected or age-restricted).");
  if (!r.ok) throw new Error(`X did not answer (${r.status}). Try again in a minute.`);
  const j = await r.json();
  const html = j.html || "";
  const p = html.match(/<p([^>]*)>([\s\S]*?)<\/p>/i);
  const lang = (p?.[1].match(/lang="([a-z-]+)"/i) || [])[1] || "";
  let text = decode((p?.[2] || "").replace(/<br\s*\/?>/gi, "\n").replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1").replace(/<[^>]+>/g, ""));
  text = text.replace(/\s*pic\.twitter\.com\/\S+/g, "").replace(/\s*https?:\/\/t\.co\/\S+/g, "").replace(/[ \t]+\n/g, "\n").trim();
  const dateTxt = decode((html.match(/<a[^>]*>([^<]*\d{4})<\/a>\s*<\/blockquote>/i) || [])[1] || "");
  const date = dateTxt && !Number.isNaN(Date.parse(dateTxt)) ? new Date(`${dateTxt} 12:00 UTC`).toISOString().slice(0, 10) : null;
  const handle = (j.author_url || "").split("/").pop() || url.split("/")[3];
  return { url, handle, name: j.author_name || handle, text, lang, date };
}

const isUrdu = (s = "") => (s.match(/[؀-ۿ]/g) || []).length > s.replace(/\s/g, "").length * 0.4;

/** Urdu name, a short Urdu title for the person (only if widely known) and, for non-Urdu posts, a faithful Urdu translation. */
export async function urduForTweet(t) {
  const needs = !isUrdu(t.text);
  const r = await callAI({
    system: "You are an Urdu news desk editor. Reply with JSON only. Translate faithfully: never add, soften or sharpen anything.",
    prompt: `Post on X by ${t.name} (@${t.handle}):
"""${t.text}"""

Return {"nameUr": "the person's name in Urdu script", "role": "their current public role in short Urdu (e.g. وزیرِ اعظم پاکستان، سابق کپتان قومی کرکٹ ٹیم) ONLY if you are sure; otherwise empty string", "person": "full English name if this is a real well-known person, else empty"${needs ? `, "urdu": "faithful Urdu translation of the post, same meaning and tone; keep names, numbers and hashtags"` : ""}}`,
    maxTokens: 1200,
  });
  const j = parseJSON(r.text) || {};
  return { nameUr: String(j.nameUr || ""), role: String(j.role || ""), person: String(j.person || ""), urdu: needs ? String(j.urdu || "") : "" };
}

/** Links to posts found in news pages → Setting "tweetSuggestions" (newest 60). */
export async function rememberTweetLinks(links, story) {
  const urls = [...new Set(links.map(normalizeTweetUrl).filter(Boolean))].slice(0, 6);
  if (!urls.length) return 0;
  await connectDB();
  const cur = (await Setting.findOne({ key: "tweetSuggestions" }).lean())?.value || [];
  const known = new Set(cur.map((s) => s.url));
  const add = urls.filter((u) => !known.has(u)).map((url) => ({ url, story: String(story || "").slice(0, 140), at: new Date() }));
  if (!add.length) return 0;
  await Setting.updateOne({ key: "tweetSuggestions" }, { $set: { value: [...add, ...cur].slice(0, 60) } }, { upsert: true });
  return add.length;
}
