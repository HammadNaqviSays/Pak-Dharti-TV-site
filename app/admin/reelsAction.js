"use server";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { REEL_FONTS, REEL_COLORS, REEL_ANIMS, REEL_STROKES } from "@/lib/reelFonts";
import { Reel, ReelFile, ReelEdit } from "@/models";
import { callAI, parseJSON } from "@/lib/ai";
import { redirect } from "next/navigation";
import { makeNextReelScript, makeReelForSlug } from "@/lib/reelScript";
import { saveReelConfig, REEL_SECTIONS } from "@/lib/reelConfig";
import { previewScenePicture, stockFor, sceneOptions, useSceneOption } from "@/lib/reelMedia";
import { saveReelFile } from "@/lib/reelMedia";
import { speak, VOICES } from "@/lib/tts";
import { kickReels } from "@/lib/reelKick";


export async function makeReelScriptAction() {
  if (!(await isLoggedIn())) return;
  await connectDB();
  try { await makeNextReelScript({ manual: true }); } catch { /* shown by the list staying the same */ }
  revalidatePath("/admin/reels");
}
export async function makeReelForStoryAction(fd) {
  if (!(await isLoggedIn())) return;
  await connectDB();
  try { await makeReelForSlug(String(fd.get("slug") || "")); } catch { /* the reels page shows what exists */ }
  revalidatePath("/admin/reels");
  redirect("/admin/reels");
}
/** Starts a reel for a story and returns its id (the page opens the editor in a new tab). */
export async function startReelAction(slug) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  await connectDB();
  try {
    const r = await makeReelForSlug(String(slug || ""));
    revalidatePath("/admin");
    if (r.error) return { error: r.error };
    return { id: r.exists || String(r.reel._id) };
  } catch (e) { return { error: "Could not write the script, try again" }; }
}
export async function setReelStatusAction(fd) {
  if (!(await isLoggedIn())) return;
  await connectDB();
  const status = String(fd.get("status"));
  if (!["approved", "rejected", "scripted"].includes(status)) return;
  await Reel.updateOne({ _id: String(fd.get("id")) }, { $set: status === "scripted" ? { status, tries: 0, error: "" } : { status } });
  if (status === "scripted") await kickReels();
  revalidatePath("/admin/reels");
}

/** Saves the editor: wording, word colours, how each text comes in, its size, and the font. Returns { ok } or { error }. */
export async function saveReelEditAction(id, payload, remake) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  await connectDB();
  const r = await Reel.findById(String(id));
  if (!r) return { error: "Reel not found" };
  const fonts = REEL_FONTS.map((f) => f.key);
  const style = { font: fonts.includes(payload?.font) ? payload.font : "jameel", stroke: REEL_STROKES[payload?.stroke] ? payload.stroke : "r",
    badge: String(payload?.badge || "").trim().slice(0, 30),
    grade: ["cinematic", "warm", "cool", "mono", "tealorange"].includes(payload?.grade) ? payload.grade : "",
    noise: ["white", "black"].includes(payload?.noise) ? payload.noise : "none", noiseAmt: ["low", "mid", "high"].includes(payload?.noiseAmt) ? payload.noiseAmt : "mid", mirror: !!payload?.mirror, bgAlpha: Math.min(100, Math.max(20, Math.round(Number(payload?.bgAlpha)) || 100)) };
  const incoming = Array.isArray(payload?.scenes) ? payload.scenes : [];
  if (incoming.length !== r.scenes.length) return { error: "Scene count changed, reload the page" };
  const scenes = r.scenes.map((old, n) => {
    const s = incoming[n] || {};
    const text = String(s.text ?? old.text).replace(/\s+/g, " ").trim().slice(0, 240) || old.text;
    const count = text.split(" ").length;
    const marks = (Array.isArray(s.marks) ? s.marks : []).filter((m) => Number.isInteger(m?.i) && m.i >= 0 && m.i < count && REEL_COLORS[m?.c] && m.c !== "k")
      .map((m) => ({ i: m.i, c: m.c }));
    const size = Math.max(0, Math.min(110, Math.round(Number(s.size) || 0)));
    return { ...old.toObject(), text, marks, anim: REEL_ANIMS[s.anim] ? s.anim : "right", size: size && size < 40 ? 40 : size, edited: true,
      mirror: !!s.mirror };   // pictures, clips and extra pictures are saved at once by their own buttons, so the editor keeps them as they are
  });
  r.scenes = scenes; r.style = style;
  if (remake) { r.status = "scripted"; r.tries = 0; r.error = ""; r.videoUrl = ""; }
  await r.save();
  if (remake) await kickReels();
  revalidatePath("/admin/reels");
  return { ok: true };
}

