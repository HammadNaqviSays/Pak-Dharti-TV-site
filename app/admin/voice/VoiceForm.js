"use client";
import { useState } from "react";
import { saveVoiceAction, testVoiceAction } from "../voiceAction";

const SAMPLE = "منگل کی رات 74 سالہ سابق وزیرِ اعظم عمران خان کو راولپنڈی کی اڈیالہ جیل سے اسلام آباد کے پمز ہسپتال لے جایا گیا۔";

export default function VoiceForm({ initial, voices }) {
  const [v, setV] = useState(initial);
  const [text, setText] = useState(SAMPLE);
  const [audio, setAudio] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function listen() {
    setBusy(true); setMsg("Making the voice… about 10 seconds"); setAudio("");
    try { const r = await testVoiceAction(v, text); if (r.error) setMsg(r.error); else { setAudio(r.audio); setMsg(`${r.seconds} seconds · ${r.model}`); } }
    catch { setMsg("Could not make the voice, try again."); }
    setBusy(false);
  }
  async function save() {
    setBusy(true); setMsg("");
    try { const r = await saveVoiceAction(v); setMsg(r.error || "Saved ✓ reels will use this voice."); }
    catch { setMsg("Could not save, try again."); }
    setBusy(false);
  }

  return (
    <div>
      <div className="cm-row" style={{ alignItems: "end", flexWrap: "wrap", gap: "1rem" }}>
        <label>Voice
          <select value={v.voice} onChange={set("voice")}>{voices.map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label style={{ flex: 1, minWidth: 260 }}>Style (how it is read, in English)
          <input type="text" value={v.style} onChange={set("style")} maxLength={300} style={{ width: "100%" }} />
        </label>
        <label style={{ flex: "1 1 100%" }}>Models, in order (each has its own free daily limit; the next is used when one runs out)
          <input type="text" value={v.model} onChange={set("model")} maxLength={300} style={{ width: "100%" }} />
        </label>
        <label>Speed (1 = normal, 1.1, 1.15 …)
          <input type="number" min="0.8" max="1.4" step="0.05" value={v.speed ?? 1} onChange={(e) => setV({ ...v, speed: e.target.value })} style={{ width: 90 }} />
        </label>
        <label><input type="checkbox" checked={v.on} onChange={set("on")} /> Use voice in reels</label>
      </div>
      <label style={{ display: "block", marginTop: "1rem" }}>Text to try
        <textarea dir="rtl" rows={3} value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", fontSize: "1.3rem" }} />
      </label>
      <p style={{ marginTop: ".8rem", display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn secondary" disabled={busy} onClick={listen}>Listen</button>
        <button className="btn publish" disabled={busy} onClick={save}>Save voice settings</button>
        {msg && <span className="hint">{msg}</span>}
      </p>
      {audio && <audio controls autoPlay src={audio} onPlay={(e) => { e.currentTarget.playbackRate = Math.min(1.4, Math.max(0.8, Number(v.speed) || 1)); }} style={{ width: "100%", marginTop: ".5rem" }} />}
    </div>
  );
}
