// "Quick answers" for every story: 3-5 questions with short answers in Urdu, English and Roman Urdu, plus search keywords.
// Made from the story's own text only (one AI call per story), so search engines and AI answer engines (ChatGPT, Gemini,
// Claude, Perplexity) can quote Pak Dharti TV directly. Numbers in an answer must appear in the story, or that answer is dropped.
import { callAI, parseJSON } from "./ai";
import { connectDB } from "./db";
import { Article } from "@/models";
import QUERIES from "../data/seo-queries.json";

const FAQ_VERSION = 1;
const digits = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const nums = (s) => (digits(s).match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, "")).filter((n) => n.length > 0);

const SYSTEM = `You write the "quick answers" box of a news story for Pak Dharti TV, so that Google and AI answer engines can quote it.
Rules (never break them):
1. Use ONLY facts that are in the STORY text given. No outside knowledge, no guesses, no numbers, names, dates or quotes that are not in the story. If the story does not answer a question, do not ask it.
2. 4 questions (at least 3, at most 5), the same questions in the same order in all three languages.
3. Each question is phrased the way a reader would type or ask it ("What happened...?", "Why did...?", "How much is...?", "Who...?"). When a phrase from SEARCH HINTS fits the story naturally you may use it; never force one in.
4. Each answer: 1-2 short sentences (under 45 words), the direct answer first, neutral tone. Allegations stay allegations ("according to ...", "alleged"). Name the source when the story does.
5. Languages: "en" English; "ur" Urdu in Urdu script (natural Pakistani Urdu); "roman" Roman Urdu (Urdu written in Latin letters, the way Pakistanis type it, e.g. "Kya ... hua?").
6. "keywords": 6 search phrases a reader would type to find this story, for "en" and for "ur" (short, concrete, no hashtags).
Return ONLY JSON: {"keywords":{"en":[],"ur":[]},"en":[{"q":"","a":""}],"ur":[{"q":"","a":""}],"roman":[{"q":"","a":""}]}`;

function storyText(a) {
  const en = a.translations?.en || {}, ur = a.translations?.ur || {};
  return { en: `${en.title || ""}\n${en.summary || ""}\n${(en.body || "").slice(0, 5500)}`, ur: `${ur.title || ""}\n${ur.summary || ""}\n${(ur.body || "").slice(0, 3000)}` };
}

export async function makeFaq(a) {
  const t = storyText(a);
  const hints = QUERIES.slice(0, 40).join(" | ");
  const r = await callAI({
    system: SYSTEM,
    prompt: `SEARCH HINTS (what our readers search): ${hints}\n\nSTORY (English):\n${t.en}\n\nSTORY (Urdu):\n${t.ur}`,
    maxTokens: 2500,
    prefer: ["gemini-3.5-flash-lite"],   // the model with the big free quota (500/day per key)
  });
  const j = parseJSON(r.text);
  const L = ["en", "ur", "roman"];
  const n = Math.min(...L.map((l) => (Array.isArray(j?.[l]) ? j[l].length : 0)));
  if (!(n >= 3)) throw new Error("faq: not enough answers");
  const known = new Set(nums(`${t.en} ${t.ur}`));
  const keep = [];
  for (let i = 0; i < Math.min(n, 5); i++) {
    const ok = L.every((l) => {
      const x = j[l][i];
      if (!x || typeof x.q !== "string" || typeof x.a !== "string" || x.q.length < 8 || x.a.length < 12 || x.a.length > 400) return false;
      return nums(x.a).every((v) => known.has(v));   // an invented figure drops the whole question
    });
    if (ok) keep.push(i);
  }
  if (keep.length < 3) throw new Error("faq: answers failed the fact check");
  const clean = (l) => keep.map((i) => ({ q: j[l][i].q.trim(), a: j[l][i].a.trim() }));
  const kw = (l) => (Array.isArray(j?.keywords?.[l]) ? j.keywords[l].map((x) => String(x).trim()).filter((x) => x.length > 2 && x.length < 70).slice(0, 8) : []);
  return { v: FAQ_VERSION, at: new Date(), en: clean("en"), ur: clean("ur"), roman: clean("roman"), keywords: { en: kw("en"), ur: kw("ur") } };
}

/** Newest published stories without quick answers first (new stories get theirs within one run, then the old ones follow). */
const FAQ_DAILY_CAP = Number(process.env.FAQ_DAILY_CAP) || 150;

export async function fillFaq(max = 2, budgetMs = 40000) {
  await connectDB();
  const t0 = Date.now();
  // daily cap so the backfill never starves new stories of AI quota
  const used = await Article.countDocuments({ "faq.at": { $gte: new Date(Date.now() - 24 * 3600e3) } });
  const room = Math.min(max, Math.max(0, FAQ_DAILY_CAP - used));
  if (room < 1) return { done: 0, failed: 0, capped: true, left: await Article.countDocuments({ status: "published", faq: { $exists: false } }) };
  const list = await Article.find({ status: "published", faq: { $exists: false }, "translations.en.body": { $exists: true } })
    .select("slug translations").sort({ publishedAt: -1 }).limit(room).lean();
  const out = { done: 0, failed: 0 };
  for (const a of list) {
    if (Date.now() - t0 > budgetMs) break;
    try {
      const f = await makeFaq(a);
      await Article.updateOne({ _id: a._id }, { $set: { faq: f } });
      out.done++;
    } catch (e) {
      out.failed++; out.error = String(e.message).slice(0, 120);
      // a story that cannot be answered from its own text (or fails twice) is skipped for good; an AI outage is retried later
      if (/faq:/.test(e.message)) await Article.updateOne({ _id: a._id }, { $set: { faq: { v: FAQ_VERSION, none: true, at: new Date() } } });
      else break;
    }
  }
  const left = await Article.countDocuments({ status: "published", faq: { $exists: false } });
  return { ...out, left };
}
