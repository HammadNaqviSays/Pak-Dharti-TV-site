// What a story's card should show: people (from the library, with cut-outs), flags and a place photo.
// New stories carry article.visual (written with the story); older ones are worked out once by AI and saved.
import { connectDB } from "./db";
import { Article, Setting } from "@/models";
import { callAI, parseJSON } from "./ai";
import { findPeople, normName, dedupeNames } from "./people";
import { fromCommonsJoint } from "./images";
import { fromCommons, findFreePhoto, findImage } from "./images";
import { SCENE_KEYS } from "./sceneKeys";
import { FLAGS } from "./flagList";
import { localPlan } from "./localPlan";

const ORG_FLAGS = ["un", "eu", "oic", "nato", "arab-league", "gcc", "asean", "au", "sco", "commonwealth", "red-cross"];
const hasFlag = (name) => FLAGS.has(name) || ORG_FLAGS.includes(name.replace(/^org-/, ""));

async function guess(a) {
  const en = a.translations?.en || {};
  const r = await callAI({
    system: "You plan news graphics. Reply with JSON only.",
    prompt: `Headline: ${en.title}\nSummary: ${en.summary || ""}\n
Return {"people":["full English names of the public figures this story NAMES, most important first (max 3). Use ONLY people named in the headline or summary, with the exact person meant: never swap in a relative or a better-known person with the same surname (e.g. Ali Dar is not Ishaq Dar). Do not add people who are not named."],
"countries":["ISO 3166-1 alpha-2 codes, ONLY when the story is about relations, a deal, a dispute or a conflict BETWEEN two or more countries (then those countries, max 4); otherwise an empty list. A story about one country, or about Pakistan at home, gets an empty list"],
"orgs":["international bodies central to the story, from: ${ORG_FLAGS.join(", ")}"],
"scene":"the one of these that best matches the TOPIC or place of the story (investment, shares, economy or business news: psx or state-bank-pk; a provincial government decision: that province's assembly; and so on): ${SCENE_KEYS.join(", ")}; or empty"}`,
    maxTokens: 600,
  });
  const j = parseJSON(r.text) || {};
  return { people: (j.people || []).slice(0, 4), countries: (j.countries || []).slice(0, 4), orgs: (j.orgs || []).slice(0, 3), scene: j.scene || "" };
}

/** No stored place photo fits: find one on the internet for what the story is about (a hotel, a stock exchange, a wheat field...). Remembered per story. */
async function webScene(a, redo) {
  const id = String(a._id);
  const cache = (await Setting.findOne({ key: "scene-web" }).lean())?.value || {};
  if (!redo && cache[id] !== undefined) return cache[id] || null;
  let out = null;
  try {
    const en = a.translations?.en || {};
    const { text } = await callAI({
      system: "You choose background photos for news cards. Reply with JSON only.",
      prompt: `Headline: ${en.title}\nSummary: ${en.summary || ""}\n\nReturn {"query":"2-4 English words naming the concrete PLACE or THING this story is about, so a stock photo really shows it (e.g. 'stock exchange building', 'hotel lobby', 'wheat field', 'hospital corridor', 'airport terminal'); no people, no names of people; empty if nothing fits"}`,
      maxTokens: 200, prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
    });
    const query = String((parseJSON(text) || {}).query || "").slice(0, 60);
    if (query) {
      const img = (await findFreePhoto(query, a.category)) || (await findImage(query, a.category));
      if (img && img.provider !== "local" && img.url) out = { url: img.url, credit: img.credit || "", license: img.license || "" };
    }
  } catch {}
  try { await Setting.updateOne({ key: "scene-web" }, { $set: { [`value.${id}`]: out || 0 } }, { upsert: true }); } catch {}
  return out;
}

/** A free Commons photo of a named person, remembered (also "none found") so pages do not search every time. */
async function commonsFor(name) {
  if (String(name || "").trim().split(/\s+/).length < 2) return null;   // a first name alone could be anyone
  const key = normName(name);
  const cache = (await Setting.findOne({ key: "commons-people" }).lean())?.value || {};
  const hit = cache[key];
  if (hit && (hit.url || Date.now() - (hit.at || 0) < 7 * 864e5)) return hit.url ? hit : null;
  let p = null;
  try { p = await fromCommons(name); } catch {}
  const rec = p ? { url: p.url, credit: p.credit, license: p.license, at: Date.now() } : { url: "", at: Date.now() };
  try { await Setting.updateOne({ key: "commons-people" }, { $set: { [`value.${key.replace(/[.$]/g, " ")}`]: rec } }, { upsert: true }); } catch {}
  return p ? rec : null;
}

