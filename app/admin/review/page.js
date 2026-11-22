import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Article } from "@/models";
import { markReviewedAction, unpublishAction } from "../actions";

export const dynamic = "force-dynamic";

const fmtTime = (d) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(d));

export default async function ReviewPage() {
  if (!(await isLoggedIn())) redirect("/admin");
  freshDB(); await connectDB();
  const since = new Date(Date.now() - 36 * 3600e3);
  const fields = { slug: 1, category: 1, publishedAt: 1, "translations.en.title": 1, "translations.ur.title": 1, "sources.name": 1, "sources.url": 1, "stats.views": 1, "disclosure.humanReviewed": 1, quality: 1 };
  const [open, doneToday] = await Promise.all([
    Article.find({ status: "published", contentType: "news", publishedAt: { $gte: since }, "disclosure.humanReviewed": { $ne: true } }, fields)
      .sort({ "stats.views": -1, publishedAt: -1 }).limit(12).lean(),
    Article.countDocuments({ status: "published", "disclosure.humanReviewed": true, publishedAt: { $gte: since } }),
  ]);
  return (
    <div className="wrap" style={{ padding: "1.2rem 0 3rem" }}>
      <p><a href="/admin">← Mission Control</a></p>
      <h1>Desk review</h1>
      <p className="hint">The 12 most-read news stories of the last 36 hours that no editor has checked yet. Reviewed so far in this window: <b>{doneToday}</b>.</p>
      <div className="card" style={{ margin: "0 0 1rem" }}>
        <b>For each story (about 45 seconds):</b>
        <ol>
          <li>Open the story and its source link side by side.</li>
          <li>Headline and first paragraph match what the source says (no exaggeration).</li>
          <li>Names, numbers, dates and quotes match the source; any claim is framed as "alleged / according to" where needed.</li>
          <li>The photo fits the story and the quote (if any) is short and credited.</li>
          <li>All good → <b>Mark reviewed</b> (it gets the "Desk" mark). Doubt → <b>Take down</b> and fix it in the editor.</li>
        </ol>
      </div>
      <div className="table-scroll"><table className="stats">
        <thead><tr><th>Published</th><th>Story</th><th>Sources</th><th className="num">Reads</th><th>Score</th><th></th></tr></thead>
        <tbody>
          {open.map((a) => (
            <tr key={String(a._id)}>
              <td>{fmtTime(a.publishedAt)}</td>
              <td>
                <a href={`/en/news/${a.slug}`} target="_blank" rel="noopener">{a.translations?.en?.title || a.slug}</a>
                {a.translations?.ur?.title && <div dir="rtl" lang="ur" className="muted">{a.translations.ur.title}</div>}
              </td>
              <td>{(a.sources || []).slice(0, 3).map((s) => <div key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></div>)}</td>
              <td className="num">{a.stats?.views || 0}</td>
              <td>{a.quality?.score ?? "—"}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <form action={markReviewedAction} style={{ display: "inline" }}><input type="hidden" name="id" value={String(a._id)} /><button className="btn publish">Mark reviewed ✓</button></form>{" "}
                <form action={unpublishAction} style={{ display: "inline" }}><input type="hidden" name="id" value={String(a._id)} /><button className="btn secondary">Take down</button></form>
              </td>
            </tr>
          ))}
          {!open.length && <tr><td colSpan="6" className="muted">Nothing waiting: every recent news story has been reviewed.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}
