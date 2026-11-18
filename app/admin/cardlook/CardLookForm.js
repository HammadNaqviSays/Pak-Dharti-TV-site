"use client";
import { useState, useEffect, useRef } from "react";
import { saveCardLookAction } from "../cardLookAction";

export default function CardLookForm({ initial, stories }) {
  const [v, setV] = useState(initial);
  const [slug, setSlug] = useState(stories[0]?.slug || "");
  const [lang, setLang] = useState("ur");
  const [src, setSrc] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === "range" ? Number(e.target.value) : e.target.value });

  const ticket = useRef(0);
  function show() {
    if (!slug) { setMsg("No story with people found yet."); return; }
    const my = ++ticket.current;
    setMsg("Drawing the card… about 10 seconds");
    const url = `/api/admin/card-preview?slug=${encodeURIComponent(slug)}&lang=${lang}&noCut=${v.noCut}&flagStyle=${v.flagStyle}&badge=${v.badge}&pick=${v.pick}&maxPics=${v.maxPics}&headline=${v.headline}&scale=${v.scale}&flag=${v.flag}&glow=${v.glow}&t=${Date.now()}`;
    const im = new Image();
    im.onload = () => { if (my === ticket.current) { setSrc(url); setMsg(""); } };
    im.onerror = async () => {
      if (my !== ticket.current) return;
      let why = "";
      try { why = (await (await fetch(url)).text()).slice(0, 200); } catch {}
      setMsg(`Could not draw the preview. ${why || "Try another story."}`);
    };
    im.src = url;
  }
  // live: any change redraws the card after a short pause (the old picture stays until the new one is ready)
  useEffect(() => { const t = setTimeout(show, 700); return () => clearTimeout(t); }, [v, slug, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    setBusy(true); setMsg("");
    try { const r = await saveCardLookAction(v); setMsg(r.error || "Saved ✓ new cards will use this."); }
    catch { setMsg("Could not save, try again."); }
    setBusy(false);
  }

  return (
    <div>
      <div className="cm-row" style={{ alignItems: "end", flexWrap: "wrap", gap: "1rem" }}>
        <label>People with a photo but no cut-out
          <select value={v.noCut} onChange={set("noCut")}>
            <option value="whole">Whole picture, never cropped (story image on the other side)</option>
            <option value="photo">Plain photo, full width (cleanest)</option>
            <option value="bust">Head and shoulders (old background trimmed)</option>
            <option value="fade">Soft portrait (edges melt into the background)</option>
            <option value="circle">Round photo with gold ring (old)</option>
          </select>
        </label>
        <label>Two or more flags
          <select value={v.flagStyle} onChange={set("flagStyle")}>
            <option value="crack">Golden crack between the flags</option>
            <option value="blend">Smooth colour blend</option>
          </select>
        </label>
        <label>Headline on the card
          <select value={v.headline} onChange={set("headline")}>
            <option value="curious">Curious: a question or an open detail (made for the card)</option>
            <option value="news">Normal: the story's own headline</option>
          </select>
        </label>
        <label>Most pictures on one card
          <select value={v.maxPics} onChange={(e) => setV({ ...v, maxPics: Number(e.target.value) })}>
            <option value={1}>1 (one person only)</option>
            <option value={2}>2 (two people, or a person and the place)</option>
            <option value={3}>3 (people and the place together)</option>
          </select>
        </label>
        <label>Picture choice
          <select value={v.pick} onChange={set("pick")}>
            <option value="auto">Automatic: a real photo of the people together if one exists, else each person</option>
            <option value="people">Each person separately</option>
            <option value="main">Main person only (with the story's place beside)</option>
            <option value="event">Place / event big, main person beside it</option>
          </select>
        </label>
        <label>Section and date badge (top)
          <select value={v.badge} onChange={set("badge")}>
            <option value="auto">Automatic (Urdu on the right, English on the left)</option>
            <option value="right">Top right</option>
            <option value="center">Top centre</option>
            <option value="left">Top left</option>
            <option value="hide">Hide it</option>
          </select>
        </label>
        <label>Size of people: {v.scale}%<input type="range" min="80" max="125" value={v.scale} onChange={set("scale")} /></label>
        <label>Flag colour strength: {v.flag}%<input type="range" min="20" max="100" value={v.flag} onChange={set("flag")} /></label>
        <label>Golden light behind people: {v.glow}%<input type="range" min="0" max="100" value={v.glow} onChange={set("glow")} /></label>
      </div>
      <div className="cm-row" style={{ alignItems: "end", flexWrap: "wrap", gap: "1rem", margin: ".8rem 0" }}>
        <label style={{ flex: 1, minWidth: 260 }}>Story for the preview
          <select value={slug} onChange={(e) => setSlug(e.target.value)}>
            {stories.map((s) => <option key={s.slug} value={s.slug}>{s.title.slice(0, 90)}</option>)}
          </select>
        </label>
        <label>Language
          <select value={lang} onChange={(e) => setLang(e.target.value)}><option value="ur">Urdu</option><option value="en">English</option></select>
        </label>
        <button className="btn secondary" onClick={show}>Redraw</button>
        <button className="btn publish" disabled={busy} onClick={save}>Save these settings</button>
        <button className="btn secondary" onClick={() => setV({ noCut: "whole", pick: "auto", maxPics: 2, headline: "curious", badge: "auto", flagStyle: "crack", scale: 100, flag: 70, glow: 35 })}>Reset</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      {src && <img src={src} alt="Card preview" style={{ width: "100%", maxWidth: 560, borderRadius: 12, border: "1px solid #ddd" }} />}
    </div>
  );
}
