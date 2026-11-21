// Posting a finished reel from Mission Control: Facebook Reel, Instagram Reel, Threads and Bluesky.
// The video is fetched by the platform from our own public address (/api/reels/<id>/web = the light 720p copy, else the full video).
// Every function returns a short reference or throws an Error with a readable message.
import { SITE } from "./site";
import { socialPages } from "./social";

const GRAPH = "https://graph.facebook.com/v25.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const form = (o) => new URLSearchParams(o);

export const videoUrlOf = (id, hasWeb) => `${SITE.url}/api/reels/${id}/${hasWeb ? "web" : "video"}`;

/** Which platforms have their keys on the Worker (shown on the buttons; no secret is ever sent to the page). */
export function keysPresent() {
  const p = socialPages()[0];
  const meta = !!(p && p.tokenEnv && process.env[p.tokenEnv]);
  return { facebook: meta && !!p?.fbPageId, instagram: meta && !!p?.igUserId, threads: !!process.env.THREADS_TOKEN, bluesky: !!(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD) };
}

async function g(path, token, body, method = "POST") {
  const r = await fetch(`${GRAPH}${path}`, method === "GET"
    ? { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    : { method, headers: { Authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" }, body: form(body), cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta error ${r.status}`);
  return j;
}
async function pageTokenOf(p) {
  const t = process.env[p.tokenEnv]; if (!t) throw new Error("Meta token missing on the site");
  try { const j = await g(`/${p.fbPageId}?fields=access_token`, t, null, "GET"); return j.access_token || t; } catch { return t; }
}

export async function facebookReel({ videoUrl, text }) {
  const p = socialPages()[0]; if (!p) throw new Error("Facebook page not set up");
  const token = await pageTokenOf(p);
  const s = await g(`/${p.fbPageId}/video_reels`, token, { upload_phase: "start" });
  const up = await fetch(s.upload_url, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: videoUrl }, cache: "no-store" });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.success === false) throw new Error(`Facebook could not take the video (${up.status})`);
  await g(`/${p.fbPageId}/video_reels`, token, { upload_phase: "finish", video_id: s.video_id, video_state: "PUBLISHED", description: text });
  for (let i = 0; i < 20; i++) {   // wait until Facebook has processed it
    await sleep(3000);
    const st = await g(`/${s.video_id}?fields=status`, token, null, "GET").catch(() => ({}));
    const ph = st.status?.video_status;
    if (ph === "ready" || ph === "published" || st.status?.publishing_phase?.status === "complete") return s.video_id;
    if (ph === "error") throw new Error("Facebook could not process the video");
  }
  return s.video_id;
}

export async function instagramReel({ videoUrl, text }) {
  const p = socialPages()[0]; if (!p?.igUserId) throw new Error("Instagram account not set up");
  const token = await pageTokenOf(p);
  const c = await g(`/${p.igUserId}/media`, token, { media_type: "REELS", video_url: videoUrl, caption: text, share_to_feed: "true" });
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const s = await g(`/${c.id}?fields=status_code`, token, null, "GET");
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram could not process the video");
    if (i === 29) throw new Error("Instagram is still processing; try again in a few minutes");
  }
  return (await g(`/${p.igUserId}/media_publish`, token, { creation_id: c.id })).id;
}

