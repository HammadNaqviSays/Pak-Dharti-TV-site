import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Job } from "@/models";
import { approveJobAction, rejectJobAction, unpublishJobAction } from "../jobsAction";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs review", robots: { index: false } };
const fmt = (d) => d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(d)) : "—";

function Card({ j, mode }) {
  return (
    <div style={{ border: "1px solid #e2dcda", borderRadius: 10, padding: ".7rem", display: "grid", gap: ".35rem" }}>
      <strong>{j.title?.en || "(no title)"}</strong>
      <span>{j.org?.en} · <em>{j.sourceName}</em></span>
      <span>Last date: <b>{fmt(j.lastDate)}</b>{j.lastDateText ? ` (“${j.lastDateText}”)` : ""} · Posts: {j.positions || "—"}</span>
      {j.evidence && <small style={{ color: "#555" }}>Evidence: “{j.evidence.slice(0, 220)}”</small>}
      {j.issues?.length > 0 && <small style={{ color: "#b00020" }}>Problems: {j.issues.join("; ")}</small>}
      <span style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
        <a className="btn secondary" href={j.sourceUrl} target="_blank" rel="noopener">Open official page</a>
        {j.adUrl && <a className="btn secondary" href={j.adUrl} target="_blank" rel="noopener">PDF</a>}
        {j.slug && <a className="btn secondary" href={`/en/jobs/${j.slug}`} target="_blank" rel="noopener">Site page</a>}
        {mode === "draft" && <form action={approveJobAction.bind(null, String(j._id))}><button className="btn publish">Approve and publish</button></form>}
        {mode === "draft" && <form action={rejectJobAction.bind(null, String(j._id))}><button className="btn secondary">Reject</button></form>}
        {mode === "live" && <form action={unpublishJobAction.bind(null, String(j._id))}><button className="btn secondary">Unpublish</button></form>}
      </span>
    </div>
  );
}

export default async function JobsAdmin() {
  if (!(await isLoggedIn())) redirect("/admin");
  freshDB(); await connectDB();
  const [drafts, live, counts] = await Promise.all([
    Job.find({ status: "draft", lastDate: { $gte: new Date(Date.now() - 864e5) } }).sort({ createdAt: -1 }).limit(60).lean(),
    Job.find({ status: "published" }).sort({ publishedAt: -1 }).limit(60).lean(),
    Job.aggregate([{ $group: { _id: { s: "$status", src: "$source" }, n: { $sum: 1 } } }]),
  ]);
  const bySrc = {};
  for (const c of counts) { (bySrc[c._id.src || "?"] ||= {})[c._id.s] = c.n; }
  return (
    <main className="wrap" style={{ padding: "1rem 0", display: "grid", gap: "1rem" }}>
      <p><a className="btn secondary" href="/admin">← Mission Control</a></p>
      <h1>Jobs</h1>
      <p className="hint">Only ads from the official sources are read. An ad goes live by itself only if its closing date and its closing-date sentence are found word for word in the source page. Everything else waits here. Set JOBS_AUTOPUBLISH=0 to make every ad wait.</p>
      <details><summary>Per source (published / draft / skipped / rejected)</summary>
        <table style={{ borderCollapse: "collapse" }}><tbody>{Object.entries(bySrc).map(([k, v]) => <tr key={k}><td style={{ padding: "2px 10px" }}>{k}</td><td>{v.published || 0} / {v.draft || 0} / {v.skipped || 0} / {v.rejected || 0}</td></tr>)}</tbody></table>
      </details>
      <h2>Waiting for you ({drafts.length})</h2>
      {drafts.map((j) => <Card key={String(j._id)} j={j} mode="draft" />)}
      {!drafts.length && <p className="hint">Nothing waiting.</p>}
      <h2>Live ({live.length})</h2>
      {live.map((j) => <Card key={String(j._id)} j={j} mode="live" />)}
    </main>
  );
}
