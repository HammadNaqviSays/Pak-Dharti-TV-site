"use client";
import { useState } from "react";
import { shareHrefAction } from "./shareAction";

const SITES = [["Pinterest", "pinterest", "#e60023"], ["X", "x", "#000"]];   // Threads is posted automatically now

/** One-click share on Pinterest and X: title, blank line, link, blank line, related hashtags (Urdu tags for Urdu, English for English). Opens the site's own share window; you are signed in there yourself. */
export default function QuickShare({ a, lang = "ur" }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const go = async (site) => {
    if (busy) return;
    setBusy(site); setErr("");
    let w = null;
    try { w = window.open("", "_blank"); } catch {}
    const r = await shareHrefAction(a.slug, lang, site);
    setBusy("");
    if (r?.href) { if (w) w.location.href = r.href; else window.location.href = r.href; }
    else { if (w) w.close(); setErr(r?.error || "Failed, try again"); }
  };
  return (
    <>
      {SITES.map(([n, k, bg]) => (
        <button key={k} type="button" className="btn secondary" style={{ background: bg, color: "#fff", borderColor: bg }} disabled={!!busy} onClick={() => go(k)} title={`Share on ${n}`}>{busy === k ? "…" : n}</button>
      ))}
      {err && <small style={{ color: "#a00" }}> {err}</small>}
    </>
  );
}
