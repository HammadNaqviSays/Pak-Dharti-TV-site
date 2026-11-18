// Reels, step 1: choose the story and write the short script (scenes). The voice, pictures and video come in later steps.
import { connectDB } from "./db";
import { Article, Reel } from "@/models";
import { callAI, parseJSON } from "./ai";
import { ReelEdit } from "@/models";
import { cleanUrdu, hasForeignScript } from "./urdu";
import { getReelConfig } from "./reelConfig";
import { isPriority } from "./priority";

const REEL_CATS = ["pakistan", "politics", "world", "economy", "sports", "disaster", "entertainment"];
const clip = (s = "", n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

/** The best fresh story that has no reel yet: last 24 h, Urdu version, a real source, most read / most prominent first. */
export async function pickReelStory(cfg = null) {
  await connectDB();
  cfg = cfg || (await getReelConfig());
  const done = new Set((await Reel.find({ status: { $ne: "rejected" }, createdAt: { $gte: new Date(Date.now() - 7 * 86400e3) } }, { slug: 1 }).lean()).map((r) => r.slug));
  const list = await Article.find({
    status: "published", origin: "auto", contentType: "news", category: { $in: cfg.cats },
    publishedAt: { $gte: new Date(Date.now() - 24 * 3600e3) },
    "translations.ur.title": { $exists: true, $ne: "" }, "sources.0": { $exists: true },
  }).sort({ "placement.priority": -1, "stats.views": -1, publishedAt: -1 }).limit(40)
    .select("slug translations sources category visual").lean();
  const fresh = list.filter((a) => !done.has(a.slug));
  // Imran Khan / PTI stories first (when switched on), whatever section they are in
  if (cfg.ptiFirst) { const hot = fresh.find((a) => isPriority({ title: a.translations?.en?.title, snippet: a.translations?.en?.summary })); if (hot) return hot; }
  return fresh[0] || null;
}

/** → { title, caption, scenes: [{ text, kw, who, src }] } or throws. Facts only from the story, every claim named to its source. */
async function learnedStyle() {
  try {
    const rows = await ReelEdit.find({ kind: "text" }).sort({ createdAt: -1 }).limit(40).lean();
    const pairs = rows.filter((e) => e.before && e.after && e.before !== e.after && e.after.length < 200).slice(0, 8);
    if (!pairs.length) return "";
    return "\nThe editor corrected earlier scripts like this (before → after). Learn his taste (tense, length, wording) and apply it, never copy these sentences:\n" + pairs.map((e) => `- ${e.before} → ${e.after}`).join("\n") + "\n";
  } catch { return ""; }
}

export async function writeReelScript(a) {
  const learned = await learnedStyle();
  const t = a.translations?.ur || a.translations?.en || {};
  const srcNames = [...new Set((a.sources || []).map((s) => s.name).filter(Boolean))].slice(0, 3);
  const { text } = await callAI({
    system: "You are the script editor of a Pakistani Urdu news channel. You write short vertical-video news scripts. Reply with JSON only.",
    prompt: `Write a reel script for this story in natural spoken Urdu (Perso-Arabic script only, Western digits, names in Urdu script).
Rules:
- 6 to 8 scenes. Each scene is ONE or TWO short sentences, at most 22 words, easy to hear and read.
- Scene 1 is a hook: the most striking TRUE detail, as a question or an open detail (not the whole news). The hook must NEVER hint at a hidden hand, a plot, a cause or a motive that the story does not state ("is X behind this?", "who is responsible?"). Ask about the plain fact itself: a surprising number, a contrast, a "how did this happen in one week?" built only on what the story says.
- Do NOT open with "کیا آپ جانتے ہیں" or any stock phrase; every reel needs its own opening shape (a number, a contrast, a plain question, a place).
- Speak in the voice of Pak Dharti TV. Facts that are confirmed (the story has two or more sources, or an official statement) are told plainly as our own report, WITHOUT "<source> کے مطابق" on every line; the sources are credited on screen. Name a source in the line ONLY when the claim is one outlet's own exclusive, an allegation or a version of one side, or an unconfirmed report. Never copy the wording of the story: tell it fresh and short.
- Use ONLY facts in the story. Never invent numbers, quotes, causes or motives. No speculation, no opinion, no adjectives that judge anyone.
- Every claim that is somebody's version must name who says it ("... کے مطابق", "... کا کہنا ہے"). Keep both sides when the story has both. If something is unconfirmed or from unnamed sources, say so in the scene.
- The last scene says the full story is on Pak Dharti TV dot com (پاک دھرتی ٹی وی ڈاٹ کام). The sources (${srcNames.join("، ") || "none"}) are shown on screen automatically, do not list them in the last scene.
- For every scene give "kw": 2-4 ENGLISH words for a generic stock picture that matches the SUBJECT of that scene exactly (a scene about gold gets gold, not "stock market"; about cricket gets a cricket ground; about a road gets a highway) — a generic stock picture that fits what the scene says (a place, object, situation: e.g. "hospital corridor", "eye doctor", "ambulance", "prison wall", "parliament building", "court gavel"). NEVER a person's name, never a real individual, never children or victims.
- "who": the full English name of ONE public figure the scene is about (as Wikipedia writes it), else "".
Return {"title":"short Urdu title, under 60 characters","caption":"Urdu caption for the reel, 2 short lines, naming the source, no hashtags","scenes":[{"text":"...","kw":"...","who":""}]}

${learned}
HEADLINE: ${t.title}
SUMMARY: ${t.summary || ""}
BODY: ${clip(t.body || "", 3500)}`,
    maxTokens: 4000, prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
  });
  const j = parseJSON(text) || {};
  const scenes = (Array.isArray(j.scenes) ? j.scenes : []).map((s) => ({
    text: cleanUrdu(String(s.text || "").trim()), kw: String(s.kw || "").replace(/[^A-Za-z ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40),
    who: String(s.who || "").replace(/[^A-Za-z .'-]/g, "").trim().slice(0, 60), src: "",
  })).filter((s) => s.text);
  const all = scenes.map((s) => s.text).join(" ") + (j.title || "") + (j.caption || "");
  if (scenes.length < 5 || scenes.length > 10 || hasForeignScript(all)) throw new Error("unusable script");
  return { title: cleanUrdu(String(j.title || t.title || "").slice(0, 80)), caption: cleanUrdu(String(j.caption || "").trim()), scenes: scenes.slice(0, 9) };
}

/** Pick the story, write the script, save it as a "scripted" reel. Returns the Reel, or { idle } when there is nothing to do. */
export async function makeNextReelScript({ manual = false } = {}) {
  const cfg = await getReelConfig();
  if (!manual) {
    if (!cfg.auto) return { idle: "automatic reel scripts are switched off" };
    const dayStart = new Date(Math.floor((Date.now() + 5 * 3600e3) / 86400e3) * 86400e3 - 5 * 3600e3);
    const today = await Reel.countDocuments({ status: { $ne: "rejected" }, createdAt: { $gte: dayStart } });
    if (today >= cfg.perDay) return { idle: `daily limit (${cfg.perDay}) reached` };
    const last = await Reel.findOne({}, { createdAt: 1 }).sort({ createdAt: -1 }).lean();
    if (last && Date.now() - new Date(last.createdAt).getTime() < cfg.minGapHours * 3600e3) return { idle: "too soon after the last reel" };
  }
  const a = await pickReelStory(cfg);
  if (!a) return { idle: "no fresh story without a reel" };
  const s = await writeReelScript(a);
  const r = await Reel.create({ slug: a.slug, lang: "ur", status: "draft", title: s.title, caption: s.caption, scenes: s.scenes });
  await Article.updateOne({ slug: a.slug }, { $set: { "reel.id": String(r._id), "reel.at": new Date() } });
  return { reel: r };
}

/** A reel for one chosen story (the "Make reel" button on the published list). */
export async function makeReelForSlug(slug) {
  await connectDB();
  const have = await Reel.findOne({ slug, status: { $ne: "rejected" } }, { _id: 1 }).lean();
  if (have) return { exists: String(have._id) };
  const a = await Article.findOne({ slug, status: "published" }).select("slug translations sources category visual").lean();
  if (!a) return { error: "Story not found" };
  const s = await writeReelScript(a);
  const r = await Reel.create({ slug: a.slug, lang: "ur", status: "draft", title: s.title, caption: s.caption, scenes: s.scenes });
  return { reel: r };
}
