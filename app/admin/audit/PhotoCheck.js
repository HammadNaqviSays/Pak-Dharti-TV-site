"use client";
import { useState } from "react";
import { checkPhotosBatchAction } from "./actions";

// Runs the photo check in batches until every stock photo has been looked at, with a waiting popup.
export default function PhotoCheck() {
  const [run, setRun] = useState(null); // { checked, swapped, left, status, error }
  async function start() {
    let t = { checked: 0, swapped: 0, left: null, status: "running", error: "" }, bad = 0;
    setRun(t);
    for (let i = 0; i < 200; i++) {
      let r;
      try { r = await checkPhotosBatchAction(); } catch (e) { r = { error: "The connection to the site broke (it may have just been updated). Reload this page with Ctrl+Shift+R and press the button again.", checked: 0, swapped: 0, left: t.left, lost: true }; }
      t = { ...t, checked: t.checked + (r.checked || 0), swapped: t.swapped + (r.swapped || 0), left: r.left, error: r.error || "" };
      bad = r.error ? bad + 1 : 0;
      setRun({ ...t, status: "running" });
      if (r.lost || r.left === 0 || bad >= 8) break;
      if (r.error) {
        // most likely Gemini's free per-minute limit: wait and try again by itself
        for (let w = 40; w > 0; w--) { setRun({ ...t, status: "running", wait: w }); await new Promise((ok) => setTimeout(ok, 1000)); }
      }
    }
    setRun({ ...t, wait: 0, status: t.left === 0 ? "done" : t.error ? "failed" : "stopped" });
  }
  const running = run?.status === "running";
  return (
    <>
      <button className="btn publish" onClick={start} disabled={running}>Check ALL photos with AI (runs by itself)</button>
      {run && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", zIndex: 50, padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.6rem", maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,.35)" }}>
            {running && <div style={{ width: 44, height: 44, margin: "0 auto 1rem", border: "5px solid #eee", borderTopColor: "#C8102E", borderRadius: "50%", animation: "pdspin 1s linear infinite" }} />}
            <style>{"@keyframes pdspin{to{transform:rotate(360deg)}}"}</style>
            <h2 style={{ margin: "0 0 .5rem" }}>{running ? "Please wait…" : run.status === "done" ? "All photos checked ✓" : "Stopped"}</h2>
            <p style={{ margin: ".3rem 0" }}>Photos checked: <strong>{run.checked}</strong></p>
            <p style={{ margin: ".3rem 0" }}>Replaced (people in photo): <strong>{run.swapped}</strong></p>
            <p style={{ margin: ".3rem 0" }}>Still to check: <strong>{run.left ?? "…"}</strong></p>
            {running && run.wait > 0 && <p className="hint">Gemini needs a short rest (free limit). Continuing by itself in {run.wait}s…</p>}
            {running && <p className="hint">Do not close or leave this page until it says finished.</p>}
            {run.error && <p className="error" style={{ fontSize: ".9rem" }}>{run.error}</p>}
            {!running && <button className="btn publish" onClick={() => { setRun(null); location.reload(); }}>{run.status === "done" ? "Close" : "Close (press the button again to continue)"}</button>}
          </div>
        </div>
      )}
    </>
  );
}