/** People in the order asked for: from the people library, or else a free Commons photo of that exact person. */
async function peopleWithPhotos(names) {
  const out = [];
  const seen = new Set();   // library ids and photo links already used: the same face is never drawn twice
  for (const name of dedupeNames(names).slice(0, 4)) {
    const [lib] = await findPeople([name]);
    if (lib?.photos?.length && !seen.has(String(lib._id))) {
      seen.add(String(lib._id));
      const withCut = lib.photos.find((ph) => ph.cutout);
      const ph = withCut || lib.photos.find((x) => x.primary) || lib.photos[0];
      seen.add(ph.url);
      out.push({ name: lib.name, nameUr: lib.nameUr || "", roleUr: lib.roleUr || "", photo: ph.url,
        cutout: withCut ? `/api/people/cutout/${withCut.cutout}` : "", credit: `${ph.credit || ""}${ph.license ? ` (${ph.license})` : ""}` });
      continue;
    }
    if (lib) continue;   // known person whose photo was already used above
    const c = await commonsFor(name);
    if (c && !seen.has(c.url)) { seen.add(c.url); out.push({ name, nameUr: "", roleUr: "", photo: c.url, cutout: "", credit: `${c.credit || ""}${c.license ? ` (${c.license})` : ""}` }); }
  }
  return out.slice(0, 3);
}


/** A real photo of the two main people together, if Commons has one (remembered, also "none found"). */
async function jointFor(names) {
  const [a, b] = names;
  if (!a || !b || a.trim().split(/\s+/).length < 2 || b.trim().split(/\s+/).length < 2) return null;
  const key = `joint ${[normName(a), normName(b)].sort().join(" + ")}`.replace(/[.$]/g, " ");
  const cache = (await Setting.findOne({ key: "commons-people" }).lean())?.value || {};
  const hit = cache[key];
  if (hit && (hit.url || Date.now() - (hit.at || 0) < 3 * 864e5)) return hit.url ? hit : null;
  let p = null;
  try { p = await fromCommonsJoint(a, b); } catch {}
  const rec = p ? { url: p.url, credit: p.credit, license: p.license, at: Date.now() } : { url: "", at: Date.now() };
  try { await Setting.updateOne({ key: "commons-people" }, { $set: { [`value.${key}`]: rec } }, { upsert: true }); } catch {}
  return p ? rec : null;
}

/** { people: [{name, nameUr, roleUr, photo, cutout, credit}], flags: [url], scene: {url, credit, license} | null } */
export async function resolveVisual(a, { redo = false } = {}) {
  await connectDB();
  let v = redo ? {} : a.visual || {};
  if (!v.people?.length && !v.countries?.length && !v.scene) {
    // First the words of the headline itself (no AI): places and library people in English or Urdu. AI only when that finds nothing.
    try {
      const en = a.translations?.en || {}, ur = a.translations?.ur || {};
      const lp = await localPlan([ur.title, en.title, ur.summary, en.summary]);
      if (lp.people.length || lp.scene) { v = lp; await Article.updateOne({ _id: a._id }, { $set: { visual: v } }); }
    } catch { v = {}; }
    if (!v.people?.length && !v.scene) {
      try {
        v = await guess(a);
        await Article.updateOne({ _id: a._id }, { $set: { visual: v } });
      } catch { v = {}; }
    }
  }
  const people = await peopleWithPhotos(v.people || []);
  let joint = null;
  if (people.length >= 2) { try { joint = await jointFor(people.slice(0, 2).map((x) => x.name)); } catch { joint = null; } }
  // Flags only when a story is about two or more countries / bodies (relations, a deal, a dispute, a conflict): never one flag alone,
  // and never for a story about Pakistan at home.
  const all = [
    ...(v.countries || []).map((c) => String(c).toLowerCase()).filter(hasFlag),
    ...(v.orgs || []).map((o) => `org-${o}`).filter(hasFlag),
  ];
  const flags = (new Set(all).size >= 2 ? [...new Set(all)] : []).slice(0, 4).map((f) => `/flags/${f}.svg`);
  const scenes = (await Setting.findOne({ key: "scenes" }).lean())?.value || {};
  const s = scenes[v.scene];
  // curated: a place photo the editor stored on purpose (PSX building, an assembly...). A stock photo found on the web for the topic is not.
  const scene = s ? { url: s.url, credit: s.credit, license: s.license, curated: true } : await webScene(a, redo);
  return { people, flags, scene, joint, plan: v };
}
