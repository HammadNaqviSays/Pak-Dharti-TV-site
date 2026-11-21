"use client";
import { useState } from "react";
import { postReelAction, reelTextsAction, scheduleReelAction } from "../reelPostAction";

const AUTO = [["facebook", "Facebook"], ["instagram", "Instagram"], ["threads", "Threads"], ["bluesky", "Bluesky"]];
const fmt = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });

/** Post a finished reel from here: four buttons post by themselves (press twice to be sure); TikTok, YouTube and the WhatsApp channel get the ready text to copy + the video to download. */
export default function ReelPublish({ id, keys, posts, postAt, postErr }) {
  const [done, setDone] = useState(posts || {});
  const [armed, setArmed] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState(null);
  const [sched, setSched] = useState(postAt || "");   // ISO time the reel is scheduled for
  const [pick, setPick] = useState("");               // datetime-local value, Pakistan time
  const [sMsg, setSMsg] = useState("");
  const [fail, setFail] = useState({});   // platform -> error text (shown with a red cross)
  const [copied, setCopied] = useState("");

  async function one(k) {
    setBusy(k); setFail((f) => { const n = { ...f }; delete n[k]; return n; });
    try {
      const r = await postReelAction(id, k);
      if (r.ok) setDone((d) => ({ ...d, [k]: { at: new Date().toISOString() } }));
      else setFail((f) => ({ ...f, [k]: r.msg }));
      return r;
    } catch { const m = "❌ Jawab nahi aaya. Refresh karke dekhein ke post hua ya nahi."; setFail((f) => ({ ...f, [k]: m })); return { ok: false, msg: m }; }
    finally { setBusy(""); }
  }
  async function go(k) {
    if (armed !== k) { setArmed(k); setMsg(""); setTimeout(() => setArmed((a) => (a === k ? "" : a)), 8000); return; }
    setArmed(""); setMsg("Post ho raha hai… 1–2 minute lag sakte hain, page band na karein.");
    const r = await one(k); setMsg(r.msg);
  }
  // one button: every place that has a key and is not done yet, one after the other
  async function goAll() {
    if (armed !== "all") { setArmed("all"); setMsg(""); setTimeout(() => setArmed((a) => (a === "all" ? "" : a)), 8000); return; }
    setArmed("");
    const todo = AUTO.filter(([k]) => keys?.[k] && !done[k]);
    let ok = 0, bad = 0;
    for (const [k, n] of todo) {
      setMsg(`${n} par post ho raha hai… (page band na karein)`);
      const r = await one(k); if (r.ok) ok++; else bad++;
    }
    setMsg(bad ? `${ok} jagah post hua, ${bad} mein masla aaya (neeche laal ❌ dekhein).` : `✅ Sab jagah post ho gaya (${ok}).`);
  }
  // next 08:00 / 12:00 / 19:00 in Pakistan time (UTC+5)
  const preset = (h) => { const now = new Date(Date.now() + 5 * 3600e3); const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h)); if (d.getTime() <= now.getTime() + 60000) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 16); };
  const fmtPk = (iso) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
  async function saveSched() {
    if (!pick) { setSMsg("Pehle waqt chunein"); return; }
    setSMsg("…"); const r = await scheduleReelAction(id, new Date(`${pick}:00+05:00`).toISOString());
    setSMsg(r.msg); if (r.ok) setSched(r.at);
  }
  async function cancelSched() { const r = await scheduleReelAction(id, ""); setSMsg(r.msg); if (r.ok) setSched(""); }
  const left = AUTO.filter(([k]) => keys?.[k] && !done[k]).length;

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
          ? <span key={k} style={{ ...B, background: "#e6f6ea", borderColor: "#2e9d4f", color: "#14652d", fontWeight: 600 }}>✅ {n} · {fmt(done[k].at)}</span>
          : busy === k
            ? <span key={k} style={{ ...B, background: "#eef3ff", borderColor: "#7a9be8" }}>⏳ {n}…</span>
            : fail[k]
              ? <button key={k} type="button" disabled={!!busy} onClick={() => go(k)} title={fail[k]} style={{ ...B, background: "#fde8e8", borderColor: "#d33", color: "#a00", fontWeight: 600 }}>❌ {n} — dobara</button>
              : <button key={k} type="button" disabled={!keys?.[k] || !!busy} onClick={() => go(k)} style={{ ...B, ...(armed === k ? { background: "#fff3cd", borderColor: "#e0a800" } : {}), opacity: keys?.[k] ? 1 : .5 }}>
                  {!keys?.[k] ? `${n} (key nahi)` : armed === k ? `Pakka? ${n} — dobara dabayen` : `${n} par post`}
                </button>)}
      </div>
      {left > 0 && <button type="button" disabled={!!busy} onClick={goAll} style={{ ...B, background: armed === "all" ? "#fff3cd" : "#7a0000", color: armed === "all" ? "#000" : "#fff", borderColor: armed === "all" ? "#e0a800" : "#7a0000", fontWeight: 700, fontSize: "1.05rem", padding: ".6rem 1.1rem", marginBottom: ".4rem" }}>
        {busy ? "⏳ Post ho raha hai…" : armed === "all" ? `Pakka? ${left} jagah ek saath post — dobara dabayen` : `📤 Sab jagah post karo (${left})`}
      </button>}
      {msg && <p style={{ margin: ".3rem 0", fontWeight: 600 }}>{msg}</p>}
      {Object.entries(fail).map(([k, m]) => <p key={k} style={{ margin: ".2rem 0", color: "#a00" }}>{m}</p>)}
      <div style={{ margin: ".4rem 0 .8rem", padding: ".6rem", border: "1px dashed #bbb", borderRadius: 8 }}>
        <strong>⏰ Baad mein post karwana hai?</strong>
        {sched ? (
          <p style={{ margin: ".4rem 0" }}>Schedule: <strong>{fmtPk(sched)}</strong> (Pakistan time). Is waqt par baqi jagah khud post ho jayegi (har 15–20 minute mein check hota hai, to thori der ho sakti hai).{" "}
            <button type="button" style={B} onClick={cancelSched}>Schedule hata do</button></p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center", marginTop: ".4rem" }}>
            <input type="datetime-local" value={pick} onChange={(e) => setPick(e.target.value)} style={{ ...B, padding: ".35rem" }} />
            {[8, 12, 19].map((h) => <button key={h} type="button" style={B} onClick={() => setPick(preset(h))}>{h === 12 ? "12 baje dopahar" : h === 8 ? "8 baje subah" : "7 baje sham"}</button>)}
            <button type="button" style={{ ...B, background: "#7a0000", color: "#fff", fontWeight: 700 }} onClick={saveSched}>Schedule karo</button>
          </div>
        )}
        {postErr && <p style={{ margin: ".3rem 0", color: "#a00" }}>{postErr}</p>}
        {sMsg && <p style={{ margin: ".3rem 0", fontWeight: 600 }}>{sMsg}</p>}
        <small className="hint">Waqt Pakistan ke hisab se. Schedule sirf Facebook, Instagram, Threads, Bluesky ke liye hai; TikTok, YouTube aap khud schedule karein.</small>
      </div>
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
