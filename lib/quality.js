// News quality engine. Every automated story goes through it before it can be published:
//  1. fullText()  — reads the source articles themselves (not only the RSS snippet), so the story has
//                   real substance and length matches what the sources actually say;
//  2. review()    — a second, strict AI pass checks the English master against the sources: every claim
//                   must be supported; defamation, incitement, sectarian content, attacks on the army or
//                   judiciary, graphic detail, clickbait and opinion inside news are flagged;
//  3. decide()    — only stories that score high, have no unsupported claims and no flags publish
//                   automatically, within a daily cap. The rest are held (and archived after 48 hours).
import { callAI, parseJSON, withRetry } from "./ai";
import { NEWS_STRUCTURE } from "./newsStructure";
import { STATUS_RE } from "./tweets";

const MAX_PER_SOURCE = 3500;
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();

/** The readable paragraphs of a news page (best effort, a few seconds per page). */
async function pageText(url, found) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; PakDhartiTV/1.0)" }, signal: AbortSignal.timeout(5000), redirect: "follow" });
    if (!r.ok) return "";
    const raw = await r.text();
    // Posts on X embedded in the story (offered to the editor as tweet cards)
    if (found) for (const m of raw.matchAll(STATUS_RE)) found.push(m[0]);
    const html = raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => strip(m[1]))
      .filter((p) => p.length > 60 && !/cookie|subscribe|newsletter|copyright|all rights reserved|follow us/i.test(p));
    return paras.join("\n").slice(0, MAX_PER_SOURCE);
  } catch { return ""; }
}

/** items: [{ sourceName, title, snippet, url }] → { text, chars } */
export async function fullText(items) {
  const tweets = [];
  const texts = await Promise.all(items.map((s) => pageText(s.url, tweets)));
  const blocks = items.map((s, i) => {
    const body = texts[i] && texts[i].length > (s.snippet || "").length ? texts[i] : s.snippet || "";
    return `[${i + 1}] ${s.sourceName}: ${s.title}\n${body}`;
  });
  const text = blocks.join("\n\n");
  return { text, tweets, chars: texts.reduce((n, t, i) => n + Math.max(t.length, (items[i].snippet || "").length), 0) };
}

/** Length that the material can honestly support. */
export function targetWords(chars) {
  if (chars < 900) return "200-320 words";
  if (chars < 2500) return "320-500 words";
  return "450-750 words";
}

export const STRUCTURE = NEWS_STRUCTURE;

const REVIEW_SYSTEM = `You are the standards editor of a Pakistani news website that must comply with Pakistani law (PECA, defamation, contempt of court) and Google AdSense publisher policies. You are strict and you reply with JSON only.`;

/** Strict second opinion on the English master. */
export async function review(master, sourceMaterial) {
  const prompt = `SOURCE MATERIAL:
${sourceMaterial}

ARTICLE TO CHECK:
${JSON.stringify({ title: master.title, summary: master.summary, body: master.body })}

Check the article against the source material and return:
{"score": 0-100, "unsupported": ["every specific claim, number, name, quote or date in the article that is NOT in the source material"], "flags": {"defamation": false, "incitement": false, "sectarian": false, "attacksOnArmyOrJudiciary": false, "graphic": false, "clickbait": false, "opinionInNews": false}, "reason": "one sentence"}

Scoring: 90+ = accurate, well attributed, neutral, clear and genuinely useful; 75-89 = good with minor issues; below 75 = thin, padded, poorly attributed or unclear.
Set a flag to true only when the article itself does it (reporting that someone else criticised a court is NOT an attack; insulting or accusing without attribution IS).
"clickbait": the headline promises more than the body delivers or exaggerates. "opinionInNews": the article takes sides or uses loaded words.
Background and "why it matters" sections are fine when they add no new specific facts.
General, widely known context (what an organisation is, where a country is, who holds a well-known office) is NOT an unsupported claim; list only specific claims about this event that the sources do not contain.`;
  // One retry: the free AI tier sometimes answers "busy" (429/503) or cuts the reply short
  const j = await withRetry(async () => {
    const { text } = await callAI({ system: REVIEW_SYSTEM, prompt, maxTokens: 900 });
    const o = parseJSON(text) || {};
    if (o.score === undefined) throw new Error("review reply had no score");
    return o;
  });
  return {
    score: Number(j.score) || 0,
    unsupported: Array.isArray(j.unsupported) ? j.unsupported.filter(Boolean).slice(0, 10) : [],
    flags: Object.entries(j.flags || {}).filter(([, v]) => v === true).map(([k]) => k),
    reason: String(j.reason || "").slice(0, 300),
  };
}

export const MIN_SCORE = Number(process.env.QUALITY_MIN_SCORE || 75);
// 80 a day: 60 Pakistani + 20 international (see app/api/cron/process). An env value can only raise it.
export const DAILY_CAP = Math.max(Number(process.env.AUTO_DAILY_CAP || 0), 130);

/** { publish, why } */
export function decide(r, { chars, publishedToday, minChars = 300 }) {
  if (r.flags.length) return { publish: false, why: `flagged: ${r.flags.join(", ")}` };
  if (r.unsupported.length) return { publish: false, why: `unsupported claims: ${r.unsupported.length}` };
  if (r.score < MIN_SCORE) return { publish: false, why: `score ${r.score} < ${MIN_SCORE}` };
  if (chars < minChars) return { publish: false, why: "too little source material" };
  if (publishedToday >= DAILY_CAP) return { publish: false, why: `daily cap ${DAILY_CAP} reached` };
  return { publish: true, why: `score ${r.score}` };
}

/**
 * Repairs an article the review held back: removes or attributes every claim that is not in the source
 * material and neutralises loaded wording. Adds nothing new. Returns the corrected English master.
 */
export async function revise(master, sourceMaterial, r) {
  const prompt = `SOURCE MATERIAL (the only facts allowed):
${sourceMaterial}

ARTICLE:
${JSON.stringify({ title: master.title, summary: master.summary, body: master.body, metaDescription: master.metaDescription })}

The standards editor found these problems:
${(r.unsupported || []).map((u) => `- not in the sources: ${u}`).join("\n") || "- none listed"}
${(r.flags || []).map((f) => `- ${f === "opinionInNews" ? "opinion or loaded words in a news story" : f === "clickbait" ? "headline promises more than the body" : f}`).join("\n")}
${r.reason ? `Editor's note: ${r.reason}` : ""}

Fix the article: delete every listed claim (or replace it with what the sources actually say), make the wording neutral
and attributed, and make the headline match the body. Add NO new facts. Keep the Markdown structure and the rest of the text.
Return ONLY JSON: {"title":"...","summary":"...","body":"...","metaDescription":"..."}`;
  return withRetry(async () => {
    const { text } = await callAI({ system: REVIEW_SYSTEM, prompt, maxTokens: 5000 });
    const d = parseJSON(text);
    if (!d.title || !d.body) throw new Error("revision incomplete");
    return { ...master, ...d };
  });
}

/** Problems a revision can fix; anything else (defamation, incitement, ...) stays with the editor. */
export const FIXABLE_FLAGS = ["opinionInNews", "clickbait", "reviewFailed"];
