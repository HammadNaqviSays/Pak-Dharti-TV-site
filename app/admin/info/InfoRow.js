"use client";
import { useState } from "react";
import { publishGuideAction, makeGuideReelAction } from "../infoAction";

export default function InfoRow({ g, done }) {
  const [r, setR] = useState(done || null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function pub() {
    setBusy(true); setMsg("");
    try { const x = await publishGuideAction(g.key); if (x.ok) setR({ id: x.id, slug: x.slug }); else setMsg(x.msg); }
    catch { setMsg("❌ No response. Press Ctrl+Shift+R and try again."); }
    setBusy(false);
  }
  async function reel() {
    setBusy(true); setMsg("");
    try { const x = await makeGuideReelAction(g.key); if (x.ok) { setR({ id: x.aid, slug: x.slug }); setMsg("✅ " + x.msg); } else setMsg(x.msg); }
    catch { setMsg("❌ No response. Press Ctrl+Shift+R and try again."); }
    setBusy(false);
  }
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: ".8rem", margin: ".7rem 0", background: "#fff" }}>
      <strong>{g.en.title}</strong>
      <div dir="rtl" style={{ margin: ".3rem 0", fontSize: "1.05rem" }}>{g.ur.title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", margin: ".4rem 0" }}>
        {g.rows.filter((x) => x.n).map((x) => <span key={x.n} style={{ border: "1px solid #7a0000", color: "#7a0000", borderRadius: 8, padding: ".15rem .6rem", fontWeight: 700 }}>{x.n}</span>)}
      </div>
      <small className="hint">Sources: {g.sources.map(([n, u], i) => <span key={u}>{i ? " · " : ""}<a href={u} target="_blank" rel="noopener">{n}</a></span>)}</small>
      <div style={{ marginTop: ".5rem", display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
        {r ? (<>
          <span style={{ color: "#14652d", fontWeight: 600 }}>✅ On the site</span>
          <a className="btn publish" href={`/admin/preview/${r.id}`}>Cards, video and sharing</a>
          <a className="btn secondary" href={`/en/news/${r.slug}`} target="_blank" rel="noopener">Open English</a>
          <a className="btn secondary" href={`/ur/news/${r.slug}`} target="_blank" rel="noopener">Open Urdu</a>
        </>) : (
          <button type="button" className="btn publish" disabled={busy} onClick={pub}>{busy ? "Publishing…" : "Publish on the site"}</button>
        )}
        {g.reel && <button type="button" className="btn secondary" disabled={busy} onClick={reel}>{busy ? "Working…" : "Make the video script"}</button>}
        {g.reel?.scenes?.[0]?.pic && <button type="button" className="btn secondary" onClick={() => { const t = g.reel.scenes.map((x, i) => `Picture ${i + 1}: ${x.pic}`).join("\n\n"); try { navigator.clipboard.writeText(t); setMsg("✅ Picture prompts copied. Paste them into ChatGPT one by one."); } catch { setMsg("Could not copy"); } }}>Copy the picture prompts (ChatGPT)</button>}
        {msg && <span style={{ color: "#a00", fontWeight: 600 }}>{msg}</span>}
      </div>
    </div>
  );
}
