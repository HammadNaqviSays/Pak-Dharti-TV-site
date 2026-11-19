// Reels, step 2: the voice and the pictures. The video itself is drawn on GitHub's machines (scripts/reels/render.py)
// because it needs ffmpeg and a browser. This file claims one script, makes ONE voice-over for the whole reel, finds a
// picture for every scene and hands the finished plan ("manifest") to the renderer.
import crypto from "crypto";
import { connectDB } from "./db";
import { Reel, ReelFile, Article } from "@/models";
import { speak, getVoice } from "./tts";
import { findPeople, libraryImage } from "./people";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.pakdhartitv.com").replace(/\/$/, "");
const CHUNK = 3 * 1024 * 1024;

export async function saveReelFile(id, kind, part, buf) {
  await connectDB();
  await ReelFile.updateOne({ reel: id, kind, part }, { $set: { data: buf } }, { upsert: true });
}
async function saveWhole(id, kind, buf) {
  await ReelFile.deleteMany({ reel: id, kind });
  for (let i = 0, n = 0; i < buf.length; i += CHUNK, n++) await saveReelFile(id, kind, n, buf.subarray(i, i + CHUNK));
}
const asBuf = (x) => (Buffer.isBuffer(x) ? x : Buffer.from(x?.buffer || x));
/** The whole file (audio or video) of a reel, or null. */
export async function readReelFile(id, kind) {
  await connectDB();
  const parts = await ReelFile.find({ reel: id, kind }).sort({ part: 1 }).lean();
  return parts.length ? Buffer.concat(parts.map((p) => asBuf(p.data))) : null;
}
/** Files of reels that are posted / rejected / failed are no longer needed. */
async function cleanFiles() {
  const dead = await Reel.find({ status: { $in: ["posted", "rejected", "failed"] } }, { _id: 1 }).lean();
  if (dead.length) await ReelFile.deleteMany({ reel: { $in: dead.map((d) => d._id) } });
}

