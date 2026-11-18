"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "crypto";
import { COOKIE, sessionToken, isLoggedIn } from "@/lib/session";
import { runInjection, ValidationError } from "@/lib/inject";
import { approveArticle, rejectArticle, unpublishArticle } from "@/lib/review";
import { ingestFeeds, processOne, writeFolkTale, pendingSourceCount } from "@/lib/autopilot";
import { callAI, parseJSON } from "@/lib/ai";
import { findImage } from "@/lib/images";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Article, Media, Setting, Message } from "@/models";

// After 5 wrong passwords the admin login is closed for 15 minutes (everyone, not per address: the site has one editor).
const MAX_TRIES = 5, LOCK_MS = 15 * 60e3;

export async function login(_prev, formData) {
  const pw = String(formData.get("password") || "");
  const real = process.env.ADMIN_PASSWORD || "";
  let st = {};
  try { await connectDB(); st = (await Setting.findOne({ key: "loginGuard" }).lean())?.value || {}; } catch {}
  if (st.lockedUntil && Date.now() < st.lockedUntil) return { error: "Too many wrong passwords. Try again in 15 minutes." };
  const ok = real && pw.length === real.length && timingSafeEqual(Buffer.from(pw), Buffer.from(real));
  if (!ok) {
    const recent = st.firstAt && Date.now() - st.firstAt < LOCK_MS ? st : { fails: 0, firstAt: Date.now() };
    const fails = (recent.fails || 0) + 1;
    try { await Setting.updateOne({ key: "loginGuard" }, { $set: { value: fails >= MAX_TRIES ? { fails: 0, lockedUntil: Date.now() + LOCK_MS } : { fails, firstAt: recent.firstAt } } }, { upsert: true }); } catch {}
    return { error: "Wrong password." };
  }
  try { await Setting.updateOne({ key: "loginGuard" }, { $set: { value: {} } }, { upsert: true }); } catch {}
  (await cookies()).set(COOKIE, sessionToken(), {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 12,
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  revalidatePath("/admin");
}

export async function injectAction(_prev, formData) {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const input = Object.fromEntries(
    ["brief", "headline", "sourceMaterial", "category", "contentType", "slot", "publishMode", "pinHours"]
      .map((k) => [k, String(formData.get(k) ?? "")])
  );
  try {
    const result = await runInjection(input, "admin-panel");
    if (result.status === "published") revalidatePath("/", "layout");
    revalidatePath("/admin");
    return { ok: true, result };
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message };
    return { error: `Generation failed: ${String(err.message).slice(0, 200)}` };
  }
}

export async function approveAction(formData) {
  if (!(await isLoggedIn())) return;
  await approveArticle(String(formData.get("id")), "admin-panel");
  revalidatePath("/", "layout");
}

/** Desk review: an editor has read a live story and checked it, so it gets the "Desk" mark (no AI note). */
export async function markReviewedAction(formData) {
  if (!(await isLoggedIn())) return;
  const id = String(formData.get("id") || "");
  if (!mongoose.isValidObjectId(id)) return;
  await connectDB();
  await Article.updateOne({ _id: id, status: "published" }, { $set: { "disclosure.humanReviewed": true, "disclosure.reviewedBy": "desk-review" } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/review");
}

export async function rejectAction(formData) {
  if (!(await isLoggedIn())) return;
  await rejectArticle(String(formData.get("id")));
  revalidatePath("/admin");
}

export async function unpublishAction(formData) {
  if (!(await isLoggedIn())) return;
  await unpublishArticle(String(formData.get("id")));
  revalidatePath("/", "layout");
}

/* ---------- Autopilot (Mission Control button) ---------- */

export async function autopilotIngest(scope = "all") {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  try {
    const feeds = await ingestFeeds();
    return { ok: true, pending: await pendingSourceCount(24, scope), failedFeeds: feeds.filter((f) => f.error).map((f) => f.feed) };
  } catch (err) {
    return { error: String(err.message).slice(0, 200) };
  }
}

// mode: "news" | "folklore"; publishMode: "all" | "safe" | "none"
export async function autopilotStep(mode, publishMode, scope = "all") {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const publish = (category) =>
    publishMode === "all" ? true : publishMode === "safe" ? !["pakistan", "politics"].includes(category) : false;
  try {
    const result = mode === "folklore"
      ? await writeFolkTale({ publish, useStockPhoto: true })
      : await processOne({ publish, useStockPhoto: true, scope });
    if (result.published) revalidatePath("/", "layout");
    revalidatePath("/admin");
    return result;
  } catch (err) {
    return { error: String(err.message).slice(0, 200), status: err.status || 0 };
  }
}

/* ---------- Replace an article's photo: own upload or a link ---------- */

const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function setPhotoAction(formData) {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const id = String(formData.get("id") || "");
  const credit = String(formData.get("credit") || "").trim().slice(0, 120);
  const link = String(formData.get("link") || "").trim();
  const file = formData.get("file");
  if (!mongoose.isValidObjectId(id)) return { error: "Unknown article." };
  if (!credit) return { error: "Write who took the photo or where it is from (e.g. \"Pak Dharti TV\" or \"PID handout\")." };

  await connectDB();
  let image;
  if (file && typeof file === "object" && file.size > 0) {
    if (!OK_TYPES.includes(file.type)) return { error: "Use a JPG, PNG or WebP photo." };
    if (file.size > 4 * 1024 * 1024) return { error: "Photo is too large (max 4 MB)." };
    const m = await Media.create({ data: Buffer.from(await file.arrayBuffer()), type: file.type, size: file.size, credit });
    const url = `/api/media/${m._id}`;
    image = { url, thumb: url, alt: "", credit, provider: "own" };
  } else if (/^https:\/\/\S+$/i.test(link)) {
    image = { url: link, thumb: link, alt: "", credit, provider: "link" };
  } else {
    return { error: "Choose a photo file or paste an https:// link." };
  }
  const a = await Article.findByIdAndUpdate(id, { image }, { new: true });
  if (!a) return { error: "Article not found." };
  revalidatePath("/", "layout");
  return { ok: true, url: image.url };
}

/** Today's local sarafa (bullion market) rates, shown on the site for 36 hours. */
export async function setGoldRateAction(_prev, form) {
  if (!(await isLoggedIn())) return { ok: false, msg: "Not logged in" };
  const tola24 = Number(String(form.get("tola24") || "").replace(/[, ]/g, ""));
  const silver = Number(String(form.get("silver") || "").replace(/[, ]/g, "")) || null;
  await connectDB();
  if (!tola24) {
    await Setting.deleteOne({ key: "goldTola24" });
    revalidatePath("/", "layout");
    return { ok: true, msg: "Cleared: the site now shows the international price converted to tola." };
  }
  if (tola24 < 10000 || tola24 > 5000000) return { ok: false, msg: "That does not look like a per-tola price in rupees." };
  await Setting.findOneAndUpdate({ key: "goldTola24" }, { value: { tola24, silver } }, { upsert: true });
  revalidatePath("/", "layout");
  return { ok: true, msg: "Saved. The site shows this rate for the next 36 hours." };
}

export async function markMessagesReadAction() {
  if (!(await isLoggedIn())) return;
  await connectDB();
  await Message.updateMany({ read: false }, { read: true });
  revalidatePath("/admin");
}

/**
 * Finds real photos for a few stories that only have a category banner: asks the AI for a short
 * photo search and the main person in the story, then tries Wikimedia (people) and Unsplash.
 * Started by the editor, a few stories per click, so it stays inside Unsplash's hourly limit.
 */
export async function findPhotosAction() {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  await connectDB();
  const q = { status: { $in: ["published", "pending_review"] }, "image.provider": { $in: ["local", null] }, "image.searchedAt": null };
  const list = await Article.find(q, { category: 1, translations: 1, image: 1 }).sort({ publishedAt: -1, createdAt: -1 }).limit(3).lean();
  let found = 0;
  for (const a of list) {
    const en = a.translations?.en || {};
    let query = en.title, person = "";
    try {
      const raw = await callAI({
        system: "You pick search terms for news photos. Reply with JSON only.",
        prompt: `Headline: ${en.title}\nSummary: ${en.summary || ""}\n\nReturn {"imageQuery": "2-4 plain English words for a stock photo search that fits this story (places, objects, scenes; no names)", "person": "full name of the one public figure the story is mainly about, or empty"}`,
        maxTokens: 300,
      });
      const j = parseJSON(raw?.text || "") || {};
      if (j.imageQuery) query = String(j.imageQuery).slice(0, 60);
      person = String(j.person || "").slice(0, 60);
    } catch {}
    const img = await findImage(query, a.category, { person, context: `${en.title}. ${en.summary || ""}` });
    const update = img && img.provider !== "local" ? { image: { ...img, searchedAt: new Date() } } : { "image.searchedAt": new Date() };
    if (img && img.provider !== "local") found++;
    await Article.updateOne({ _id: a._id }, update);
  }
  const left = await Article.countDocuments(q);
  if (found) revalidatePath("/", "layout");
  return { ok: true, checked: list.length, found, left };
}

/** Tweet card: fetch a public post on X from its link, add Urdu name/role/translation and a free photo. */
export async function tweetLookupAction(link) {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const { fetchTweet, urduForTweet } = await import("@/lib/tweets");
  try {
    const t = await fetchTweet(link);
    let extra = {};
    try { extra = await urduForTweet(t); } catch {}
    let photo = "", photoCredit = "";
    // People library first (handouts and free photos, Urdu name and role checked once)
    try {
      const { findPeople } = await import("@/lib/people");
      const [lp] = await findPeople([extra.person, t.name, t.handle].filter(Boolean));
      if (lp) {
        const ph = lp.photos?.find((x) => x.primary) || lp.photos?.[0];
        if (ph) { photo = ph.url; photoCredit = `${ph.credit || ""}${ph.license ? ` (${ph.license})` : ""}`; }
        if (lp.nameUr) extra.nameUr = lp.nameUr;
        if (lp.roleUr) extra.role = lp.roleUr;
      }
    } catch {}
    if (!photo && extra.person) {
      try {
        const img = await findImage("", "politics", { person: extra.person });
        if (img?.provider === "wikimedia") { photo = img.url; photoCredit = `${img.credit || "Wikimedia Commons"} / Wikimedia Commons${img.license ? ` (${img.license})` : ""}`; }
      } catch {}
    }
    return { ok: true, ...t, ...extra, photo, photoCredit };
  } catch (e) {
    return { error: e.message };
  }
}

export async function dismissTweetAction(url) {
  if (!(await isLoggedIn())) return { error: "Session expired." };
  await connectDB();
  const cur = (await Setting.findOne({ key: "tweetSuggestions" }).lean())?.value || [];
  await Setting.updateOne({ key: "tweetSuggestions" }, { $set: { value: cur.filter((s) => s.url !== url) } });
  return { ok: true };
}

/** People library: add a handout / own photo to a person (it becomes their main photo). */
export async function addPersonPhotoAction(_prev, formData) {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const { Person } = await import("@/models");
  const id = String(formData.get("id") || "");
  const credit = String(formData.get("credit") || "").trim().slice(0, 120);
  const file = formData.get("file");
  const link = String(formData.get("link") || "").trim();
  if (!mongoose.isValidObjectId(id)) return { error: "Unknown person." };
  if (!credit) return { error: "Write where the photo is from (e.g. \"PID handout\", \"ISPR handout\", \"Pak Dharti TV\")." };
  await connectDB();
  let url;
  if (file && typeof file === "object" && file.size > 0) {
    if (!OK_TYPES.includes(file.type)) return { error: "Use a JPG, PNG or WebP photo." };
    if (file.size > 4 * 1024 * 1024) return { error: "Photo is too large (max 4 MB)." };
    const m = await Media.create({ data: Buffer.from(await file.arrayBuffer()), type: file.type, size: file.size, credit });
    url = `/api/media/${m._id}`;
  } else if (/^https:\/\/\S+$/i.test(link)) url = link;
  else return { error: "Choose a photo file or paste an https:// link." };
  const p = await Person.findById(id);
  if (!p) return { error: "Person not found." };
  p.photos.forEach((x) => { x.primary = false; });
  p.photos.unshift({ url, thumb: url, credit, license: "handout", provider: "handout", primary: true });
  await p.save();
  return { ok: true };
}

export async function updatePersonAction(_prev, formData) {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const { Person } = await import("@/models");
  const id = String(formData.get("id") || "");
  if (!mongoose.isValidObjectId(id)) return { error: "Unknown person." };
  await connectDB();
  const nameUr = String(formData.get("nameUr") || "").trim().slice(0, 80);
  const roleUr = String(formData.get("roleUr") || "").trim().slice(0, 120);
  const set = { roleUr };
  if (nameUr) set.nameUr = nameUr;
  await Person.updateOne({ _id: id }, nameUr ? { $set: set, $addToSet: { aliases: nameUr } } : { $set: set });
  return { ok: true };
}

/** Bayan cards: find people in the library by English or Urdu name; returns their photos and cut-outs. */
export async function searchPeopleAction(q) {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const s = String(q || "").trim();
  if (s.length < 2) return { items: [] };
  const { Person } = await import("@/models");
  const { normName } = await import("@/lib/people");
  await connectDB();
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc(normName(s) || s), "i"), reUr = new RegExp(esc(s));
  const list = await Person.find({ $or: [{ aliases: re }, { aliases: reUr }, { nameUr: reUr }, { name: re }] })
    .sort({ priority: -1, mentions: -1 }).limit(10).lean();
  return {
    items: list.map((p) => ({
      id: String(p._id), name: p.name, nameUr: p.nameUr || "", roleUr: p.roleUr || "", role: p.role || "",
      photos: (p.photos || []).map((ph) => ({
        url: ph.url, thumb: ph.thumb || ph.url, credit: ph.credit || "", license: ph.license || "", provider: ph.provider || "",
        cutout: ph.cutout ? `/api/people/cutout/${ph.cutout}` : "",
      })).sort((a, b) => (b.cutout ? 1 : 0) - (a.cutout ? 1 : 0)),
    })),
  };
}

/** Bayan cards: read a statement post (e.g. a screenshot of another page's post) and return its words,
 *  speaker, date, a title and hashtags. Only the words are used — never the other page's design or photos. */
export async function readStatementPostAction(dataUrl) {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!m) return { error: "Please choose an image." };
  try {
    const r = await withRetryAI(() => callAI({
      system: "You read Urdu news graphics for a Pakistani news page. Reply with JSON only.",
      images: [{ mime: m[1], data: m[2] }],
      prompt: `This image is a social-media post with a statement (quote) by a public figure.
Return JSON:
{"text": "the statement exactly as written in the image, in Urdu, word for word; put *stars* around the words shown in a different colour (highlighted)",
 "speaker": "speaker's full name in English (as commonly spelled), or empty",
 "speakerUr": "speaker's name exactly as written on the image (Urdu), including any title such as وزیراعلیٰ",
 "date": "the date shown on the image in the form 'October 31, 2026', or empty",
 "second": "person | photo | none — what else is in the picture besides the speaker: another politician, or a photo/screenshot/newspaper clipping",
 "secondPerson": "if second is person: that person's full name in English, else empty",
 "title": "an Urdu caption headline for Facebook/Instagram, max 14 words, factual and attention-grabbing, in the form «name: main point»; no false claims, no words not supported by the statement",
 "titleEn": "the same headline in English",
 "mainBox": [ymin, xmin, ymax, xmax] — box around the main speaker's picture (head to the bottom of their body in the image), on a 0-1000 scale; [] if none,
 "secondBox": [ymin, xmin, ymax, xmax] — box around the second person or the photo/screenshot/newspaper clipping (inside its border), 0-1000 scale; [] if none,
 "bottomBox": [ymin, xmin, ymax, xmax] — the whole lower picture area of the post: from just under the big statement text down to the bottom edge, full width (0-1000 scale),
 "eraseBoxes": [[ymin, xmin, ymax, xmax], ...] — EVERY element that belongs to the source page and must be removed, each with a small margin: QR codes, logos, page names and handles, watermarks, the word "Source", quote marks, the name strip and the date badge (0-1000 scale). Do not include the people or the clippings/screenshots,
 "hashtags": ["8 to 12 relevant hashtags without spaces, mixing English and Urdu, e.g. #PakDhartiTV #ImranKhan #عمران_خان #Pakistan; always include #PakDhartiTV"]}
Ignore logos, watermarks, QR codes and page names of the source page; never include the source page's name.`,
      maxTokens: 2000,
    }));
    const j = parseJSON(r.text);
    const { findPeople } = await import("@/lib/people");
    const pack = (p) => p && {
      id: String(p._id), name: p.name, nameUr: p.nameUr || "", roleUr: p.roleUr || "",
      photos: (p.photos || []).map((ph) => ({ url: ph.url, thumb: ph.thumb || ph.url, credit: ph.credit || "", license: ph.license || "",
        cutout: ph.cutout ? `/api/people/cutout/${ph.cutout}` : "" })).sort((a, b) => (b.cutout ? 1 : 0) - (a.cutout ? 1 : 0)),
    };
    const [sp] = j.speaker ? await findPeople([j.speaker]) : [];
    const [sec] = j.secondPerson ? await findPeople([j.secondPerson]) : [];
    const tags = (Array.isArray(j.hashtags) ? j.hashtags : []).map((t) => "#" + String(t).replace(/^#+/, "").replace(/\s+/g, "_")).filter((t) => t.length > 2 && !/siasat/i.test(t));
    if (!tags.includes("#PakDhartiTV")) tags.unshift("#PakDhartiTV");
    return { ok: true, text: String(j.text || "").replace(/siasat\.?pk/gi, "").trim(), speaker: j.speaker || "", speakerUr: j.speakerUr || "",
      date: j.date || "", second: j.second || "none", secondPerson: j.secondPerson || "", title: j.title || "", titleEn: j.titleEn || "",
      hashtags: [...new Set(tags)].slice(0, 14), person: pack(sp) || null, secondP: pack(sec) || null,
      mainBox: Array.isArray(j.mainBox) ? j.mainBox : [], secondBox: Array.isArray(j.secondBox) ? j.secondBox : [],
      bottomBox: Array.isArray(j.bottomBox) ? j.bottomBox : [], eraseBoxes: Array.isArray(j.eraseBoxes) ? j.eraseBoxes.filter((b) => Array.isArray(b) && b.length === 4) : [] };
  } catch (e) {
    return { error: e.message };
  }
}
async function withRetryAI(fn) { try { return await fn(); } catch (e) { await new Promise((r) => setTimeout(r, 1500)); return fn(); } }

/** People library: add someone by hand (journalists, new officials …). The nightly run then looks for free
 *  photos; an uploaded handout gets its cut-out on the next run. */
export async function addPersonAction(_prev, formData) {
  if (!(await isLoggedIn())) return { error: "Session expired. Log in again." };
  const { Person } = await import("@/models");
  const { normName } = await import("@/lib/people");
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const nameUr = String(formData.get("nameUr") || "").trim().slice(0, 80);
  const roleUr = String(formData.get("roleUr") || "").trim().slice(0, 120);
  const group = String(formData.get("group") || "public").trim();
  if (name.length < 3) return { error: "Write the name in English." };
  await connectDB();
  const key = normName(name).replace(/\s+/g, "-");
  const aliases = [...new Set([normName(name), nameUr].filter(Boolean))];
  const found = await Person.findOne({ $or: [{ key }, { aliases: { $in: aliases } }] }).lean();
  if (found) return { ok: true, id: String(found._id), existed: true, name: found.name };
  const p = await Person.create({ key, name, nameUr, roleUr, aliases, groups: [group], priority: 60, urduTried: !!nameUr });
  return { ok: true, id: String(p._id), name };
}