export async function threadsVideo({ videoUrl, text }) {
  const tok = process.env.THREADS_TOKEN; if (!tok) throw new Error("Threads token missing on the site");
  const uid = process.env.THREADS_USER_ID || "me", api = "https://graph.threads.net/v1.0";
  const c = await fetch(`${api}/${uid}/threads`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ media_type: "VIDEO", video_url: videoUrl, text: text.slice(0, 480), access_token: tok }), cache: "no-store" });
  const cj = await c.json().catch(() => ({}));
  if (!c.ok || !cj.id) throw new Error(cj.error?.message || `Threads error ${c.status}`);
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    const st = await fetch(`${api}/${cj.id}?fields=status,error_message&access_token=${encodeURIComponent(tok)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (st.status === "FINISHED") break;
    if (st.status === "ERROR" || st.status === "EXPIRED") throw new Error(`Threads: ${st.error_message || st.status}`);
    if (i === 29) throw new Error("Threads is still processing; try again in a few minutes");
  }
  const p = await fetch(`${api}/${uid}/threads_publish`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form({ creation_id: cj.id, access_token: tok }), cache: "no-store" });
  const pj = await p.json().catch(() => ({}));
  if (!p.ok) throw new Error(pj.error?.message || `Threads publish ${p.status}`);
  return pj.id || "ok";
}

export async function blueskyVideo({ videoUrl, text, title, url, tags }) {
  const id = process.env.BLUESKY_HANDLE, pw = process.env.BLUESKY_APP_PASSWORD; if (!id || !pw) throw new Error("Bluesky keys missing on the site");
  const s = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: id, password: pw }) });
  if (!s.ok) throw new Error(`Bluesky login ${s.status}`);
  const sess = await s.json();
  const pds = sess.didDoc?.service?.find((x) => x.id === "#atproto_pds")?.serviceEndpoint || "https://bsky.social";
  const auth = { authorization: `Bearer ${sess.accessJwt}` };
  const sa = await fetch(`${pds}/xrpc/com.atproto.server.getServiceAuth?aud=${encodeURIComponent(`did:web:${new URL(pds).host}`)}&lxm=com.atproto.repo.uploadBlob&exp=${Math.floor(Date.now() / 1000) + 1500}`, { headers: auth });
  const saj = await sa.json().catch(() => ({}));
  if (!sa.ok || !saj.token) throw new Error(`Bluesky upload permission ${sa.status}`);
  const vr = await fetch(videoUrl); if (!vr.ok) throw new Error("Video not reachable");
  const buf = await vr.arrayBuffer();
  if (buf.byteLength > 95 * 1024 * 1024) throw new Error("Video too big for Bluesky");
  const up = await fetch(`https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(sess.did)}&name=reel.mp4`, { method: "POST", headers: { authorization: `Bearer ${saj.token}`, "content-type": "video/mp4" }, body: buf });
  const uj = await up.json().catch(() => ({}));
  let blob = uj.jobStatus?.blob, jobId = uj.jobId || uj.jobStatus?.jobId;
  if (!blob && !jobId) throw new Error(uj.message || uj.error || `Bluesky video upload ${up.status}`);
  for (let i = 0; i < 40 && !blob; i++) {
    await sleep(3000);
    const js = await fetch(`https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(jobId)}`).then((r) => r.json()).catch(() => ({}));
    blob = js.jobStatus?.blob;
    if (js.jobStatus?.state === "JOB_STATE_FAILED") throw new Error(`Bluesky: ${js.jobStatus.error || "video failed"}`);
  }
  if (!blob) throw new Error("Bluesky is still processing the video; try again later");
  // post text: title, link, hashtags (kept under 300 graphemes)
  const enc = new TextEncoder();
  let body = `${title}\n\n${url}`;
  const facets = [{ index: { byteStart: enc.encode(`${title}\n\n`).length, byteEnd: enc.encode(body).length }, features: [{ $type: "app.bsky.richtext.facet#link", uri: url }] }];
  let list = String(tags || "").split(/\s+/).filter(Boolean);
  const glen = (t) => { try { return [...new Intl.Segmenter().segment(t)].length; } catch { return [...t].length; } };
  while (list.length && glen(`${body}\n\n${list.join(" ")}`) > 295) list.pop();
  if (list.length) {
    let at = enc.encode(`${body}\n\n`).length;
    for (const w of list) { facets.push({ index: { byteStart: at, byteEnd: at + enc.encode(w).length }, features: [{ $type: "app.bsky.richtext.facet#tag", tag: w.replace(/^#/, "") }] }); at += enc.encode(`${w} `).length; }
    body += `\n\n${list.join(" ")}`;
  }
  const record = { $type: "app.bsky.feed.post", text: body, createdAt: new Date().toISOString(), langs: ["ur"], facets, embed: { $type: "app.bsky.embed.video", video: blob, aspectRatio: { width: 720, height: 1280 } } };
  const r = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ repo: sess.did, collection: "app.bsky.feed.post", record }) });
  if (!r.ok) throw new Error(`Bluesky post ${r.status}`);
  return (await r.json().catch(() => ({}))).uri || "ok";
}
