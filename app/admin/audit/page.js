import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { scanSite, CODES, URDU_CODES, IMAGE_CODES, DUP_SURE } from "@/lib/audit";
import PhotoCheck from "./PhotoCheck";
import { fixPhotosAction, fixUrduAction, fixForeignWordsAction, hideDuplicateAction, hideSureDuplicatesAction, sortDuplicatesAction, replacePhotoAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the Urdu repair calls the AI

export default async function AuditPage({ searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin");
  const { done = "" } = await searchParams;
  const { total, issues, counts, dups } = await scanSite();
  const nSure = dups.filter((d) => d.score >= DUP_SURE).length;
  const nImg = new Set(issues.filter((i) => IMAGE_CODES.includes(i.code)).map((i) => i.slug)).size;
  const nUr = new Set(issues.filter((i) => URDU_CODES.includes(i.code)).map((i) => i.slug)).size;
  return (
    <div className="wrap" style={{ padding: "1.2rem 0 3rem" }}>
      <p><a href="/admin">← Mission Control</a></p>
      <h1>Site check</h1>
      <p className="hint">Scanned {total} published stories. {issues.length ? `${issues.length} problems found.` : "No problems found."}</p>
      {done && <p className="notice">{done}</p>}

      <h2>Summary</h2>
      <ul>
        {Object.entries(CODES).map(([code, label]) => (
          <li key={code}><strong>{counts[code] || 0}</strong> — {label}</li>
        ))}
        <li><strong>{dups.length}</strong> — Possible duplicate stories (same event, published within 3 days)</li>
      </ul>

      <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", margin: "1rem 0" }}>
        <form action={fixPhotosAction}><button className="btn publish" disabled={!nImg}>Fix photos now ({nImg} stories)</button></form>
        <form action={fixForeignWordsAction}><button className="btn publish" disabled={!counts["ur-foreign-script"]}>Fix foreign-script words (fast, many stories)</button></form>
        <form action={fixUrduAction}><button className="btn publish" disabled={!nUr}>Fix Urdu — next 2 of {nUr}</button></form>
      </div>
      <h2>Photos with people</h2>
      <p className="hint">The AI looks at every stock photo and replaces it with a fitting photo if people are the main subject. One click runs the whole check by itself; keep the page open until the popup says finished.</p>
      <div style={{ marginBottom: ".8rem" }}><PhotoCheck /></div>
      <form action={replacePhotoAction} style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input name="link" placeholder="Paste a story link to replace its photo with the banner" style={{ flex: "1 1 320px" }} required />
        <button className="btn secondary">Replace this story's photo</button>
      </form>
      <p className="hint">Photos: replaced by the category banner (instant). Foreign-script words: the AI writes each wrong-script word in Urdu once and it is replaced in every story (start here, repeat until the count drops). Full Urdu rewrite: rewritten by the AI from the English story, 2 at a time (about a minute). Thin English stories need an editor.</p>

      <h2>Possible duplicates</h2>
      <p className="hint">Compared by English headline and summary. The older story is kept; hiding archives the newer copy (it stays in the database). Check pairs below 70%: a real follow-up (new numbers, a verdict) is not a duplicate.</p>
      <form action={sortDuplicatesAction} style={{ marginBottom: ".6rem" }}><button className="btn publish" disabled={!dups.length}>Let AI sort the duplicates ({Math.min(dups.length, 40)} pairs)</button></form>
      <form action={hideSureDuplicatesAction}><button className="btn publish" disabled={!nSure}>Hide newer copy of {nSure} near-identical pairs (70%+)</button></form>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem", margin: ".8rem 0 2rem" }}>
        <thead><tr style={{ textAlign: "left" }}><th>Kept (older)</th><th>Newer copy</th><th>Match</th><th></th></tr></thead>
        <tbody>
          {dups.length === 0 && <tr><td colSpan="4">No duplicates found.</td></tr>}
          {dups.map((d, n) => (
            <tr key={n} style={{ borderTop: "1px solid #ddd", verticalAlign: "top" }}>
              <td style={{ padding: ".35rem .5rem .35rem 0" }}><a href={`/en/news/${d.keep.slug}`} target="_blank" rel="noopener">{d.keep.title}</a></td>
              <td style={{ padding: ".35rem .5rem .35rem 0" }}><a href={`/en/news/${d.hide.slug}`} target="_blank" rel="noopener">{d.hide.title}</a></td>
              <td>{Math.round(d.score * 100)}%</td>
              <td><form action={hideDuplicateAction}><input type="hidden" name="slug" value={d.hide.slug} /><button className="btn secondary">Hide newer</button></form></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Where each problem is</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
        <thead><tr style={{ textAlign: "left" }}><th>Story</th><th>Problem</th><th>Where</th><th>Detail</th></tr></thead>
        <tbody>
          {issues.slice(0, 400).map((i, n) => (
            <tr key={n} style={{ borderTop: "1px solid #ddd", verticalAlign: "top" }}>
              <td style={{ padding: ".35rem .5rem .35rem 0" }}><a href={`/ur/news/${i.slug}`} target="_blank" rel="noopener" lang="ur" dir="rtl">{i.title.slice(0, 70)}</a></td>
              <td>{CODES[i.code]}</td><td>{i.where}</td><td dir="auto">{i.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {issues.length > 400 && <p className="hint">Showing the first 400 of {issues.length}.</p>}
    </div>
  );
}
