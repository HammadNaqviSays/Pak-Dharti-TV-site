// Site audit: finds the known kinds of mistakes in every published story and says exactly where each one is.
// Used by /admin/audit. Read-only; repairs live in app/admin/audit/actions.js.
import { connectDB } from "./db";
import { Article, Setting } from "@/models";
import { unsafeQuery } from "./images";
import { foreignSnippet, foreignScriptName } from "./urdu";
import { keywords, overlap } from "./dedupe";

export const CODES = {
  "ur-foreign-script": "Urdu text contains another script (Bengali, Hindi, ...)",
  "ur-english-text": "Urdu headline is mostly English letters",
  "ur-missing": "No Urdu version",
  "ur-short": "Urdu version much shorter than English (cut off?)",
  "image-people": "Photo shows or is about people (children, family, ...) that the story does not need",
  "image-missing": "No photo",
  "en-thin": "English story is very short (thin content)",
};
export const URDU_CODES = ["ur-foreign-script", "ur-english-text", "ur-missing", "ur-short"];
export const IMAGE_CODES = ["image-people", "image-missing"];

const latin = (s = "") => (s.match(/[A-Za-z]/g) || []).length;
const arabic = (s = "") => (s.match(/[؀-ۿ]/g) || []).length;

/** One story → list of { code, where, detail } */
export function auditArticle(a) {
  const out = [];
  const ur = a.ur || {};
  if (!ur.title || !ur.body) out.push({ code: "ur-missing", where: "translations.ur", detail: "" });
  else {
    for (const k of ["title", "summary", "body", "metaDescription"]) {
      const sn = foreignSnippet(ur[k]);
      if (sn) out.push({ code: "ur-foreign-script", where: `Urdu ${k}`, detail: `${foreignScriptName(ur[k])}: ${sn}` });
    }
    if (latin(ur.title) > arabic(ur.title)) out.push({ code: "ur-english-text", where: "Urdu title", detail: ur.title.slice(0, 80) });
    if (a.enLen > 800 && (ur.body || "").length < a.enLen * 0.3) out.push({ code: "ur-short", where: "Urdu body", detail: `${(ur.body || "").length} vs ${a.enLen} characters` });
  }
  const img = a.image || {};
  if (!img.url) out.push({ code: "image-missing", where: "image", detail: "" });
  else if (!["own", "link", "local"].includes(img.provider) && unsafeQuery(img.alt || "")) out.push({ code: "image-people", where: "image", detail: (img.alt || "").slice(0, 100) });
  if (a.enLen < 300) out.push({ code: "en-thin", where: "English body", detail: `${a.enLen} characters` });
  return out;
}

/** Every published story → { total, issues: [{ slug, title, category, code, where, detail }], counts } */
export async function scanSite() {
  await connectDB();
  const rows = await Article.aggregate([
    { $match: { status: "published" } },
    { $sort: { publishedAt: -1 } },
    { $project: {
      slug: 1, category: 1, publishedAt: 1, enSummary: "$translations.en.summary", "image.url": 1, "image.alt": 1, "image.provider": 1,
      enTitle: "$translations.en.title",
      enLen: { $strLenCP: { $ifNull: ["$translations.en.body", ""] } },
      "ur.title": "$translations.ur.title", "ur.summary": "$translations.ur.summary",
      "ur.body": "$translations.ur.body", "ur.metaDescription": "$translations.ur.metaDescription",
    } },
  ]);
  const issues = [], counts = {};
  for (const a of rows) {
    for (const i of auditArticle(a)) {
      issues.push({ slug: a.slug, category: a.category, title: a.ur?.title || a.enTitle || a.slug, ...i });
      counts[i.code] = (counts[i.code] || 0) + 1;
    }
  }
  // pairs the AI already judged "different" are remembered, so they leave the list
  const reviewed = new Set((await Setting.findOne({ key: "dup-reviewed" }).lean())?.value || []);
  const dups = findDuplicates(rows).filter((d) => !reviewed.has(`${d.keep.slug}|${d.hide.slug}`));
  return { total: rows.length, issues, counts, dups };
}

const DUP_WINDOW_H = 72;   // two stories about one event are published within a few days of each other
export const DUP_SURE = 0.7; // at or above this the two stories are almost certainly the same

/** Pairs of published stories that look like the same news event: [{ keep, hide, score }] (keep = older, hide = newer copy). */
export function findDuplicates(rows) {
  const items = rows
    .map((r) => ({ slug: r.slug, title: r.enTitle || r.slug, at: new Date(r.publishedAt || 0).getTime(), k: keywords(`${r.enTitle} ${r.enSummary || ""}`) }))
    .sort((a, b) => b.at - a.at); // newest first
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if ((items[i].at - items[j].at) / 3600e3 > DUP_WINDOW_H) break;
      const score = overlap(items[i].k, items[j].k);
      if (score >= 0.5) out.push({ keep: items[j], hide: items[i], score });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 200).map((d) => ({
    keep: { slug: d.keep.slug, title: d.keep.title }, hide: { slug: d.hide.slug, title: d.hide.title }, score: d.score,
  }));
}
