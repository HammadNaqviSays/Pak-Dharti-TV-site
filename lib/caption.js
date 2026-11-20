// Social post text for one story: an honest teaser (the most interesting TRUE detail, not the whole story), the source,
// and a tracked link back to the site. Facebook gets the link in the text; Instagram says "link in bio".
import { callAI, parseJSON } from "./ai";
import { SITE } from "./site";
import { cleanUrdu, hasForeignScript } from "./urdu";

const clip = (s = "", n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);
const firstSentences = (s = "", k = 2) => (String(s).match(/[^۔.!?؟]+[۔.!?؟]?/g) || [s]).slice(0, k).join(" ").trim();

export const storyUrl = (slug, lang, source) =>
  `${SITE.url}/${lang}/news/${slug}?utm_source=${source}&utm_medium=social&utm_campaign=card`;

// Different ways to open the curiosity gap. One is picked at random for each post and written down with the post,
// so Mission Control > Hook report can show which style really brings readers to the site.
export const HOOK_STYLES = {
  number: "open with ONE concrete number, amount or date from the story, but not what it means or why it matters",
  question: "a sharp why / how / what question about a surprising TRUE detail of the story",
  stakes: "what this means for ordinary Pakistanis (prices, bills, jobs, travel, family), but only if the story really says so; if it does not, use a contrast instead",
  contrast: "two TRUE facts from the story that clash (before and after, promise and reality, big and small)",
  person: "something a named person said or did that is unexpected, without the outcome",
  unfinished: "start telling the key moment of the story and stop right before the answer",
};
const styleKeys = Object.keys(HOOK_STYLES);

