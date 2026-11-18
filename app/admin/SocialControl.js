"use client";
import { useState } from "react";
import { saveSocialConfigAction, requeueOldPostsAction } from "./socialAction";

/** Switch + limits for automatic Facebook / Instagram posting. */
export default function SocialControl({ initial }) {
  const [auto, setAuto] = useState(initial.auto);
  const [max, setMax] = useState(initial.maxPerDay);
  const [gap, setGap] = useState(initial.gapMin);
  const [from, setFrom] = useState(initial.fromHour);
  const [to, setTo] = useState(initial.toHour);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [rqHours, setRqHours] = useState(72);
  const [rqCount, setRqCount] = useState(10);
  const [rqMsg, setRqMsg] = useState("");

  async function requeue() {
    setBusy(true); setRqMsg("");
    try { const r = await requeueOldPostsAction(rqHours, rqCount, "ur"); setRqMsg(r.error || `${r.queued} stories will be sent again (one per gap, after fresh ones).`); }
    catch { setRqMsg("Could not queue, try again."); }
    setBusy(false);
  }

  async function save(nextAuto = auto) {
    setBusy(true); setMsg("");
    try {
      const r = await saveSocialConfigAction(nextAuto, max, gap, from, to);
      if (r.error) setMsg(r.error);
      else { setAuto(r.auto); setMax(r.maxPerDay); setGap(r.gapMin); setFrom(r.fromHour); setTo(r.toHour); setMsg("Saved ✓"); }
    } catch { setMsg("Could not save, try again."); }
    setBusy(false);
  }
  const last = initial.last ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(initial.last)) : "—";

  return (
    <section className="card-maker" style={{ marginBottom: "1.2rem" }}>
      <h2>Facebook + Instagram auto-posting</h2>
      {initial.paused && <p className="hint" style={{ color: "#a00" }}><strong>PAUSED:</strong> an emergency brake (SOCIAL_PAUSED) is on, so nothing is posted automatically whatever this switch says.</p>}
      <p className="hint">Status: <strong style={{ color: auto ? "#0a7a3c" : "#a00" }}>{auto ? "ON — fresh stories are posted automatically" : "OFF"}</strong>. Pages connected: {initial.pages.length ? initial.pages.map((l) => (l === "ur" ? "Urdu" : "English")).join(", ") : "none"}.</p>
      <div className="cm-row">
        <label>Max posts per day (each page)
          <input type="number" min={1} max={100} value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <label>Post from (hour, Pakistan time)
          <input type="number" min={0} max={23} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>…until (hour, Pakistan time)
          <input type="number" min={1} max={24} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>Minimum minutes between posts
          <input type="number" min={10} max={120} value={gap} onChange={(e) => setGap(e.target.value)} />
        </label>
      </div>
      <div className="cm-actions">
        <button className={`btn ${auto ? "secondary" : "publish"}`} disabled={busy} onClick={() => save(!auto)}>{auto ? "Switch OFF" : "Switch ON"}</button>
        <button className="btn secondary" disabled={busy} onClick={() => save()}>Save limits</button>
        {msg && <span className="hint">{msg}</span>}
      </div>
      <div className="cm-row" style={{ marginTop: ".8rem" }}>
        <label>Send again: stories posted in the last (hours)
          <input type="number" min={1} max={240} value={rqHours} onChange={(e) => setRqHours(e.target.value)} />
        </label>
        <label>…at most (stories)
          <input type="number" min={1} max={60} value={rqCount} onChange={(e) => setRqCount(e.target.value)} />
        </label>
      </div>
      <div className="cm-actions">
        <button className="btn secondary" disabled={busy} onClick={requeue}>Send those posts again (for posts nobody saw)</button>
        {rqMsg && <span className="hint">{rqMsg}</span>}
      </div>
      <p className="hint">Posted today — Urdu: {initial.posted.ur}, English: {initial.posted.en}. Last post: {last} (Pakistan time). A new story is picked about every 22 minutes, so the real pace is also limited by how fast stories are published. Each story goes out once, with its own licensed photo.</p>
    </section>
  );
}
