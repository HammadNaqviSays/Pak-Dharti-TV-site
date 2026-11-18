// AI provider adapter. Default: Google Gemini (free tier, no card needed).
// Set AI_PROVIDER=anthropic to use Claude instead. The rest of the code only
// depends on callAI() returning { text, usage, model }.
const PROVIDER = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const MODEL = process.env.AI_MODEL || (PROVIDER === "gemini" ? "gemini-flash-latest" : "claude-sonnet-5-5");

/** images: optional [{ data: base64, mime: "image/jpeg" }] — the model reads them along with the prompt. */
export async function callAI({ system, prompt, maxTokens = 3000, images = [], prefer = [] }) {
  return PROVIDER === "anthropic"
    ? callAnthropic({ system, prompt, maxTokens, images })
    : callGemini({ system, prompt, maxTokens, images, prefer });
}

// Free-tier Gemini models each have their own quota (requests per minute and per day), so when the main model is
// busy (429/503/500) or its name is not found (404) the next one is tried. Override with AI_FALLBACK_MODELS=a,b,c.
const FALLBACKS = (process.env.AI_FALLBACK_MODELS || "gemini-3.5-flash-lite,gemini-3-flash-preview,gemini-3.8-flash,gemini-3.6-flash")
  .split(",").map((m) => m.trim()).filter(Boolean);
const CHAIN = [...new Set([MODEL, ...FALLBACKS])];
const RETRYABLE = new Set([404, 429, 500, 503]);
// Extra Google accounts give extra free quota: set GEMINI_API_KEY_2, GEMINI_API_KEY_3 ... in the environment.
const KEYS = [process.env.GEMINI_API_KEY, ...[2, 3, 4, 5].map((i) => process.env[`GEMINI_API_KEY_${i}`])].filter(Boolean);
const strikes = new Map(); // model -> consecutive 429s (a daily quota that is used up keeps saying 429, so the pause grows)
const cooldown = new Map(); // model -> time (ms) before which it is skipped (a model that just said "too many requests")

async function callGemini({ prefer = [], ...args }) {
  let lastErr, realErr;
  const now = Date.now(), began = now;
  const names = [...new Set([...prefer, ...CHAIN])];
  // every model on every key; a model that is resting on one key is still tried on the next key first
  // the key to start with is picked at random on every call, so the load is shared evenly instead of always draining key 1 first
  const idx = (KEYS.length ? KEYS : [undefined]).map((_, k) => k);
  const start = Math.floor(Math.random() * idx.length);
  const keyOrder = [...idx.slice(start), ...idx.slice(0, start)];
  const base = names.flatMap((m) => keyOrder.map((k) => `${m}#${k}`));
  const order = [...base.filter((m) => (cooldown.get(m) || 0) <= now), ...base.filter((m) => (cooldown.get(m) || 0) > now)];
  for (const slot of order) {
    if (lastErr && Date.now() - began > 40e3) break;   // a Vercel run dies at 60 s: give up in time so the story can be kept for the next run
    const [model, k] = [slot.slice(0, slot.lastIndexOf("#")), Number(slot.slice(slot.lastIndexOf("#") + 1))];
    try {
      const out = await callGeminiModel(model, args, KEYS[k] || process.env.GEMINI_API_KEY);
      strikes.delete(slot);
      return out;
    } catch (e) {
      lastErr = e;
      if (e.status !== 404) realErr = e; // a 404 (model gone) must not hide the real reason, e.g. 429 quota
      if (e.status === 404) cooldown.set(slot, Date.now() + 3600e3);       // unknown model name: skip for an hour
      else if (e.status === 429) {                                          // over its limit: skip 1 min, then 5, then 30 (daily quota)
        const n = (strikes.get(slot) || 0) + 1; strikes.set(slot, n);
        cooldown.set(slot, Date.now() + (n >= 3 ? 1800e3 : n === 2 ? 300e3 : 60e3));
      }
      else if (e.status === 503 || e.status === 500) cooldown.set(slot, Date.now() + 20e3);
      else if (!e.status && /abort|timeout/i.test(e.name + e.message)) cooldown.set(slot, Date.now() + 60e3); // hung: rest it a minute
      if (e.status === 401 || e.status === 403 || /API key/i.test(e.message)) { cooldown.set(slot, Date.now() + 3600e3); if (KEYS.length > 1) { console.error(`Gemini key ${k + 1} rejected`); continue; } }
      if (e.status && !RETRYABLE.has(e.status)) throw e;                   // bad key, bad request, ...: another model will not help
      console.error(`Gemini ${model} (key ${k + 1}) failed (${e.status || e.message}); trying the next model`);
    }
  }
  throw realErr || lastErr;
}

async function callGeminiModel(MODEL, { system, prompt, maxTokens, images = [] }, key) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      signal: AbortSignal.timeout(22e3),   // a model that hangs must not eat the whole 60 s
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [...images.map((im) => ({ inlineData: { mimeType: im.mime, data: im.data } })), { text: prompt }] }],
        generationConfig: {
          maxOutputTokens: Math.max(maxTokens, 8192), // leaves room for the model's internal "thinking"
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  if (!text) throw new Error(`Gemini returned no text (${data.candidates?.[0]?.finishReason || "unknown"})`);
  return {
    text,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0),
    },
    model: MODEL,
  };
}

async function callAnthropic({ system, prompt, maxTokens, images = [] }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, system,
      messages: [{ role: "user", content: images.length
        ? [...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mime, data: im.data } })), { type: "text", text: prompt }]
        : prompt }],
    }),
  });
  if (!res.ok) {
    const err = new Error(`AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return {
    text: data.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
    usage: { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 },
    model: data.model || MODEL,
  };
}

export function parseJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  // a bare list ([{...}, {...}]) is valid JSON too
  if (clean.startsWith("[")) { try { return { items: JSON.parse(clean) }; } catch {} }
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI returned no JSON object");
  const body = clean.slice(start, end + 1);
  try { return JSON.parse(body); } catch (e) {
    // Small slips the model sometimes makes: trailing commas, curly quotes, raw line breaks inside strings
    const fixed = body
      .replace(/"(?:[^"\\]|\\.)*"/gs, (m) => m.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t"))
      .replace(/^\s*\/\/.*$/gm, "")                                  // comment lines
      .replace(/^(\s*)'([^'\n]+)'\s*:/gm, '$1"$2":')                  // 'key':
      .replace(/^(\s*)([A-Za-z_][\w]*)\s*:/gm, '$1"$2":')            // key:
      .replace(/,\s*([}\]])/g, "$1");                                   // trailing commas
    try { return JSON.parse(fixed); } catch {
      const pos = Number((e.message.match(/position (\d+)/) || [])[1]);
      const near = Number.isFinite(pos) ? ` near «${body.slice(Math.max(0, pos - 60), pos + 40).replace(/\s+/g, " ")}»` : "";
      throw new Error(`${e.message}${near}`);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries once; waits longer when the free tier says "too many requests" (429).
export async function withRetry(fn, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(e.status === 429 ? 8000 : 1500);
    }
  }
  throw lastErr;
}
