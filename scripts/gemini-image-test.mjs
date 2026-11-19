// Read-only test: which Gemini image models work on the free keys right now (keys are never printed).
const keys = [process.env.GEMINI_API_KEY, ...[2, 3, 4, 5].map((i) => process.env[`GEMINI_API_KEY_${i}`])].filter(Boolean);
console.log("keys:", keys.length);
const H = (k) => ({ "content-type": "application/json", "x-goog-api-key": k });
const list = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: H(keys[0]) }).then((r) => r.json()).catch(() => ({}));
const names = (list.models || []).map((m) => m.name.replace("models/", "")).filter((n) => /image|imagen/i.test(n));
console.log("image models listed:", names.join(", ") || "none");
for (const m of names.filter((n) => !/imagen/i.test(n)).slice(0, 6)) {
  for (const [i, k] of keys.entries()) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: H(k), body: JSON.stringify({ contents: [{ parts: [{ text: "A simple vertical news illustration: a calm city skyline at sunset, no text." }] }], generationConfig: { responseModalities: ["IMAGE"] } }) });
      const j = await r.json().catch(() => ({}));
      const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
      console.log(`${m} key${i + 1}: HTTP ${r.status} ${img ? "IMAGE OK " + Math.round(img.inlineData.data.length * 0.75 / 1024) + " KB" : String(j.error?.message || "no image").replace(/\s+/g, " ").slice(0, 170)}`);
    } catch (e) { console.log(`${m} key${i + 1}: ${String(e.message).slice(0, 100)}`); }
  }
}