/** The editor's own picture for one scene (the page shrinks it to about 1500 px before sending). */
export async function uploadReelPicAction(fd) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  const id = String(fd.get("id") || ""), n = Number(fd.get("n")), k = Number(fd.get("k") || 0);
  const file = fd.get("file");
  if (!/^[a-f0-9]{24}$/.test(id) || !(n >= 0 && n < 20) || ![0, 1, 2, 3].includes(k) || !file || typeof file.arrayBuffer !== "function") return { error: "Bad request" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 2000 || buf.length > 3.5 * 1024 * 1024 || buf[0] !== 0xff || buf[1] !== 0xd8) return { error: "Please choose a JPG or PNG picture (under 3 MB)" };
  await connectDB();
  const kind = k ? `pic${n}x${k}` : `pic${n}`;
  await saveReelFile(id, kind, 0, buf);
  return { ok: true, url: `/api/reels/${id}/${kind}?v=${Date.now().toString(36)}` };
}

/** Your own video clip for one scene, sent in pieces of up to 3 MB (clips up to 20 MB). */
export async function uploadReelClipAction(fd) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  const id = String(fd.get("id") || ""), n = Number(fd.get("n")), part = Number(fd.get("part")), total = Number(fd.get("total"));
  const file = fd.get("file");
  if (!/^[a-f0-9]{24}$/.test(id) || !(n >= 0 && n < 20) || !(total >= 1 && total <= 7) || !(part >= 0 && part < total) || !file || typeof file.arrayBuffer !== "function") return { error: "Bad request" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 3.2 * 1024 * 1024) return { error: "Piece too large" };
  if (part === 0) {
    const ok = (buf.length > 12 && buf.subarray(4, 8).toString() === "ftyp") || (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3);
    if (!ok) return { error: "Please choose an MP4, MOV or WebM video" };
    await connectDB();
    await ReelFile.deleteMany({ reel: id, kind: `clip${n}` });
  }
  await saveReelFile(id, `clip${n}`, part, buf);
  return { ok: true, url: `/api/reels/${id}/clip${n}?v=${Date.now().toString(36)}` };
}

/** Saves (or clears) the own picture / clip of ONE scene, from the list. */
export async function setReelSceneMediaAction(id, n, kind, url, pos) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n);
  if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(n) || n < 0) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id);
  if (!r || !r.scenes[n]) return { error: "Reel or line not found" };
  if (kind === "pic" && String(url).startsWith(`/api/reels/${id}/pic${n}`)) { r.scenes[n].pic = url; r.scenes[n].clip = ""; r.scenes[n].imgFixed = false; }
  else if (kind === "clip" && String(url).startsWith(`/api/reels/${id}/clip${n}`)) { r.scenes[n].clip = url; r.scenes[n].pic = ""; r.scenes[n].imgFixed = false; }
  else if (/^extra[1-3]$/.test(kind) && String(url).startsWith(`/api/reels/${id}/pic${n}x${kind.slice(-1)}`)) {
    // the picture keeps its own slot (x1..x3): it replaces the picture of that slot, or is added at the end
    const base = String(url).split("?")[0];
    const ex = [...(r.scenes[n].extra || [])]; const at_ = Number.isInteger(pos) && pos >= 0 && pos < ex.length ? pos : ex.findIndex((u) => String(u).split("?")[0] === base);
    if (at_ >= 0) ex[at_] = url; else if (ex.length < 3) ex.push(url); else return { error: "At most 4 pictures in one line" };
    r.scenes[n].extra = ex.filter(Boolean);
    if (!r.scenes[n].pic) { r.scenes[n].imgFixed = r.scenes[n].imgFixed; }
  }
  else if (kind === "none") { r.scenes[n].extra = []; r.scenes[n].pic = ""; r.scenes[n].clip = ""; r.scenes[n].img = ""; r.scenes[n].imgFixed = false; r.scenes[n].alt = 0; }
  else return { error: "Bad request" };
  r.markModified("scenes");
  await r.save();
  revalidatePath("/admin/reels");
  return { ok: true };
}

