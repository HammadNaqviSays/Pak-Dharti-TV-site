import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article, Traffic } from "@/models";
import { HOOK_STYLES } from "@/lib/caption";

export const dynamic = "force-dynamic";
const DAYS = 21;

export default async function HooksPage() {
  if (!(await isLoggedIn())) redirect("/admin");
  await connectDB();
  const since = new Date(Date.now() - DAYS * 86400e3);
  const arts = await Article.find(
    { $or: [{ "social.ur.style": { $nin: [null, "", "none"] }, "social.ur.at": { $gte: since } }, { "social.en.style": { $nin: [null, "", "none"] }, "social.en.at": { $gte: since } }] },
    { slug: 1, social: 1, "translations.ur.title": 1, "translations.en.title": 1 }
  ).limit(500).lean();
  const posts = [];
  for (const a of arts) for (const lang of ["ur", "en"]) {
    const s = a.social?.[lang];
    if (s?.style && s.style !== "none" && s.at && new Date(s.at) >= since) posts.push({ slug: a.slug, lang, style: s.style, hook: s.hook || "", at: s.at });
  }
  const keys = [...new Set(posts.flatMap((p) => [`${p.slug}|facebook`, `${p.slug}|instagram`]))];
  const rows = keys.length ? await Traffic.find({ dim: "story-src", key: { $in: keys } }, { key: 1, views: 1 }).lean() : [];
  const clicks = {};
  for (const r of rows) { const slug = r.key.split("|")[0]; clicks[slug] = (clicks[slug] || 0) + (r.views || 0); }
  for (const p of posts) p.clicks = clicks[p.slug] || 0;

  const by = {};
  for (const p of posts) { const x = (by[p.style] ||= { style: p.style, posts: 0, clicks: 0 }); x.posts += 1; x.clicks += p.clicks; }
  const table = Object.values(by).map((x) => ({ ...x, avg: x.posts ? x.clicks / x.posts : 0 })).sort((a, b) => b.avg - a.avg);
  const sorted = [...posts].sort((a, b) => b.clicks - a.clicks);

  return (
    <main className="admin"><div className="wrap">
      <p><a href="/admin">← Mission Control</a></p>
      <h1>Hook report — which opening brings readers</h1>
      <p className="hint">Every Facebook/Instagram post is opened in one of {Object.keys(HOOK_STYLES).length} styles (picked at random). This page counts the visits that came from the Facebook and Instagram links of each story in the last {DAYS} days. Wait for about 40+ posts before trusting the order; a story that also goes viral elsewhere can skew one row.</p>
      {!posts.length ? <p>No posts with a style yet. Posts made from now on are tagged automatically.</p> : (
        <>
          <table className="tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th align="left">Style</th><th align="right">Posts</th><th align="right">Visits</th><th align="right">Visits per post</th></tr></thead>
            <tbody>{table.map((x) => (
              <tr key={x.style}><td><b>{x.style}</b><br /><small className="muted">{HOOK_STYLES[x.style]}</small></td><td align="right">{x.posts}</td><td align="right">{x.clicks}</td><td align="right"><b>{x.avg.toFixed(1)}</b></td></tr>
            ))}</tbody>
          </table>
          <h2>Best 10 posts</h2>
          <ol>{sorted.slice(0, 10).map((p) => <li key={p.slug + p.lang} dir="auto"><b>{p.clicks}</b> · {p.style} · {p.hook}</li>)}</ol>
          <h2>Weakest 10 posts</h2>
          <ol>{[...sorted].reverse().slice(0, 10).map((p) => <li key={p.slug + p.lang} dir="auto"><b>{p.clicks}</b> · {p.style} · {p.hook}</li>)}</ol>
        </>
      )}
    </div></main>
  );
}
