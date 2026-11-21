"use client";
import { useState } from "react";
import { postReelAction, reelTextsAction } from "../reelPostAction";

const AUTO = [["facebook", "Facebook"], ["instagram", "Instagram"], ["threads", "Threads"], ["bluesky", "Bluesky"]];
const fmt = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });

/** Post a finished reel from here: four buttons post by themselves (press twice to be sure); TikTok, YouTube and the WhatsApp channel get the ready text to copy + the video to download. */
export default function ReelPublish({ id, keys, posts }) {
  const [done, setDone] = useState(posts || {});
  const [armed, setArmed] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState(null);
  const [copied, setCopied] = useState("");

  async function go(k) {
    if (armed !== k) { setArmed(k); setMsg(""); setTimeout(() => setArmed((a) => (a === k ? "" : a)), 8000); return; }
    setArmed(""); setBusy(k); setMsg("Post ho raha hai… 1–2 minute lag sakte hain, page band na karein.");
    try {
      const r = await postReelAction(id, k);
      setMsg(r.msg);
      if (r.ok) setDone((d) => ({ ...d, [k]: { at: new Date().toISOString() } }));
    } catch { setMsg("❌ Jawab nahi aaya. Page refresh karke dekhein ke post hua ya nahi, phir dobara koshish karein."); }
    setBusy("");
  }
  async function load() { if (!tx) { const t = await reelTextsAction(id); setTx(t); return t; } return tx; }
  async function copy(what) {
    const t = await load(); if (!t || t.error) return;
    const v = what === "title" ? t.title : what === "tags" ? t.tags : what === "link" ? t.url : t.text;
    try { await navigator.clipboard.writeText(v); setCopied(what); setTimeout(() => setCopied(""), 2500); } catch { setMsg("Copy nahi hua; text khud select karein."); }
  }
  const B = { padding: ".45rem .8rem", borderRadius: 8, border: "1px solid #bbb", background: "#fff", cursor: "pointer", fontSize: ".95rem" };
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: ".8rem", marginTop: ".8rem", background: "#fafafa" }}>
      <strong>Yahin se post karein</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", margin: ".6rem 0" }}>
        {AUTO.map(([k, n]) => done[k]
          ? <span key={k} style={{ ...B, background: "#e6f6ea", borderColor: "#9ad2a8" }}>✅ {n} · {fmt(done[k].at)}</span>
          : <button key={k} type="button" disabled={!keys?.[k] || !!busy} onClick={() => go(k)} style={{ ...B, ...(armed === k ? { background: "#fff3cd", borderColor: "#e0a800" } : {}), opacity: keys?.[k] ? 1 : .5 }}>
              {!keys?.[k] ? `${n} (key nahi)` : busy === k ? `${n}… ` : armed === k ? `Pakka? ${n} par post — dobara dabayen` : `${n} par post`}
            </button>)}
      </div>
      {msg && <p style={{ margin: ".3rem 0", fontWeight: 600 }}>{msg}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
        <span className="hint" style={{ margin: 0 }}>TikTok · YouTube · WhatsApp channel:</span>
        <button type="button" style={B} onClick={() => copy("title")}>{copied === "title" ? "✅ Title copy" : "Title copy"}</button>
        <button type="button" style={B} onClick={() => copy("tags")}>{copied === "tags" ? "✅ Hashtags copy" : "Hashtags copy"}</button>
        <button type="button" style={B} onClick={() => copy("link")}>{copied === "link" ? "✅ Link copy" : "Link copy"}</button>
        <button type="button" style={B} onClick={() => copy("all")}>{copied === "all" ? "✅ Sab copy" : "Sab kuch copy (title + link + hashtags)"}</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".5rem" }}>
        <a className="btn secondary" href={`/api/reels/${id}/video?download=1`}>Video download</a>
        <a className="btn secondary" href="https://www.tiktok.com/upload" target="_blank" rel="noopener">TikTok upload kholen</a>
        <a className="btn secondary" href="https://studio.youtube.com" target="_blank" rel="noopener">YouTube Studio kholen</a>
        <a className="btn secondary" href="https://web.whatsapp.com" target="_blank" rel="noopener">WhatsApp kholen</a>
      </div>
    </div>
  );
}
