"use server";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Reel } from "@/models";
import { reelTexts, postReelTo } from "@/lib/reelPublish";

/** One button: post this reel to one platform. Returns { ok, msg }. */
async function postReelAction_(id, platform) {
  if (!(await isLoggedIn())) return { ok: false, msg: "Login again" };
  freshDB();   // a Worker cannot reuse the database link of an earlier request: connect for this one
  await connectDB();
  const reel = await Reel.findById(id);
  if (!reel) return { ok: false, msg: "Reel not found" };
  const r = await postReelTo(reel, String(platform));
  if (r.ok) revalidatePath("/admin/reels");
  return r;
}

/** Texts for the copy box (TikTok, YouTube, WhatsApp channel). */
async function reelTextsAction_(id) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  freshDB();   // a Worker cannot reuse the database link of an earlier request: connect for this one
  await connectDB();
  const reel = await Reel.findById(id).lean();
  if (!reel) return { error: "Not found" };
  return await reelTexts(reel, "share");
}

/** Schedule (iso = a moment in time) or cancel (iso empty): the timetable posts it to every place that has a key and is not done yet. */
async function scheduleReelAction_(id, iso) {
  if (!(await isLoggedIn())) return { ok: false, msg: "Login again" };
  freshDB();   // a Worker cannot reuse the database link of an earlier request: connect for this one
  await connectDB();
  const reel = await Reel.findById(id).select("status").lean();
  if (!reel || !["ready", "approved", "posted"].includes(reel.status)) return { ok: false, msg: "Reel is not ready" };
  if (!iso) { await Reel.updateOne({ _id: id }, { $set: { postAt: null, postErr: "" } }); revalidatePath("/admin/reels"); return { ok: true, msg: "Schedule cancelled" }; }
  const at = new Date(iso);
  if (isNaN(at) || at.getTime() < Date.now() + 60000) return { ok: false, msg: "Choose a time in the future" };
  await Reel.updateOne({ _id: id }, { $set: { postAt: at, postErr: "", postTries: 0 } });
  revalidatePath("/admin/reels");
  return { ok: true, msg: "Scheduled", at: at.toISOString() };
}

export async function postReelAction(id, platform) {
  try { return await postReelAction_(id, platform); }
  catch (e) { const m = String(e?.message || e).slice(0, 160); console.error("[postReelAction]", m); return { ok: false, msg: "❌ " + m }; }
}

export async function reelTextsAction(id) {
  try { return await guard(reelTextsAction_(id)); }
  catch (e) { const m = String(e?.message || e).slice(0, 160); console.error("[reelTextsAction]", m); return { error: m }; }
}

export async function scheduleReelAction(id, iso) {
  try { return await guard(scheduleReelAction_(id, iso)); }
  catch (e) { const m = String(e?.message || e).slice(0, 160); console.error("[scheduleReelAction]", m); return { ok: false, msg: "❌ " + m }; }
}

/** a database call that never answers must not leave the button waiting for ever */
function guard(p, ms = 25000) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("The database did not answer in time. Please try again.")), ms))]); }