/** Changes the words of ONE line, from the list. */
export async function setReelSceneTextAction(id, n, text) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n);
  const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(n) || n < 0 || t.length < 2) return { error: "Write something first" };
  await connectDB();
  const r = await Reel.findById(id);
  if (!r || !r.scenes[n]) return { error: "Reel or line not found" };
  if (!["draft", "scripted", "ready", "failed"].includes(r.status)) return { error: "The video is being made right now, try in a few minutes" };
  const before = r.scenes[n].text;
  r.scenes[n].text = t; r.scenes[n].marks = []; r.scenes[n].edited = false;
  if (before !== t) await logEdit(id, n, "text", before, t);
  r.markModified("scenes");
  await r.save();
  revalidatePath("/admin/reels");
  return { ok: true };
}

/** Reel settings from the form at the top of the Reels page. */
export async function saveReelConfigAction(fd) {
  if (!(await isLoggedIn())) return;
  await saveReelConfig({
    auto: fd.get("auto") === "on",
    perDay: Math.min(10, Math.max(1, Math.round(Number(fd.get("perDay"))) || 3)),
    cats: REEL_SECTIONS.filter((c) => fd.get(`cat_${c}`) === "on"),
    minGapHours: Math.min(12, Math.max(1, Number(fd.get("minGapHours")) || 2)),
    ptiFirst: fd.get("ptiFirst") === "on",
  });
  revalidatePath("/admin/reels");
}

/** The picture of one line, for the preview next to it ("show") or the next stock picture ("other"). */
export async function reelScenePictureAction(id, n, mode) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n);
  if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(n) || n < 0) return { error: "Bad request" };
  try { return await previewScenePicture(id, n, mode === "other" ? "other" : "show"); } catch (e) { return { error: String(e.message || e).slice(0, 120) }; }
}

const okId = (id) => /^[a-f0-9]{24}$/.test(id);
async function logEdit(reel, scene, kind, before = "", after = "", note = "") {
  try { await ReelEdit.create({ reel, scene, kind, before: String(before).slice(0, 400), after: String(after).slice(0, 400), note: String(note).slice(0, 200) }); } catch { /* history is a bonus */ }
}

/** Moves the own files of lines from..end by delta (+1 / -1) and fixes their addresses inside the scenes. */
async function shiftMedia(r, id, from, delta) {
  const last = r.scenes.length - 1;
  const order = []; for (let m = from; m <= last; m++) order.push(m);
  if (delta > 0) order.reverse();
  for (const m of order) {
    for (const suf of ["", "x1", "x2", "x3"]) await ReelFile.updateMany({ reel: id, kind: `pic${m}${suf}` }, { $set: { kind: `pic${m + delta}${suf}` } });
    await ReelFile.updateMany({ reel: id, kind: `clip${m}` }, { $set: { kind: `clip${m + delta}` } });
    const sc = r.scenes[m]; if (!sc) continue;
    const fix = (u) => (typeof u === "string" && u.startsWith(`/api/reels/${id}/`) ? u.replace(/\/(pic|clip)\d+/, (_, k) => `/${k}${m + delta}`) : u);
    sc.pic = fix(sc.pic); sc.clip = fix(sc.clip); sc.extra = (sc.extra || []).map(fix);
  }
}

/** Puts a new line right after line n (n = -1: at the very start). Pictures of the later lines move with them. */
export async function addReelLineAction(id, n, text) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n);
  const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (!okId(id) || !Number.isInteger(n) || n < -1 || t.length < 2) return { error: "Write the new line first" };
  await connectDB();
  const r = await Reel.findById(id);
  if (!r || n >= r.scenes.length) return { error: "Reel or line not found" };
  if (!["draft", "scripted", "ready", "failed"].includes(r.status)) return { error: "The video is being made right now, try in a few minutes" };
  if (r.scenes.length >= 12) return { error: "12 lines is the most" };
  await shiftMedia(r, id, n + 1, +1);
  const base = r.scenes[Math.max(0, n)];
  r.scenes.splice(n + 1, 0, { text: t, kw: base?.kw || "", who: "", src: "", marks: [], extra: [], extraAt: [] });
  r.markModified("scenes"); await r.save();
  await logEdit(id, n + 1, "addLine", "", t);
  revalidatePath("/admin/reels");
  return { ok: true };
}

