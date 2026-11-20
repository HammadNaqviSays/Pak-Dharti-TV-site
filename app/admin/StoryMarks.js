import { Reel } from "@/models";
import { SITE } from "@/lib/site";
import MakeReelButton from "./MakeReelButton";

/** Latest reel (not rejected) of each story: { slug: { _id, status } } */
export async function reelMap(slugs) {
  const rows = await Reel.find({ slug: { $in: slugs }, status: { $ne: "rejected" } }, { slug: 1, status: 1 }).sort({ createdAt: 1 }).lean();
  const m = {};
  for (const r of rows) m[r.slug] = r;
  return m;
}

const dot = (bg, t, title) => <span title={title} style={{ display: "inline-grid", placeItems: "center", minWidth: 24, height: 24, padding: "0 .35rem", borderRadius: 12, background: bg, color: "#fff", fontSize: ".72rem", fontWeight: 800 }}>{t}</span>;
const REEL_TEXT = { draft: "📝 Reel draft", scripted: "⏳ Reel video queued", rendering: "⚙️ Reel video being made", ready: "🎬 Reel video ready", approved: "🎬 Reel approved", posted: "✅ Reel posted", failed: "⚠️ Reel failed" };

/** Little signs next to a story: on Facebook, on Instagram, reel made / downloaded. */
export function StoryMarks({ a, reel }) {
  const s = a.social || {};
  const fb = ["ur", "en"].filter((l) => s[l]?.fb);
  const ig = ["ur", "en"].filter((l) => s[l]?.ig);
  const r = a.reel || {};
  return (
    <span style={{ display: "inline-flex", gap: ".3rem", flexWrap: "wrap", alignItems: "center", marginInlineStart: ".4rem" }}>
      {fb.length > 0 && dot("#1877f2", "f", `Posted on Facebook (${fb.join(", ")})`)}
      {ig.length > 0 && dot("#c13584", "IG", `Posted on Instagram (${ig.join(", ")})`)}
      {reel && <a href={`/admin/reels/${reel._id}`} style={{ textDecoration: "none" }} title="Open this reel">{dot(["failed"].includes(reel.status) ? "#a00" : ["ready", "approved", "posted"].includes(reel.status) ? "#198754" : "#b8860b", REEL_TEXT[reel.status] || reel.status)}</a>}
      {!reel && r.at && dot("#6c757d", "🎬 Reel made earlier", "A reel was made for this story before (it has been deleted since)")}
      {r.dlAt && dot("#0d6efd", "⬇ Downloaded", "The reel video was downloaded")}
    </span>
  );
}

/** The reel button of a story: Make reel when none exists. */
export function ReelAction({ a, reel }) {
  if (reel) return <a className="btn secondary" href={`/admin/reels/${reel._id}`} target="_blank" rel="noopener">Open reel</a>;
  return <MakeReelButton slug={a.slug} label={a.reel?.at ? "Make reel again" : "Make reel"} />;
}

/** Small one-click share buttons for a story row: Pinterest, X and Threads open the site's own share window (you are signed in there). */
export function QuickShare({ a, lang = "ur" }) {
  const x = a.translations?.[lang] || a.translations?.en || {};
  const url = `${SITE.url}/${lang}/news/${a.slug}`;
  const title = (x.title || "").trim();
  const e = encodeURIComponent;
  const img = a.image?.url ? (a.image.url.startsWith("http") ? a.image.url : `${SITE.url}${a.image.url}`) : `${url}/opengraph-image`;
  const links = [
    ["Pinterest", `https://pinterest.com/pin/create/button/?url=${e(url)}&media=${e(img)}&description=${e(title)}`, "#e60023"],
    ["X", `https://twitter.com/intent/tweet?text=${e(title)}&url=${e(url)}`, "#000"],
    ["Threads", `https://www.threads.net/intent/post?text=${e(`${title}\n\n${url}`)}`, "#101010"],
  ];
  return links.map(([n, h, bg]) => <a key={n} className="btn secondary" style={{ background: bg, color: "#fff", borderColor: bg }} href={h} target="_blank" rel="noopener noreferrer" title={`Share on ${n}`}>{n}</a>);
}