async function aiTeaser(a, lang, avoid = [], style = "") {
  const t = a.translations?.[lang] || a.translations?.en || {};
  const { text } = await callAI({
    system: "You write social media posts for a Pakistani news site. Reply with JSON only.",
    prompt: `Write the post text for this story in ${lang === "ur" ? "natural Urdu (Perso-Arabic script only, names in Urdu script, Western digits)" : "plain English"}.
Rules: use ONLY facts that are in the story. No lies, no exaggeration, no invented numbers or quotes, no "you won't believe". Be CURIOUS and gripping: the hook should open a question in the reader's mind that only the full story answers (a surprising TRUE detail, a number without its meaning, "what happened next", "why"). Make people feel they must open the comment to find out. The teaser gives only the setup and stops right before the key answer, ending on an open question or a cliffhanger. Never give away the ending or the key result, and never state the main event of the headline as a plain news sentence (that is the headline's job): the hook must be a QUESTION or a gripping open detail, NOT the news itself. Example for a story "Russian strikes knock out Ukraine's power grid": hook = "یوکرین کے لاکھوں گھروں میں اچانک اندھیرا کیوں چھا گیا؟" and teaser = "سردیوں کی شروعات میں ایک ہی رات نے سب کچھ بدل دیا۔ آخر ایسا کیا ہوا؟" (Urdu stories get Urdu like this; English stories get English like this). Do not ask people to like, share or comment (Facebook punishes that).
Make it MORE gripping than a normal news line: put one concrete TRUE detail from the story in the hook (a number, a name, a place, a contrast, a surprise) and hold back only the one thing the reader wants to know; the teaser then builds tension with a second concrete detail and stops on the unanswered part. Vary the style from post to post (a question, a startling number, a contrast, a short "the real issue is..." line); do not open every post the same way. Short sentences, simple everyday words, no filler.${avoid.length ? `\nThis event was ALREADY posted before with these hooks: ${avoid.map((x) => `"${x}"`).join(" | ")}. The new post must take a DIFFERENT angle (another detail, another question), must not reuse their words or structure, and must not read like a repeat.` : ""}
HOOK STYLE for this post (follow it): ${HOOK_STYLES[style] || HOOK_STYLES.question}.
Return {"hook":"one striking, curiosity-driven TRUE sentence or question, under 110 characters","teaser":"2 short sentences: the setup, ending on an open question or cliffhanger","tags":["4 short hashtags without # (Urdu or English, matching the language)"]}

HEADLINE: ${t.title}
SUMMARY: ${t.summary || ""}
BODY: ${clip(t.body || "", 2500)}`,
    maxTokens: 3000, prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
  });
  const j = parseJSON(text) || {};
  const out = { style, hook: String(j.hook || "").trim(), teaser: String(j.teaser || "").trim(), tags: (j.tags || []).map((x) => String(x).replace(/[#\s]+/g, "")).filter(Boolean).slice(0, 5) };
  if (lang === "ur") { out.hook = cleanUrdu(out.hook); out.teaser = cleanUrdu(out.teaser); out.tags = out.tags.map(cleanUrdu); }
  if (!out.hook || !out.teaser || hasForeignScript(out.hook + out.teaser + out.tags.join(""))) throw new Error("unusable AI text");
  return out;
}

/** → { facebook, facebookComment, instagram, link } */
export async function buildCaptions(a, lang = "ur", { avoid = [] } = {}) {
  const l = a.translations?.[lang] ? lang : "en";
  const t = a.translations?.[l] || {};
  let c;
  const style = styleKeys[Math.floor(Math.random() * styleKeys.length)];
  try { c = await aiTeaser(a, l, avoid, style); }
  catch { try { c = await aiTeaser(a, l, avoid, style); } catch { c = { style: "none", hook: l === "ur" ? cleanUrdu(t.title || "") : t.title || "", teaser: "", tags: [] }; } }
  const own = (a.socialTags?.[l] || []).map((x) => String(x).replace(/[#\s]+/g, "")).filter(Boolean).slice(0, 7);
  if (own.length) c.tags = own;   // hand-picked hashtags win over the AI ones
  const sources = [...new Set((a.sources || []).map((s) => s.name).filter(Boolean))].slice(0, 3).join(", ");
  const ur = l === "ur";
  const srcLine = sources ? (ur ? `ذریعہ: ${sources}` : `Source: ${sources}`) : "";
  const tags = c.tags.length ? c.tags.map((x) => `#${x}`).join(" ") + (ur ? " #پاک_دھرتی_ٹی_وی" : " #PakDhartiTV") : (ur ? "#پاک_دھرتی_ٹی_وی" : "#PakDhartiTV");
  const fbLink = storyUrl(a.slug, l, "facebook"), igLink = storyUrl(a.slug, l, "instagram");
  const more = ur ? "👇 مکمل خبر یہاں پڑھیں" : "👇 Read the full story";
  const bio = ur ? "📲 مکمل خبر کا لنک بائیو میں" : "📲 Full story: link in bio";
  const join = (...p) => p.filter(Boolean).join("\n\n");
  const pick = (arr) => arr[Math.floor(Date.now() / 60000) % arr.length]; // varies from post to post (repeating one line looks like spam)
  const inComment = ur
    ? pick(["اصل بات پہلے کمنٹ میں 👇", "پوری کہانی پہلے کمنٹ میں پڑھیں 👇", "جواب پہلے کمنٹ میں ہے 👇", "آگے کیا ہوا؟ پہلے کمنٹ میں دیکھیں 👇"])
    : pick(["The answer is in the first comment 👇", "Full story in the first comment 👇", "What happened next? First comment 👇", "Read the rest in the first comment 👇"]);
  return {
    lang: l,
    hook: c.hook,
    style: c.style || "none",
    // Facebook: the post carries the news itself; the link also goes in the page's own first comment
    facebook: join(c.hook, c.teaser, inComment, "🌐 www.pakdhartitv.com", tags),
    facebookComment: join(`${more}\n${fbLink}`, srcLine),
    instagram: join(c.hook, c.teaser, bio, srcLine, "🌐 www.pakdhartitv.com", tags),
    link: igLink, // paste into the Instagram bio / story link
  };
}


/** A short curiosity headline for the card's headline panel: a question or an open, surprising TRUE detail. null when the AI cannot give a usable one. */
export async function cardHook(a, lang = "ur", { fresh = false } = {}) {
  const l = a.translations?.[lang] ? lang : "en";
  const cached = a.social?.[l]?.cardHook;
  if (cached && !fresh) return cached;
  const t = a.translations?.[l] || {};
  for (let i = 0; i < 2; i++) {
    try {
      const { text } = await callAI({
        system: "You write the big headline on a news card for a Pakistani news page. Reply with JSON only.",
        prompt: `Write the card headline in ${l === "ur" ? "natural Urdu (Perso-Arabic script only, names in Urdu script, Western digits)" : "plain English"}.
It must make a reader stop scrolling: a QUESTION or a surprising open detail that only the full story answers.
Rules: use ONLY facts in the story; keep every name, place and number exactly right; no lies, no exaggeration, no "you won't believe"; do not give away the answer; at most ${l === "ur" ? 58 : 70} characters; no quotation marks, no emoji, no hashtags.
Examples (style only): "یوکرین کے لاکھوں گھروں میں اچانک اندھیرا کیوں چھا گیا؟" / "ایک رات میں 40 ارب روپے کہاں غائب ہو گئے؟"
Return {"card":"the headline"}

HEADLINE: ${t.title}
SUMMARY: ${t.summary || ""}
BODY: ${clip(t.body || "", 1500)}`,
        maxTokens: 600, prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
      });
      let h = String(parseJSON(text)?.card || "").replace(/["“”*#]/g, "").replace(/\s+/g, " ").trim();
      if (l === "ur") h = cleanUrdu(h);
      if (h.length >= 16 && h.length <= (l === "ur" ? 70 : 85) && !hasForeignScript(h)) return h;
    } catch { /* try once more, then give up (the real headline is used) */ }
  }
  return null;
}

/** Related hashtags for a story, in the language of the post: hand-picked ones win, else the AI's. "#a #b … #brand". Never throws. */
export async function shareTags(a, lang = "ur") {
  const l = a.translations?.[lang] ? lang : "en";
  const ur = l === "ur";
  let tags = (a.socialTags?.[l] || []).map((x) => String(x).replace(/[#\s]+/g, "")).filter(Boolean).slice(0, 7);
  if (!tags.length) {
    try { tags = (await aiTeaser(a, l, [], "question")).tags || []; } catch { tags = []; }
    if (ur) tags = tags.map(cleanUrdu);
  }
  return [...tags.map((x) => `#${x}`), ur ? "#پاک_دھرتی_ٹی_وی" : "#PakDhartiTV"].join(" ");
}