/** One stock picture from Pixabay for these words (answers are cached 24 h, as Pixabay asks). */
async function pixabay(kw, used, alt = 0) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key || !kw) return null;
  for (const orient of ["vertical", "all"]) {
    const u = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(kw)}&image_type=photo&orientation=${orient}&safesearch=true&per_page=12&order=popular`;
    const r = await fetch(u, { next: { revalidate: 86400 } }).catch(() => null);
    if (!r?.ok) continue;
    const j = await r.json().catch(() => ({}));
    const words = kw.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    // relevance gate: the picture's own tags must mention a word of the subject, otherwise it is not used
    const ok = (j.hits || []).filter((h) => !used.has(h.id) && h.largeImageURL && words.some((w) => String(h.tags || "").toLowerCase().includes(w)));
    const hit = ok[Math.min(alt, Math.max(0, ok.length - 1))];
    if (hit) { used.add(hit.id); return { url: hit.largeImageURL, credit: `Pixabay · ${hit.user}` }; }
  }
  return null;
}

const CAT_UR = { world: "دنیا", pakistan: "پاکستان", politics: "سیاست", economy: "معیشت", sports: "کھیل", disaster: "حادثات", entertainment: "شوبز", religion: "مذہب", inspirational: "تحریک", folklore: "لوک کہانی", poetry: "شاعری", quotes: "اقوال", books: "کتابیں" };
const CITIES = [["کراچی", /کراچی|karachi/i], ["لاہور", /لاہور|lahore/i], ["اسلام آباد", /اسلام آباد|islamabad/i], ["راولپنڈی", /راولپنڈی|rawalpindi/i], ["پشاور", /پشاور|peshawar/i], ["کوئٹہ", /کوئٹہ|quetta/i], ["فیصل آباد", /فیصل آباد|faisalabad/i], ["ملتان", /ملتان|multan/i], ["حیدرآباد", /حیدرآباد|hyderabad/i], ["سیالکوٹ", /سیالکوٹ|sialkot/i], ["گوادر", /گوادر|gwadar/i]];
/** The small tag at the top of the reel: "پاکستان | کراچی", "دنیا", "معیشت" … */
function badgeFor(art, reel) {
  const cat = CAT_UR[art?.category] || "";
  if (!cat) return "";
  if (art.category !== "pakistan") return cat;
  const hay = [reel.title, ...(art.tags || []), ...(reel.scenes || []).map((s) => s.text)].join(" ");
  const hit = CITIES.find(([, re]) => re.test(hay));
  return hit ? `${cat} | ${hit[0]}` : cat;
}

async function pictureFor(scene, used, i, last, story) {
  if (scene.imgFixed && scene.img) return { url: scene.img.startsWith("/") ? SITE + scene.img : scene.img, credit: scene.credit || "" };   // the picture the editor saw in the list stays
  if (scene.pic) return { url: scene.pic.startsWith("/") ? SITE + scene.pic : scene.pic, credit: "Pak Dharti TV" };   // picture chosen by the editor
  const own = story?.url ? { url: story.url.startsWith("/") ? SITE + story.url : story.url, credit: [story.credit, story.provider].filter(Boolean).join(" · ").slice(0, 80) } : null;
  if (scene.who) {
    try {
      const [p] = await findPeople([scene.who]);
      const im = p && libraryImage(p);
      if (im?.url) return { url: im.url, credit: im.credit ? String(im.credit).slice(0, 80) : "Wikimedia Commons" };
    } catch { /* fall through */ }
  }
  if ((i === 0 || last) && own) return own;           // the opening and closing scenes carry the story's own picture
  const stock = await pixabay(scene.kw, used, scene.alt || 0);        // only a picture whose tags match the subject
  return stock || own || null;                        // nothing fits: the story's own picture again (never an unrelated one)
}

/** A picture for a subject: a library photo of a named public figure, else a matching stock picture. → { url, credit } | null */
export async function stockFor({ kw = "", who = "" }, used = new Set(), alt = 0) {
  if (who) {
    try {
      const [p] = await findPeople([who]);
      const im = p && libraryImage(p);
      if (im?.url) return { url: im.url, credit: im.credit ? String(im.credit).slice(0, 80) : "Wikimedia Commons" };
    } catch { /* fall through to stock */ }
  }
  return await pixabay(kw, used, alt);
}

/** The picture of ONE scene as the list shows it. mode "other" asks for the next stock picture. The result is saved, and the video uses exactly it. */
export async function previewScenePicture(reelId, n, mode = "show") {
  await connectDB();
  const reel = await Reel.findById(reelId);
  const s = reel?.scenes?.[n];
  if (!s) return { error: "Line not found" };
  if (mode === "show" && (s.pic || s.clip)) return { url: s.pic || "", clip: !!s.clip, own: true };
  if (mode === "show" && s.img) return { url: s.img, credit: s.credit || "" };
  if (mode === "other") { s.alt = (s.alt || 0) + 1; s.pic = ""; s.clip = ""; s.imgFixed = false; s.img = ""; }
  const art = await Article.findOne({ slug: reel.slug }).select("image").lean();
  const pic = await pictureFor(s, new Set(), n, n === reel.scenes.length - 1, art?.image);
  if (!pic?.url) {
    const st = art?.image?.url;       // nothing matched: show the story's own picture instead of an empty box (the editor can open "Options")
    if (mode === "show" && st) return { url: st.startsWith("/") ? SITE + st : st, credit: [art.image.credit, art.image.provider].filter(Boolean).join(" · ").slice(0, 80), fallback: true };
    reel.markModified("scenes"); await reel.save(); return { error: "No matching picture found. Press Options or My picture." };
  }
  s.img = pic.url; s.credit = pic.credit || ""; s.imgFixed = true;
  reel.markModified("scenes");
  await reel.save();
  return { url: pic.url, credit: pic.credit || "" };
}

/** A fresh script waits as a "draft" so you can change the words; after 3 hours it goes on by itself. */
export async function releaseDrafts() {
  await connectDB();
  await Reel.updateMany({ status: "draft", createdAt: { $lt: new Date(Date.now() - 3 * 3600e3) } }, { $set: { status: "scripted", tries: 0 } });
}

/** Takes the oldest "scripted" reel and makes voice + picture plan. → { none:true } or { manifest }. */
export async function prepareNextReel() {
  await connectDB();
  await releaseDrafts();
  const reel = await Reel.findOneAndUpdate({ status: "scripted", tries: { $lt: 3 } }, { $set: { status: "rendering", error: "" }, $inc: { tries: 1 } }, { sort: { createdAt: 1 }, new: true });
  if (!reel) return { none: true };
  try {
    const text = reel.scenes.map((s) => s.text).join("\n");
    // same words and same voice as last time (only pictures or look changed, or a retry): keep the voice-over, spend no voice quota
    const vc = await getVoice();
    const akey = crypto.createHash("sha1").update(`${text}|${vc.voice}|${vc.style}`).digest("hex");
    let v = null;   // the new voice-over (null when the saved one is reused)
    if (!(reel.audioKey === akey && await ReelFile.exists({ reel: reel._id, kind: "audio" }))) {
      v = await speak(text);
      await saveWhole(reel._id, "audio", v.wav);
      await Reel.updateOne({ _id: reel._id }, { $set: { audioKey: akey } });
    }
    const audioUrl = `${SITE}/api/reels/${reel._id}/audio`;
    cleanFiles().catch(() => {});
    const used = new Set();
    const scenes = [];
    const art = await Article.findOne({ slug: reel.slug }).select("image sources category tags contentType author").lean();
    const sourcesLine = art?.contentType === "opinion" ? `تحریر: ${art.author?.nameUr || art.author?.name || ""}` : [...new Set((art?.sources || []).map((x) => x.name).filter(Boolean))].slice(0, 3).join(" · ");
    const speed = (await getVoice()).speed || 1;
    for (const [i, s] of reel.scenes.entries()) {
      const pic = await pictureFor(s, used, i, i === reel.scenes.length - 1, art?.image);
      scenes.push({ text: s.text, kw: s.kw || "", mirror: !!s.mirror, extra: (s.extra || []).slice(0, 3).map((u) => (u.startsWith("/") ? SITE + u : u)), extraAt: (s.extraAt || []).slice(0, 3), clip: s.clip ? (s.clip.startsWith("/") ? SITE + s.clip : s.clip) : "", img: pic?.url || "", credit: pic?.credit || "", marks: (s.marks || []).map((m) => ({ i: m.i, c: m.c })), anim: s.anim || "right", size: s.size || 0, edited: !!s.edited });
    }
    reel.scenes = reel.scenes.map((s, i) => ({ ...s.toObject(), img: scenes[i].img, credit: scenes[i].credit }));
    reel.sources = sourcesLine; reel.imageCredits = [...new Set(scenes.map((x) => x.credit).filter(Boolean))].join(" · ").slice(0, 300);
    reel.voiceBlob = audioUrl; if (v) { reel.voiceSec = Math.round(v.seconds * 10) / 10; reel.voiceModel = v.model; }
    await reel.save();
    return { manifest: { id: String(reel._id), font: reel.style?.font || "jameel", stroke: reel.style?.stroke || "r", badge: reel.style?.badge ? (reel.style.badge === "-" ? "" : reel.style.badge) : badgeFor(art, reel), grade: reel.style?.grade || "", noise: reel.style?.noise || "none", noiseAmt: reel.style?.noiseAmt || "mid", mirror: !!reel.style?.mirror, bgAlpha: reel.style?.bgAlpha || 100, title: reel.title, slug: reel.slug, audioUrl, voiceSec: v ? v.seconds : reel.voiceSec, speed, sources: sourcesLine, scenes } };
  } catch (e) {
    await Reel.updateOne({ _id: reel._id }, { $set: { status: reel.tries >= 3 ? "failed" : "scripted", error: String(e.message || e).slice(0, 200) } });
    throw e;
  }
}

export async function finishReel(id, { seconds, error, parts = 0 }) {
  await connectDB();
  if (error) {
    const r = await Reel.findById(id);
    if (!r) return { ok: false };
    await Reel.updateOne({ _id: id }, { $set: { status: r.tries >= 3 ? "failed" : "scripted", error: String(error).slice(0, 200) } });
    return { ok: true, failed: true };
  }
  const n = await ReelFile.countDocuments({ reel: id, kind: "video" });
  if (!n) return { ok: false, error: "no video uploaded" };
  if (parts && n !== parts) { await Reel.updateOne({ _id: id }, { $set: { status: "scripted", error: "video upload incomplete" } }); return { ok: false, error: "incomplete upload" }; }
  if (parts) await ReelFile.deleteMany({ reel: id, kind: "video", part: { $gte: parts } });
  const up = await Reel.findOneAndUpdate({ _id: id, status: "rendering" }, { $set: { status: "ready", videoUrl: `/api/reels/${id}/video`, durationSec: Number(seconds) || 0, error: "" } }, { projection: { slug: 1 } });
  if (up?.slug) await Article.updateOne({ slug: up.slug }, { $set: { "reel.doneAt": new Date() } });
  return { ok: true };
}

const UA = { "User-Agent": "PakDhartiTV/1.0 (news site; contact via site)" };
const strip = (h) => String(h || "").replace(/<[^>]*>/g, "").trim();

/** Several suggested pictures for ONE line, to choose from. q = search words (default: the line's own keywords). */
export async function sceneOptions(reelId, n, q = "") {
  await connectDB();
  const reel = await Reel.findById(reelId);
  const s = reel?.scenes?.[n];
  if (!s) return { error: "Line not found" };
  const art = await Article.findOne({ slug: reel.slug }).select("image").lean();
  const kw = String(q || s.kw || "").trim().slice(0, 80);
  const out = [], seen = new Set();
  const add = (o) => { if (o?.url && /^(https:|\/)/.test(o.url) && !seen.has(o.url)) { seen.add(o.url); out.push({ url: o.url, thumb: o.thumb || o.url, credit: String(o.credit || "").slice(0, 80) }); } };
  const st = art?.image?.url;
  if (st) add({ url: st.startsWith("/") ? SITE + st : st, credit: ["Story picture", art.image.credit].filter(Boolean).join(" · ") });
  if (s.who) { try { const [p] = await findPeople([s.who]); const im = p && libraryImage(p); if (im?.url) add({ url: im.url, credit: im.credit || "People library" }); } catch { /* skip */ } }
  const notes = [];
  if (kw) {
    const jobs = [];
    const key = process.env.PIXABAY_API_KEY;
    if (key) jobs.push((async () => {
      const r = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(kw)}&image_type=photo&orientation=vertical&safesearch=true&per_page=10&order=popular`, { signal: AbortSignal.timeout(7000) });
      const j = await r.json(); return (j.hits || []).map((h) => ({ url: h.largeImageURL, thumb: h.webformatURL, credit: `Pixabay · ${h.user}` }));
    })()); else notes.push("Pixabay key is not set");
    jobs.push((async () => {
      const r = await fetch(`https://api.openverse.org/v1/images/?page_size=10&license_type=commercial&mature=false&q=${encodeURIComponent(kw)}`, { headers: UA, signal: AbortSignal.timeout(7000) });
      const j = await r.json(); return (j.results || []).filter((x) => /^https:/.test(x.url || "") && x.width >= 900 && !/\.(gif|svg)$/i.test(x.url)).map((x) => ({ url: x.url, thumb: x.thumbnail || x.url, credit: `${String(x.creator || x.source || "Openverse").slice(0, 50)} · ${(x.license || "").toUpperCase()}` }));
    })());
    jobs.push((async () => {
      const u = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=" + encodeURIComponent(`${kw} filetype:bitmap filemime:image/jpeg`) + "&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1200";
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(7000) }); const j = await r.json();
      return Object.values(j?.query?.pages || {}).map((p) => { const i = p.imageinfo?.[0]; const lic = i?.extmetadata?.LicenseShortName?.value; return i && lic && i.mime === "image/jpeg" && i.width >= 900 ? { url: i.thumburl || i.url, credit: `${strip(i.extmetadata?.Artist?.value || "Wikimedia Commons").slice(0, 40)} · ${lic}` } : null; }).filter(Boolean);
    })());
    const res = await Promise.allSettled(jobs);
    res.forEach((x) => { if (x.status === "fulfilled") x.value.forEach(add); });
  }
  return { options: out.slice(0, 24), kw, notes };
}

/** Uses a chosen suggestion for picture 1 of the line (it is saved, the video uses exactly it). */
export async function useSceneOption(reelId, n, url, credit = "") {
  await connectDB();
  const reel = await Reel.findById(reelId);
  const s = reel?.scenes?.[n];
  if (!s) return { error: "Line not found" };
  s.pic = ""; s.clip = ""; s.img = String(url).slice(0, 600); s.credit = String(credit).slice(0, 100); s.imgFixed = true;
  reel.markModified("scenes"); await reel.save();
  return { url: s.img };
}
