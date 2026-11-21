// "Replace on social media": after a card has been made again, the old posts of a story are deleted (Facebook, Threads, Bluesky)
// and the new card is posted in their place. Instagram has no delete in its official system, so that one is left for the editor.
import { Article } from "@/models";
import { pageForLang, deleteFacebookPost } from "./social";

/** Deletes the earlier posts of a story. Returns { facebook, threads, bluesky, instagram } with "deleted" | "none" | "error: ..." | "manual". */
export async function deleteOldPosts(slug, lang) {
  const a = await Article.findOne({ slug }).select("social").lean();
  const sc = a?.social?.[lang] || {};
  const out = { facebook: "none", threads: "none", bluesky: "none", instagram: sc.ig && sc.ig !== "exists" ? "manual" : "none" };
  const fbId = sc.fb && !["auto", "manual", "exists"].includes(String(sc.fb)) ? String(sc.fb) : "";
  if (fbId) { try { await deleteFacebookPost(pageForLang(lang), fbId); out.facebook = "deleted"; } catch (e) { out.facebook = `error: ${String(e.message).slice(0, 120)}`; } }
  else if (sc.fb) out.facebook = "error: old post id unknown, delete it by hand";
  if (sc.thId && process.env.THREADS_TOKEN) {
    try {
      const r = await fetch(`https://graph.threads.net/v1.0/${sc.thId}?access_token=${encodeURIComponent(process.env.THREADS_TOKEN)}`, { method: "DELETE", cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error?.message || `Threads ${r.status}`);
      out.threads = "deleted";
    } catch (e) { out.threads = `error: ${String(e.message).slice(0, 120)}`; }
  } else if (sc.th) out.threads = "error: old post id unknown, delete it by hand";
  if (sc.bskyUri && process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD) {
    try {
      const s = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: process.env.BLUESKY_HANDLE, password: process.env.BLUESKY_APP_PASSWORD }) });
      if (!s.ok) throw new Error(`login ${s.status}`);
      const sess = await s.json();
      const m = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(sc.bskyUri);
      if (!m) throw new Error("bad post address");
      const pds = sess.didDoc?.service?.find((x) => x.id === "#atproto_pds")?.serviceEndpoint || "https://bsky.social";
      const r = await fetch(`${pds}/xrpc/com.atproto.repo.deleteRecord`, { method: "POST", headers: { authorization: `Bearer ${sess.accessJwt}`, "content-type": "application/json" }, body: JSON.stringify({ repo: sess.did, collection: m[2], rkey: m[3] }) });
      if (!r.ok) throw new Error(`delete ${r.status}`);
      out.bluesky = "deleted";
    } catch (e) { out.bluesky = `error: ${String(e.message).slice(0, 120)}`; }
  } else if (sc.bsky) out.bluesky = "error: old post address unknown, delete it by hand";
  return out;
}
