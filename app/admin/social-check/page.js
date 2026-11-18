import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { socialPages } from "@/lib/social";
import { connectDB } from "@/lib/db";
import { Article } from "@/models";

export const dynamic = "force-dynamic";
const G = "https://graph.facebook.com/v25.0";

async function get(path, token) {
  try {
    const r = await fetch(`${G}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    return j.error ? { error: `${j.error.message} (code ${j.error.code}${j.error.error_subcode ? "/" + j.error.error_subcode : ""})` } : j;
  } catch (e) { return { error: String(e.message || e) }; }
}

/** Asks Facebook directly how the page's recent posts and comments look. Nothing is posted or changed. */
export default async function SocialCheck() {
  if (!(await isLoggedIn())) redirect("/admin");
  const pages = socialPages();
  const rows = [];
  for (const p of pages) {
    const userToken = (p.tokenEnv && process.env[p.tokenEnv]) || "";
    if (!userToken) { rows.push({ p, err: "Token missing in Vercel env " + (p.tokenEnv || "(none)") }); continue; }
    const pg = await get(`/${p.fbPageId}?fields=name,fan_count,is_published,access_token`, userToken);
    const token = pg.access_token || userToken;
    const perms = await get("/me/permissions", userToken);
    const posts = await get(`/${p.fbPageId}/posts?limit=8&fields=created_time,permalink_url,message,comments.limit(2).summary(true){from,message,created_time},reactions.limit(0).summary(true)`, token);
    let ig = null;
    if (p.igUserId) {
      const acc = await get(`/${p.igUserId}?fields=username,media_count`, token);
      const lim = await get(`/${p.igUserId}/content_publishing_limit?fields=quota_usage,config`, token);
      ig = { acc, lim };
    }
    rows.push({ p, pg, perms, posts, ig, pageToken: !!pg.access_token });
  }
  await connectDB();
  const recent = await Article.find({ "social.ur.fb": { $nin: [null, ""] } }, { slug: 1, social: 1 }).sort({ "social.ur.at": -1 }).limit(40).lean();
  const noIg = recent.filter((x) => !x.social?.ur?.ig);
  const box = { border: "1px solid #ddd", borderRadius: 10, padding: ".8rem", margin: ".8rem 0", background: "#fff" };
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Facebook comments check</h1>
      <p>This only reads from Facebook; nothing is posted or changed.</p>
      {rows.length === 0 && <p>No Facebook page is configured (META_PAGES).</p>}
      {rows.map(({ p, err, pg, perms, posts, ig, pageToken }, i) => (
        <section key={i} style={box}>
          <h2>{p.name || p.lang} <small>({p.lang})</small></h2>
          {err && <p style={{ color: "#B3261E" }}>{err}</p>}
          {pg && (pg.error ? <p style={{ color: "#B3261E" }}>Page: {pg.error}</p> : <p>Page: <b>{pg.name}</b>, followers {pg.fan_count ?? "?"}, published: {String(pg.is_published)}. Page token: {pageToken ? "ok" : "not available (using saved token)"}</p>)}
          {perms && (perms.error
            ? <p>Permissions: <small>{perms.error}</small></p>
            : <p>Permissions: {(perms.data || []).map((x) => <span key={x.permission} style={{ marginRight: ".5rem", color: x.status === "granted" ? "#126B3A" : "#B3261E" }}>{x.permission}{x.status === "granted" ? " ✓" : " ✗"}</span>)}</p>)}
          {ig && (ig.acc.error ? <p style={{ color: "#B3261E" }}>Instagram: {ig.acc.error}</p> : <p>Instagram: <b>@{ig.acc.username}</b>, {ig.acc.media_count} posts. Daily limit used: <b>{ig.lim.error ? ig.lim.error : `${ig.lim.data?.[0]?.quota_usage ?? "?"} of ${ig.lim.data?.[0]?.config?.quota_total ?? "?"}`}</b></p>)}
          {posts && (posts.error ? <p style={{ color: "#B3261E" }}>Posts: {posts.error}</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }}>
              <thead><tr><th align="left">Time (UTC)</th><th>Comments</th><th>Reactions</th><th align="left">First comment</th></tr></thead>
              <tbody>
                {(posts.data || []).map((x) => {
                  const c = x.comments?.data?.[0];
                  return (
                    <tr key={x.id} style={{ borderTop: "1px solid #eee" }}>
                      <td><a href={x.permalink_url} target="_blank" rel="noreferrer">{(x.created_time || "").slice(5, 16).replace("T", " ")}</a></td>
                      <td align="center">{x.comments?.summary?.total_count ?? 0}</td>
                      <td align="center">{x.reactions?.summary?.total_count ?? 0}</td>
                      <td>{c ? `${c.from?.name || "?"}: ${(c.message || "").slice(0, 50)}` : <span style={{ color: "#B3261E" }}>none</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </section>
      ))}
      <section style={box}>
        <h2>Facebook yes, Instagram missing <small>(last 40 Urdu stories: {noIg.length} missing)</small></h2>
        {noIg.length === 0 ? <p>None missing. 👍</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }}>
            <thead><tr><th align="left">Story</th><th>Tries</th><th align="left">Why Instagram failed</th></tr></thead>
            <tbody>{noIg.map((x) => { const u = x.social.ur; return (
              <tr key={x.slug} style={{ borderTop: "1px solid #eee" }}>
                <td><a href={`/ur/news/${x.slug}`} target="_blank" rel="noreferrer">{x.slug.slice(0, 40)}</a></td>
                <td align="center">{(u.igTries || 0) + (u.igSweep || 0)}</td>
                <td>{u.igError || (u.igPending ? "waiting for the next run" : "no error saved (older story)")}</td>
              </tr>); })}</tbody>
          </table>
        )}
      </section>
    </main>
  );
}
