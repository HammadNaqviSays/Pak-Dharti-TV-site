"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Setting } from "@/models";
import { normVoice, speak } from "@/lib/tts";

export async function saveVoiceAction(values) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const value = normVoice(values || {});
  await Setting.findOneAndUpdate({ key: "voice" }, { key: "voice", value }, { upsert: true });
  return { ok: true, ...value };
}

/** Speak a short sample with the settings on screen so they can be heard before saving. */
export async function testVoiceAction(values, text) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  const t = String(text || "").trim().slice(0, 400);
  if (!t) return { error: "Type some text first" };
  try {
    const r = await speak(t, normVoice(values || {}));
    return { ok: true, audio: `data:audio/wav;base64,${r.wav.toString("base64")}`, seconds: Math.round(r.seconds * 10) / 10, model: r.model };
  } catch (e) {
    return { error: e.status === 429 ? "All Google keys are over their limit right now. Try again in a minute." : `Could not make the voice (${e.message.slice(0, 120)})` };
  }
}