/** Removes one line (a reel keeps at least 3). */
export async function deleteReelLineAction(id, n) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n);
  if (!okId(id) || !Number.isInteger(n) || n < 0) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id);
  if (!r || !r.scenes[n]) return { error: "Reel or line not found" };
  if (!["draft", "scripted", "ready", "failed"].includes(r.status)) return { error: "The video is being made right now, try in a few minutes" };
  if (r.scenes.length <= 3) return { error: "A reel needs at least 3 lines" };
  const gone = r.scenes[n].text;
  await ReelFile.deleteMany({ reel: id, kind: { $in: [`pic${n}`, `pic${n}x1`, `pic${n}x2`, `pic${n}x3`, `clip${n}`] } });
  await shiftMedia(r, id, n + 1, -1); // later lines (still at their old places) move down by one
  r.scenes.splice(n, 1);
  r.markModified("scenes"); await r.save();
  await logEdit(id, n, "deleteLine", gone, "");
  revalidatePath("/admin/reels");
  return { ok: true };
}

/** Says at which WORD of the line the 2nd / 3rd picture starts. at = [wordIndex, wordIndex]. */
export async function setReelSceneSplitAction(id, n, at) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n);
  if (!okId(id) || !Number.isInteger(n) || n < 0 || !Array.isArray(at)) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id);
  if (!r || !r.scenes[n]) return { error: "Reel or line not found" };
  const nw = Math.max(2, r.scenes[n].text.split(/\s+/).length);
  let prev = 0; const out = [];
  for (const a of at.slice(0, 3)) { const v = Math.min(nw - 1, Math.max(prev + 1, Math.round(Number(a)) || 0)); out.push(v); prev = v; }
  r.scenes[n].extraAt = out; r.markModified("scenes"); await r.save();
  await logEdit(id, n, "split", "", out.join(","));
  return { ok: true, at: out };
}

/** AI reads the line, cuts it into 2-3 parts by meaning and finds a picture for each part. */
export async function suggestScenePicturesAction(id, n) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n);
  if (!okId(id) || !Number.isInteger(n) || n < 0) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id);
  if (!r || !r.scenes[n]) return { error: "Reel or line not found" };
  if (!["draft", "scripted", "ready", "failed"].includes(r.status)) return { error: "The video is being made right now, try in a few minutes" };
  const sc = r.scenes[n], words = sc.text.split(/\s+/);
  if (words.length < 6) return { error: "This line is too short to need more than one picture" };
  try {
    const { text } = await callAI({
      system: "You are a picture editor of a Pakistani Urdu news channel. Reply with JSON only.",
      prompt: `This reel line has ${words.length} words (numbered from 0):
${words.map((w, i) => `${i}:${w}`).join(" ")}
Cut it into 2 or 3 parts by meaning (only 3 if it really has three different subjects), each part at least 3 words. For each part give "from" (index of its first word; the first part is 0), "kw" (2-4 English words for a generic stock picture that matches that part exactly — a place, object or situation, never a real person's name, never children or victims) and "who" (full English name of ONE public figure that part is about, else "").
Return {"parts":[{"from":0,"kw":"...","who":""}]}`,
      maxTokens: 600, prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
    });
    const parts = (parseJSON(text)?.parts || []).slice(0, 3);
    if (parts.length < 2) return { error: "AI could not split this line, try again" };
    const used = new Set(), urls = [], credits = [], at = [];
    let prev = -1;
    for (const [i, p] of parts.entries()) {
      const from = i === 0 ? 0 : Math.round(Number(p.from));
      if (i > 0) { if (!(from > prev && from < words.length - 1)) continue; at.push(from); }
      prev = from;
      const pic = await stockFor({ kw: String(p.kw || "").replace(/[^A-Za-z ]/g, " ").trim().slice(0, 40), who: String(p.who || "").replace(/[^A-Za-z .'-]/g, "").trim().slice(0, 60) }, used, 0);
      if (pic?.url) { urls.push(pic.url); credits.push(pic.credit || ""); used.add(pic.url); }
      else if (i === 0) urls.push(sc.img || "");
    }
    if (urls.length < 2 || !urls[0]) return { error: "Could not find pictures for the parts, try again or add your own" };
    const k = urls.length; at.length = k - 1;
    sc.pic = ""; sc.clip = ""; sc.img = urls[0]; sc.credit = credits[0] || ""; sc.imgFixed = true;
    sc.extra = urls.slice(1); sc.extraAt = at;
    r.markModified("scenes"); await r.save();
    await logEdit(id, n, "suggest", "", parts.map((p) => p.kw).join(" | "));
    revalidatePath("/admin/reels");
    return { ok: true, urls, at };
  } catch (e) { return { error: String(e.message || e).slice(0, 120) }; }
}

/** Marks that the editor chose his own picture/clip for a line (history for learning). */
export async function logReelMediaAction(id, n, kind, note = "") {
  if (!(await isLoggedIn())) return;
  id = String(id); n = Number(n);
  if (!okId(id) || !Number.isInteger(n)) return;
  await connectDB(); await logEdit(id, n, ["picture", "clip", "extra"].includes(kind) ? kind : "picture", "", "", note);
}

/** Deletes one reel with all its files. */
export async function deleteReelAction(id) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id);
  if (!okId(id)) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id).select("status").lean();
  if (!r) return { ok: true };
  if (["rendering", "posted"].includes(r.status)) return { error: r.status === "posted" ? "A posted reel is kept" : "It is being made right now, try in a few minutes" };
  await ReelFile.deleteMany({ reel: id });
  await Reel.deleteOne({ _id: id });
  revalidatePath("/admin/reels");
  return { ok: true };
}

