"use server";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Reel } from "@/models";
import { reelTexts, postReelTo } from "@/lib/reelPublish";

/** One button: post this reel to one platform. Returns { ok, msg }. */
export async function postReelAction(id, platform) {
  if (!(await isLoggedIn())) return { ok: false, msg: "Login again" };
  await connectDB();
  const reel = await Reel.findById(id);
  if (!reel) return { ok: false, msg: "Reel not found" };
  const r = await postReelTo(reel, String(platform));
  if (r.ok) revalidatePath("/admin/reels");
  return r;
}

/** Texts for the copy box (TikTok, YouTube, WhatsApp channel). */
export async function reelTextsAction(id) {
  if (!(await isLoggedIn())) return { error: "Login again" };
  await connectDB();
  const reel = await Reel.findById(id).lean();
  if (!reel) return { error: "Not found" };
  return await reelTexts(reel, "share");
}

/** Schedule (iso = a moment in time) or cancel (iso empty): the timetable posts it to every place that has a key and is not done yet. */
export async function scheduleReelAction(id, iso) {
  if (!(await isLoggedIn())) return { ok: false, msg: "Login again" };
  await connectDB();
  const reel = await Reel.findById(id).select("status").lean();
  if (!reel || !["ready", "approved", "posted"].includes(reel.status)) return { ok: false, msg: "Reel is not ready" };
  if (!iso) { await Reel.updateOne({ _id: id }, { $set: { postAt: null, postErr: "" } }); revalidatePath("/admin/reels"); return { ok: true, msg: "Schedule hata diya" }; }
  const at = new Date(iso);
  if (isNaN(at) || at.getTime() < Date.now() + 60000) return { ok: false, msg: "Waqt aane wala (future mein) chunein" };
  await Reel.updateOne({ _id: id }, { $set: { postAt: at, postErr: "", postTries: 0 } });
  revalidatePath("/admin/reels");
  return { ok: true, msg: "Schedule ho gaya", at: at.toISOString() };
}
