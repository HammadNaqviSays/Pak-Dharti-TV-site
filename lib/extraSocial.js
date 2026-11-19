// Extra places a posted story is sent to besides Facebook and Instagram. Each one is used only when its keys are set
// (in the GitHub secret SOCIAL_EXTRA_ENV); without keys it does nothing. A failure here never stops the main posting.
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (e.g. @pakdhartitv)   -> Telegram channel
//   BLUESKY_HANDLE + BLUESKY_APP_PASSWORD                        -> Bluesky
const T = (ms = 12000) => AbortSignal.timeout(ms);
const cut = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

async function telegram({ title, summary, url, imageUrl }) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return null;
  const caption = cut(`${title}\n\n${summary ? `${cut(summary, 400)}\n\n` : ""}${url}`, 1000);
  let r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, photo: imageUrl, caption }), signal: T() });
  if (!r.ok) r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: caption }), signal: T() });
  if (!r.ok) throw new Error(`telegram ${r.status}`);
  return { ok: true };
}

async function bluesky({ title, summary, url, imageUrl }) {
  const id = process.env.BLUESKY_HANDLE, pw = process.env.BLUESKY_APP_PASSWORD;
  if (!id || !pw) return null;
  const s = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: id, password: pw }), signal: T() });
  if (!s.ok) throw new Error(`bluesky login ${s.status}`);
  const { accessJwt, did } = await s.json();
  const head = cut(title, 300 - url.length - 2);
  const text = `${head}\n${url}`;
  const enc = new TextEncoder(), start = enc.encode(`${head}\n`).length;
  const record = { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), langs: ["ur", "en"],
    facets: [{ index: { byteStart: start, byteEnd: start + enc.encode(url).length }, features: [{ $type: "app.bsky.richtext.facet#link", uri: url }] }] };
  let thumb;
  try {
    const img = await fetch(imageUrl, { signal: T() });
    const buf = Buffer.from(await img.arrayBuffer());
    if (img.ok && buf.length < 950000) {
      const up = await fetch("https://bsky.social/xrpc/com.atproto.repo.uploadBlob", { method: "POST", headers: { authorization: `Bearer ${accessJwt}`, "content-type": "image/jpeg" }, body: buf, signal: T() });
      if (up.ok) thumb = (await up.json()).blob;
    }
  } catch { /* the post goes without the picture */ }
  record.embed = { $type: "app.bsky.embed.external", external: { uri: url, title: cut(title, 200), description: cut(summary || "", 300), ...(thumb ? { thumb } : {}) } };
  const r = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", { method: "POST", headers: { authorization: `Bearer ${accessJwt}`, "content-type": "application/json" }, body: JSON.stringify({ repo: did, collection: "app.bsky.feed.post", record }), signal: T() });
  if (!r.ok) throw new Error(`bluesky post ${r.status}`);
  return { ok: true };
}

/** Sends one story to every extra place that has keys. Returns { telegram, bluesky } (null = not set up). Never throws. */
export async function postExtras(item) {
  const out = {};
  for (const [name, fn] of [["telegram", telegram], ["bluesky", bluesky]]) {
    try { out[name] = await fn(item); } catch (e) { out[name] = { error: String(e.message).slice(0, 100) }; }
  }
  return out;
}
