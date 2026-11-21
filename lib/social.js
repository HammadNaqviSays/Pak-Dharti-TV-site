// Facebook Page + Instagram posting through the Meta Graph API.
// META_PAGES = JSON array: [{ lang, name, fbPageId, igUserId, tokenEnv }]. The token itself lives in the env var named by tokenEnv.
const GRAPH = "https://graph.facebook.com/v25.0";

export function socialPages() {
  try {
    const list = JSON.parse(process.env.META_PAGES || "[]");
    return Array.isArray(list) ? list.filter((p) => p && p.lang && p.fbPageId) : [];
  } catch { return []; }
}
export const pageForLang = (lang) => socialPages().find((p) => p.lang === lang) || null;
const tokenOf = (p) => (p.tokenEnv && process.env[p.tokenEnv]) || "";

async function graph(path, token, body, method = "POST") {
  const url = `${GRAPH}${path}`;
  const init = method === "GET"
    ? { method, headers: { Authorization: `Bearer ${token}` } }
    : { method, headers: { Authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) };
  const r = await fetch(url, { ...init, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta error ${r.status}`);
  return j;
}

// The saved token may be a user token: swap it for the page's own token (needed to post as the page)
async function pageToken(page, token) {
  try {
    const j = await graph(`/${page.fbPageId}?fields=access_token`, token, null, "GET");
    return j.access_token || token;
  } catch { return token; }
}

/** Photo post on the Facebook page, then the first comment (link). Returns { postId, commentId }. */
export async function postFacebook(page, { imageUrl, text, comment }) {
  const userToken = tokenOf(page);
  if (!userToken) throw new Error("Token missing for this page");
  const token = await pageToken(page, userToken);
  let j;
  try { j = await graph(`/${page.fbPageId}/photos`, token, { url: imageUrl, caption: text, published: "true" }); }
  catch (e) {
    // Facebook sometimes cannot fetch the picture from its address ("Missing or invalid image file"): send the picture itself instead
    if (!/image|photo|file/i.test(String(e.message))) throw e;
    const pic = await fetch(imageUrl, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!pic.ok) throw e;
    const fd = new FormData();
    fd.set("source", new Blob([await pic.arrayBuffer()], { type: pic.headers.get("content-type") || "image/jpeg" }), "card.jpg");
    fd.set("caption", text); fd.set("published", "true");
    const r = await fetch(`${GRAPH}/${page.fbPageId}/photos`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd, cache: "no-store" });
    j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error?.message || `Meta error ${r.status}`);
  }
  const postId = j.post_id || j.id;
  let commentId = null;
  if (comment && postId) {
    try { commentId = (await graph(`/${postId}/comments`, token, { message: comment })).id; }
    catch (e) { return { postId, commentId: null, commentError: e.message }; }
  }
  return { postId, commentId };
}

/** Image post on Instagram (image must be a public JPEG). Returns { mediaId }. */
/** Is this caption already among the latest Instagram posts? (stops a second copy when a first try went through but looked like an error) */
export async function igAlreadyHas(page, caption) {
  try {
    const userToken = tokenOf(page); if (!userToken || !page.igUserId) return false;
    const token = await pageToken(page, userToken);
    const j = await graph(`/${page.igUserId}/media?fields=caption&limit=20`, token, null, "GET");
    const key = String(caption || "").replace(/\s+/g, " ").trim().slice(0, 50);
    return !!key && (j.data || []).some((m) => String(m.caption || "").replace(/\s+/g, " ").trim().startsWith(key));
  } catch { return false; }
}

export async function postInstagram(page, { imageUrl, caption }) {
  const userToken = tokenOf(page);
  if (!userToken) throw new Error("Token missing for this page");
  const token = await pageToken(page, userToken);
  if (!page.igUserId) throw new Error("Instagram account not set for this page");
  const c = await graph(`/${page.igUserId}/media`, token, { image_url: imageUrl, caption });
  for (let i = 0; i < 12; i++) {
    const s = await graph(`/${c.id}?fields=status_code`, token, null, "GET");
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram could not process the image");
    await new Promise((r) => setTimeout(r, 2000));
  }
  const p = await graph(`/${page.igUserId}/media_publish`, token, { creation_id: c.id });
  return { mediaId: p.id };
}

/** Deletes a post of the page (Facebook allows deleting but not changing the picture of a post). */
export async function deleteFacebookPost(page, postId) {
  const userToken = tokenOf(page);
  if (!userToken) throw new Error("Token missing for this page");
  const token = await pageToken(page, userToken);
  const r = await fetch(`${GRAPH}/${postId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta error ${r.status}`);
  return true;
}
