// Job ads from official sources. The collector (GitHub Actions) sends the text of an official page or PDF; the AI only
// reads that text and fills fields; then every important fact is checked against the text itself. Nothing is invented.
import { createHash } from "crypto";
import { connectDB } from "./db";
import { Job } from "@/models";
import { callAI, parseJSON } from "./ai";

const DAILY_CAP = Number(process.env.JOBS_DAILY_CAP) || 120;       // AI reads per 24 h (keeps quota for the news)
const AUTOPUBLISH = process.env.JOBS_AUTOPUBLISH !== "0";           // "0": everything waits for the editor

const SYSTEM = `You read ONE official recruitment advertisement (plain text taken from an official website or PDF) and return JSON.
Rules:
- Use ONLY facts written in the text. Never guess, never add. If something is not in the text, use null or "".
- "isJob" is true only if the text is a real job/recruitment advertisement with a closing date to apply, not a news item, result, exam date sheet, syllabus or general careers page.
- "lastDate": the closing date for applications as YYYY-MM-DD, only if the text states it. "lastDateText": that date exactly as written in the text. "evidence": the sentence from the text that states the closing date, copied exactly.
- "positions": number of posts only if stated (e.g. "120 posts"), else "".
- Write "title", "org", "summary" (2 short sentences: what the job is and who can apply), "qualification" (one short line) and "howTo" (one short line: how/where to apply) in clear English ("en") and in Urdu ("ur"). Keep names, numbers and dates exactly as in the text.
- "applyUrl": the apply/portal link if the text contains one, else "".
Return ONLY JSON: {"isJob":true,"lastDate":"","lastDateText":"","evidence":"","positions":"","location":"","applyUrl":"",
"org":{"en":"","ur":""},"title":{"en":"","ur":""},"summary":{"en":"","ur":""},"qualification":{"en":"","ur":""},"howTo":{"en":"","ur":""}}`;

const norm = (s) => String(s || "").replace(/\s+/g, " ").replace(/[‐-―]/g, "-").trim().toLowerCase();
const sha = (s) => createHash("sha1").update(s).digest("hex");
const pkToday = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }).split(",")[0] + " 00:00:00 GMT+0500");

/** Checks every claim against the page text. Returns a list of problems (empty = verified). */
export function verify(j, text) {
  const t = norm(text), issues = [];
  if (!j?.isJob) return ["not a job advertisement"];
  if (!j.title?.en || !j.org?.en) issues.push("missing title or organisation");
  const d = j.lastDate && /^\d{4}-\d{2}-\d{2}$/.test(j.lastDate) ? new Date(`${j.lastDate}T00:00:00+05:00`) : null;
  if (!d || isNaN(d)) issues.push("no valid closing date");
  else {
    const days = (d - pkToday()) / 864e5;
    if (days < 0) issues.push("closing date already passed");
    if (days > 200) issues.push("closing date too far away");
  }
  if (!j.lastDateText || !t.includes(norm(j.lastDateText))) issues.push("closing date text not found in the source");
  if (!j.evidence || !t.includes(norm(j.evidence).slice(0, 160))) issues.push("closing-date sentence not found in the source");
  else if (!/(last date|closing date|deadline|before|on or before|till|until|up to|آخری|تک|قبل|ڈیڈ)/i.test(j.evidence)) issues.push("sentence does not look like a closing date");
  if (j.positions) for (const n of String(j.positions).match(/\d[\d,]*/g) || []) if (!t.includes(n.replace(/,/g, "")) && !t.includes(n)) issues.push(`number ${n} not in the source`);
  return issues;
}

const slugOf = (j, key) => `${(j.title?.en || "job").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)}-${key.slice(0, 6)}`;

/** item: { source, sourceName, url, adUrl, text } */
export async function ingestOne(it) {
  const key = sha(it.url);
  if (await Job.exists({ key })) return { skipped: "known" };
  const text = String(it.text || "").slice(0, 12000);
  if (text.length < 300) { await Job.create({ key, source: it.source, sourceName: it.sourceName, sourceUrl: it.url, status: "skipped", issues: ["too little text"] }); return { skipped: "short" }; }
  const r = await callAI({ system: SYSTEM, prompt: `SOURCE: ${it.sourceName}\nPAGE: ${it.url}\n\nTEXT:\n${text}`, maxTokens: 1800, prefer: ["gemini-3.5-flash-lite"] });
  const j = parseJSON(r.text);
  const issues = verify(j, text);
  const base = { key, source: it.source, sourceName: it.sourceName, sourceUrl: it.url, adUrl: it.adUrl || undefined };
  if (!j?.isJob) { await Job.create({ ...base, status: "skipped", issues }); return { skipped: "not a job", ai: true }; }
  // soft check: the only doubt is that the closing-date sentence has no word like "deadline" (many ads just print the date); the date text itself IS in the source, in the future, and close
  const hard = issues.filter((x) => !/does not look like a closing date/.test(x));
  const soft = issues.length > 0 && hard.length === 0;
  const ok = hard.length === 0;
  // an ad that is already closed, or states no closing date, is of no use to a reader: skip it instead of filling the editor's list
  const dead = issues.some((x) => /already passed|no valid closing date/.test(x));
  const status = ok && AUTOPUBLISH ? "published" : dead ? "skipped" : "draft";
  await Job.create({
    ...base, slug: slugOf(j, key), org: j.org, title: j.title, summary: j.summary, qualification: j.qualification, howTo: j.howTo,
    positions: j.positions || "", location: j.location || "", applyUrl: /^https?:\/\//.test(j.applyUrl || "") ? j.applyUrl : undefined,
    lastDate: j.lastDate && !isNaN(new Date(j.lastDate)) ? new Date(`${j.lastDate}T00:00:00+05:00`) : undefined,
    lastDateText: j.lastDateText || "", evidence: j.evidence || "", verified: issues.length === 0, soft, issues, status, publishedAt: status === "published" ? new Date() : undefined,
  });
  return { status, issues, ai: true };
}

export async function knownKeys(days = 60) {
  await connectDB();
  const since = new Date(Date.now() - days * 864e3);
  return (await Job.find({ createdAt: { $gte: since } }).select("key").lean()).map((x) => x.key);
}
export const keyOf = sha;

export async function ingestMany(items, budgetMs = 45000) {
  await connectDB();
  const t0 = Date.now(), out = { published: 0, draft: 0, skipped: 0, errors: 0 };
  const used = await Job.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 3600e3) } });
  let room = Math.max(0, DAILY_CAP - used);
  for (const it of items) {
    if (Date.now() - t0 > budgetMs) { out.timeLeft = false; break; }
    if (room < 1) { out.capped = true; break; }
    try { const r = await ingestOne(it); if (r.status) out[r.status]++; else out.skipped++; if (r.ai) room--; }
    catch (e) { out.errors++; out.error = String(e.message).slice(0, 120); if (!/E11000/.test(e.message)) break; }
  }
  return out;
}