/** Deletes all rejected and failed reels at once. */
export async function deleteRejectedReelsAction() {
  if (!(await isLoggedIn())) return;
  await connectDB();
  const rows = await Reel.find({ status: { $in: ["rejected", "failed"] } }).select("_id").lean();
  for (const x of rows) { await ReelFile.deleteMany({ reel: x._id }); await Reel.deleteOne({ _id: x._id }); }
  revalidatePath("/admin/reels");
}

const stateOf = (sc) => ({ main: sc.pic || sc.img || "", extra: sc.extra || [], at: sc.extraAt || [] });

/** Joins the words of picture seg to the picture before it (dir "prev") or after it (dir "next"): that picture is dropped. */
export async function mergeSceneSegmentAction(id, n, seg, dir) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n); seg = Number(seg);
  if (!okId(id) || !Number.isInteger(n) || !Number.isInteger(seg) || n < 0 || seg < 0) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id); const sc = r?.scenes?.[n];
  if (!sc) return { error: "Reel or line not found" };
  const P = [sc.pic || sc.img || "", ...(sc.extra || [])], S = [0, ...(sc.extraAt || [])];
  if (seg >= P.length || P.length < 2) return { error: "Nothing to join" };
  if (dir === "prev" && seg > 0) { P.splice(seg, 1); S.splice(seg, 1); }
  else if (dir === "next" && seg < P.length - 1) { P.splice(seg, 1); S.splice(seg + 1, 1); }
  else return { error: "Nothing to join" };
  if (seg === 0) { sc.pic = ""; sc.imgFixed = true; sc.credit = ""; }
  sc.img = sc.pic ? sc.img : P[0]; sc.extra = P.slice(1); sc.extraAt = S.slice(1);
  r.markModified("scenes"); await r.save();
  await logEdit(id, n, "split", "", `join ${dir} ${seg}`);
  return { ok: true, ...stateOf(sc) };
}

/** Where is this reel now? (the editor asks every few seconds while the video is being made) */
export async function reelStatusAction(id) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id);
  if (!okId(id)) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id).select("status error videoUrl updatedAt durationSec").lean();
  if (!r) return { error: "Reel not found" };
  return { status: r.status, error: r.error || "", videoUrl: r.videoUrl || "", sec: Math.max(0, Math.round((Date.now() - new Date(r.updatedAt).getTime()) / 1000)) };
}

