// Spoken narration for reels. Uses the Gemini text-to-speech model with the same Google keys as the news writing
// (GEMINI_API_KEY, GEMINI_API_KEY_2 ...), so no separate account is needed. Look and voice are set in Mission Control > Voice.
import { Setting } from "@/models";
import { connectDB } from "./db";

export const VOICES = ["Algenib", "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe", "Enceladus",
  "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Rasalgethi", "Laomedeia", "Achernar", "Alnilam", "Schedar", "Gacrux",
  "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"];
export const VOICE_DEFAULT = {
  voice: "Algenib",
  // every model has its own free daily quota, so the next one is tried when one is used up or not found
  model: "gemini-3.1-flash-tts-preview, gemini-3.8-flash-tts-preview, gemini-3.8-flash-lite-tts-preview, gemini-2.5-flash-preview-tts",
  style: "Read aloud in the calm, serious, measured tone of a TV news documentary narrator.",
  on: true,
  speed: 1,
};

export function normVoice(x = {}) {
  return {
    voice: VOICES.includes(x.voice) ? x.voice : VOICE_DEFAULT.voice,
    model: String(x.model || "").split(",").map((m) => m.trim()).filter((m) => /^[a-z0-9.\-]{3,60}$/i.test(m)).slice(0, 6).join(", ") || VOICE_DEFAULT.model,
    style: String(x.style ?? VOICE_DEFAULT.style).slice(0, 300),
    on: x.on !== false,
    speed: Math.min(1.4, Math.max(0.8, Math.round((Number(x.speed) || 1) * 100) / 100)),
  };
}

let memo = { at: 0, v: null };
export async function getVoice(fresh = false) {
  if (!fresh && memo.v && Date.now() - memo.at < 60000) return memo.v;
  let v = VOICE_DEFAULT;
  try { await connectDB(); v = normVoice((await Setting.findOne({ key: "voice" }).lean())?.value || {}); } catch { /* keep defaults */ }
  memo = { at: Date.now(), v };
  return v;
}

const keys = () => [process.env.GEMINI_API_KEY, ...[2, 3, 4, 5].map((i) => process.env[`GEMINI_API_KEY_${i}`])].filter(Boolean);

function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Speak `text`. Tries every Google key in turn when one is out of quota. Returns { wav: Buffer, seconds } or throws. */
export async function speak(text, opts = {}) {
  const cfg = { ...(await getVoice()), ...opts };
  const ks = keys();
  if (!ks.length) throw new Error("No Gemini key set");
  const prompt = cfg.style ? `${cfg.style}\n\n${text}` : text;
  const models = cfg.model.split(",").map((m) => m.trim()).filter(Boolean);
  let last;
  for (const model of models) {
    let missing = false;
    for (const key of ks) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } } } },
        }),
      });
      if (!res.ok) {
        last = new Error(`TTS ${model} ${res.status}: ${(await res.text()).slice(0, 160)}`); last.status = res.status;
        if (res.status === 404) { missing = true; break; }                    // this model name does not exist: next model
        if ([400, 401, 403, 429, 500, 503].includes(res.status)) continue;   // this key is out of quota / refused: next key
        throw last;
      }
      const data = await res.json();
      const part = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
      if (!part) { last = new Error(`TTS ${model} returned no audio`); continue; }
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1]) || 24000;
      const pcm = Buffer.from(part.inlineData.data, "base64");
      return { wav: wav(pcm, rate), seconds: pcm.length / 2 / rate, model };
    }
    if (missing) continue;
  }
  throw last || new Error("TTS failed");
}
