// Extra places a posted story is sent to besides Facebook and Instagram. Each one is used only when its keys are set
// (in the GitHub secret SOCIAL_EXTRA_ENV); without keys it does nothing. A failure here never stops the main posting.
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (e.g. @pakdhartitv)   -> Telegram channel
//   BLUESKY_HANDLE + BLUESKY_APP_PASSWORD                        -> Bluesky
//   THREADS_TOKEN (long-lived; THREADS_USER_ID is optional)      -> Threads
const T = (ms = 12000) => AbortSignal.timeout(ms);
const cut = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

async function telegram({ title, summary, url, imageUrl, tags }) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return null;
  const L = layout(title, url, tags, 1000);
  const caption = `${L.title}\n\n${url}${L.tags ? `\n\n${L.tags}` : ""}`;
  let r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, photo: imageUrl, caption }), signal: T() });
  if (!r.ok) r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: caption }), signal: T() });
  if (!r.ok) throw new Error(`telegram ${r.status}`);
  return { ok: true };
}

const glen = (t) => { try { return [...new Intl.Segmenter().segment(t)].length; } catch { return [...t].length; } };

/** The post text in one order everywhere: title, blank line, link, blank line, related hashtags. Hashtags are dropped from the end (then the title is trimmed) until it fits `limit`. */
function layout(title, url, tags, limit, linkLen = null) {
  const lk = linkLen ?? glen(url);
  let list = String(tags || "").split(/\s+/).filter(Boolean);
  const size = (ti, tg) => glen(ti) + 2 + lk + (tg.length ? 2 + glen(tg.join(" ")) : 0);
  while (list.length && size(title, list) > limit) list.pop();
  let ti = title;
  if (size(ti, list) > limit) ti = cut(title, Math.max(20, limit - lk - 4));
  return { title: ti, tags: list.join(" ") };
}

async function bluesky({ title, summary, url, imageUrl, tags }) {
  const id = process.env.BLUESKY_HANDLE, pw = process.env.BLUESKY_APP_PASSWORD;
  if (!id || !pw) return null;
  const s = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: id, password: pw }), signal: T() });
  if (!s.ok) throw new Error(`bluesky login ${s.status}`);
  const { accessJwt, did } = await s.json();
  // Bluesky counts the whole address, so the plain story address (no tracking part) keeps room for the words
  const L = layout(title, url, tags, 295);
  const enc = new TextEncoder();
  const text = `${L.title}\n\n${url}${L.tags ? `\n\n${L.tags}` : ""}`;
  const uStart = enc.encode(`${L.title}\n\n`).length;
  const facets = [{ index: { byteStart: uStart, byteEnd: uStart + enc.encode(url).length }, features: [{ $type: "app.bsky.richtext.facet#link", uri: url }] }];
  if (L.tags) {
    let at = uStart + enc.encode(`${url}\n\n`).length;
    for (const w of L.tags.split(" ")) { facets.push({ index: { byteStart: at, byteEnd: at + enc.encode(w).length }, features: [{ $type: "app.bsky.richtext.facet#tag", tag: w.replace(/^#/, "") }] }); at += enc.encode(`${w} `).length; }
  }
  const record = { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString(), langs: [/[\u0600-\u06FF]/.test(title) ? "ur" : "en"], facets };
  let blob, ratio;
  try {
    const img = await fetch(imageUrl, { signal: T() });
    if (img.ok) {
      // the whole card goes up as a real picture (not a cropped link thumbnail); Bluesky allows under 1 MB, so it is re-saved smaller when needed
      const sharp = (await import("sharp")).default;
      const src = Buffer.from(await img.arrayBuffer());
      let buf = src, q = 90, w = 1080;
      for (let i = 0; i < 6 && buf.length > 950000; i++) { buf = await sharp(src).resize({ width: w, withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toBuffer(); q -= 8; w -= 100; }
      const m = await sharp(buf).metadata();
      ratio = { width: m.width, height: m.height };
      if (buf.length < 990000) {
        const up = await fetch("https://bsky.social/xrpc/com.atproto.repo.uploadBlob", { method: "POST", headers: { authorization: `Bearer ${accessJwt}`, "content-type": "image/jpeg" }, body: buf, signal: T(20000) });
        if (up.ok) blob = (await up.json()).blob;
      }
    }
  } catch { /* falls back to the link card below */ }
  record.embed = blob
    ? { $type: "app.bsky.embed.images", images: [{ alt: cut(title, 300), image: blob, ...(ratio ? { aspectRatio: ratio } : {}) }] }
    : { $type: "app.bsky.embed.external", external: { uri: url, title: cut(title, 200), description: cut(summary || "", 300) } };
  const r = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", { method: "POST", headers: { authorization: `Bearer ${accessJwt}`, "content-type": "application/json" }, body: JSON.stringify({ repo: did, collection: "app.bsky.feed.post", record }), signal: T() });
  if (!r.ok) throw new Error(`bluesky post ${r.status}`);
  return { ok: true, picture: !!blob };
}

async function threads({ title, summary, url, imageUrl, tags }) {
  const tok = process.env.THREADS_TOKEN;
  if (!tok) return null;
  const uid = process.env.THREADS_USER_ID || "me";   // "me" = the account the token belongs to, so no user id needs saving
  const api = "https://graph.threads.net/v1.0";
  const L = layout(title, url, tags, 480);
  const text = `${L.title}\n\n${url}${L.tags ? `\n\n${L.tags}` : ""}`;
  const c = await fetch(`${api}/${uid}/threads`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ media_type: "IMAGE", image_url: imageUrl, text, access_token: tok }), signal: T() });
  if (!c.ok) throw new Error(`threads container ${c.status}`);
  const { id } = await c.json();
  // the container needs a moment before it can be published
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await fetch(`${api}/${id}?fields=status&access_token=${encodeURIComponent(tok)}`, { signal: T() }).then((r) => r.json()).catch(() => ({}));
    if (st.status === "FINISHED") break;
    if (st.status === "ERROR" || st.status === "EXPIRED") throw new Error(`threads ${st.status}`);
  }
  const p = await fetch(`${api}/${uid}/threads_publish`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: id, access_token: tok }), signal: T() });
  if (!p.ok) throw new Error(`threads publish ${p.status}`);
  return { ok: true };
}

/** Sends one story to every extra place that has keys. Returns { telegram, bluesky, threads } (null = not set up). Never throws. */
export async function postExtras(item) {
  const out = {};
  for (const [name, fn] of [["telegram", telegram], ["bluesky", bluesky], ["threads", threads]]) {
    try { out[name] = await fn(item); } catch (e) { out[name] = { error: String(e.message).slice(0, 100) }; }
  }
  return out;
}