/** Removes picture seg (any of them). Its words are shared: the first half goes to the picture before, the second half to the picture after. */
export async function removeSceneSegmentAction(id, n, seg) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n); seg = Number(seg);
  if (!okId(id) || !Number.isInteger(n) || !Number.isInteger(seg) || n < 0 || seg < 0) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id); const sc = r?.scenes?.[n];
  if (!sc) return { error: "Reel or line not found" };
  const P = [sc.pic || sc.img || "", ...(sc.extra || [])], S = [0, ...(sc.extraAt || [])];
  if (P.length < 2 || seg >= P.length) return { error: "A line needs at least one picture" };
  const nw = Math.max(1, sc.text.split(/\s+/).filter(Boolean).length);
  const a = S[seg], b = S[seg + 1] ?? nw;
  const gone = P[seg];
  if (seg === 0) { P.splice(0, 1); S.splice(1, 1); }                       // the next picture takes all the words
  else if (seg === P.length - 1) { P.splice(seg, 1); S.splice(seg, 1); }    // the previous picture takes all the words
  else { S[seg + 1] = a + Math.floor((b - a) / 2); P.splice(seg, 1); S.splice(seg, 1); }
  if (seg === 0) { sc.pic = ""; sc.imgFixed = true; sc.credit = ""; }
  sc.img = sc.pic ? sc.img : P[0]; sc.extra = P.slice(1); sc.extraAt = S.slice(1);
  const m = /\/pic\d+x(\d)/.exec(String(gone));
  if (m && seg > 0) await ReelFile.deleteMany({ reel: id, kind: `pic${n}x${m[1]}` });
  r.markModified("scenes"); await r.save();
  await logEdit(id, n, "split", "", `remove ${seg}`);
  return { ok: true, ...stateOf(sc) };
}

/** Another stock picture for part seg (seg 0 = the first picture). */
export async function changeSegmentPictureAction(id, n, seg) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n); seg = Number(seg);
  if (!okId(id) || !Number.isInteger(n) || !Number.isInteger(seg) || n < 0 || seg < 1 || seg > 3) return { error: "Bad request" };
  await connectDB();
  const r = await Reel.findById(id); const sc = r?.scenes?.[n];
  if (!sc || !sc.extra?.[seg - 1]) return { error: "Reel or line not found" };
  const used = new Set([sc.img, sc.pic, ...(sc.extra || [])].filter(Boolean));
  try {
    const pic = await stockFor({ kw: sc.kw || "", who: "" }, used, 1 + Math.floor(Math.random() * 8));
    if (!pic?.url) return { error: "No other picture found. Use My picture." };
    const ex = [...sc.extra]; ex[seg - 1] = pic.url; sc.extra = ex;
    r.markModified("scenes"); await r.save();
    await logEdit(id, n, "picture", "", "", "other part " + seg);
    return { ok: true, ...stateOf(sc) };
  } catch (e) { return { error: String(e.message || e).slice(0, 120) }; }
}

/** Suggested pictures for one line (to choose from). */
export async function sceneOptionsAction(id, n, q = "") {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n);
  if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(n) || n < 0) return { error: "Bad request" };
  try { return await sceneOptions(id, n, String(q || "").slice(0, 80)); } catch (e) { return { error: String(e.message || e).slice(0, 120) }; }
}
export async function useSceneOptionAction(id, n, url, credit = "") {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id); n = Number(n); url = String(url || "");
  if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(n) || n < 0 || !/^https:\/\//.test(url)) return { error: "Bad request" };
  try { return await useSceneOption(id, n, url, credit); } catch (e) { return { error: String(e.message || e).slice(0, 120) }; }
}

/** A short sample of the first line in the chosen voice, to listen to before choosing. */
export async function previewVoiceAction(id, voice) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id);
  if (!/^[a-f0-9]{24}$/.test(id) || !VOICES.includes(voice)) return { error: "Bad request" };
  try {
    await connectDB();
    const r = await Reel.findById(id).select("scenes").lean();
    const text = String(r?.scenes?.[0]?.text || "").slice(0, 140);
    if (!text) return { error: "No text" };
    const v = await speak(text, { voice });
    return { src: "data:audio/wav;base64," + v.wav.toString("base64") };
  } catch (e) { return { error: "Could not make the sample now (voice quota?). " + String(e.message || e).slice(0, 80) }; }
}

/** The voice used for this reel's voice-over ("" = the default voice). It is spoken again the next time the video is made. */
export async function setReelVoiceAction(id, voice) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  id = String(id);
  if (!/^[a-f0-9]{24}$/.test(id) || (voice && !VOICES.includes(voice))) return { error: "Bad request" };
  await connectDB();
  await Reel.updateOne({ _id: id }, { $set: { voice: voice || "" } });
  return { ok: true };
}
