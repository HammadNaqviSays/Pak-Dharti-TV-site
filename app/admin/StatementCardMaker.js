"use client";
import { useEffect, useRef, useState } from "react";
import { drawStatementCard, statementCaption, todayLabel, URDU_FONTS, URDU_FONT_CSS, wordColors, markWords } from "@/lib/statementCard";
import { searchPeopleAction, readStatementPostAction } from "./actions";

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/** Shrinks a picked image to a JPEG data URL (max 1400 px) so it can be sent to the server. */
function shrink(file, max = 1400) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
/** Loads the Google Fonts once and keeps only the ones that really have the Urdu letters (ٹ ڈ ڑ ں ے). */
function useUrduFonts() {
  const [ok, setOk] = useState(() => new Set(URDU_FONTS.filter((f) => !f.g).map((f) => f.id)));
  useEffect(() => {
    let alive = true;
    if (!document.getElementById("pd-urdu-fonts")) {
      const st = document.createElement("style"); st.id = "pd-urdu-fonts"; st.textContent = URDU_FONT_CSS; document.head.appendChild(st);
    }
    for (const f of URDU_FONTS) {
      if (!f.g || document.getElementById(`gf-${f.id}`)) continue;
      const l = document.createElement("link");
      l.id = `gf-${f.id}`; l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`;
      document.head.appendChild(l);
    }
    (async () => {
      const probe = "ٹڈڑںےۓھ";
      const c = document.createElement("canvas").getContext("2d");
      const good = new Set(URDU_FONTS.filter((f) => !f.g).map((f) => f.id));
      await Promise.all(URDU_FONTS.filter((f) => f.g).map(async (f) => {
        try {
          const faces = await document.fonts.load(`40px ${f.family}`, probe);
          if (!faces.length) return;
          c.font = `40px ${f.family}, monospace`; const a = c.measureText(probe).width;
          c.font = "40px monospace"; const b = c.measureText(probe).width;
          if (Math.abs(a - b) > 0.5) good.add(f.id);
        } catch {}
      }));
      if (alive) setOk(good);
    })();
    return () => { alive = false; };
  }, []);
  return ok;
}

function fileImage(file) {
  return new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = URL.createObjectURL(file); });
}
/** The post as a canvas with the other page's QR codes, logos, names and labels painted over with the colours around them. */
function cleanPost(img, boxes = []) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const avg = (sx, sy, sw, sh) => {
    sx = Math.max(0, Math.min(c.width - 1, Math.round(sx))); sy = Math.max(0, Math.min(c.height - 1, Math.round(sy)));
    sw = Math.max(1, Math.min(c.width - sx, Math.round(sw))); sh = Math.max(1, Math.min(c.height - sy, Math.round(sh)));
    const d = x.getImageData(sx, sy, sw, sh).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  };
  for (const bx of boxes) {
    let [y0, x0, y1, x1] = bx.map((v) => Math.max(0, Math.min(1000, Number(v) || 0)) / 1000);
    if (x1 <= x0 || y1 <= y0) continue;
    const m = 0.012;
    x0 = Math.max(0, x0 - m) * c.width; x1 = Math.min(1, x1 + m) * c.width; y0 = Math.max(0, y0 - m) * c.height; y1 = Math.min(1, y1 + m) * c.height;
    const ring = Math.max(6, c.width * 0.01);
    const top = avg(x0, y0 - ring, x1 - x0, ring), bot = avg(x0, y1, x1 - x0, ring);
    const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bot);
    x.save();
    try { x.filter = `blur(${Math.round(ring * 0.8)}px)`; } catch {}
    x.fillStyle = g; x.fillRect(x0 - ring / 2, y0 - ring / 2, x1 - x0 + ring, y1 - y0 + ring);
    x.restore();
    x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  return c;
}
/** Cuts a part out of a canvas: box = [ymin, xmin, ymax, xmax] on a 0–1000 scale. */
function cropCanvas(src, box, inset = 0) {
  if (!src || !Array.isArray(box) || box.length !== 4) return "";
  let [y0, x0, y1, x1] = box.map((v) => Math.max(0, Math.min(1000, Number(v) || 0)) / 1000);
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return "";
  const ix = (x1 - x0) * inset, iy = (y1 - y0) * inset;
  x0 += ix; x1 -= ix; y0 += iy; y1 -= iy;
  const c = document.createElement("canvas");
  c.width = Math.round((x1 - x0) * src.width); c.height = Math.round((y1 - y0) * src.height);
  c.getContext("2d").drawImage(src, x0 * src.width, y0 * src.height, c.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.95);
}

/** A labelled slider. */
function Slider({ label, value, min, max, step, onChange, fmt = (v) => `${Math.round(v * 100)}%` }) {
  return (
    <label>{label} <b>{fmt(value)}</b>
      <span className="sc-slide">
        <button type="button" onClick={() => onChange(Math.max(min, +(value - step).toFixed(3)))}>−</button>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <button type="button" onClick={() => onChange(Math.min(max, +(value + step).toFixed(3)))}>+</button>
      </span>
    </label>
  );
}
const px = (v) => `${v > 0 ? "+" : ""}${Math.round(v)}`;

/** Size, position (and tilt) of one picture. */
function PicControls({ v, onChange, tilt = false }) {
  const set = (k) => (x) => onChange({ ...v, [k]: x });
  return (
    <div className="sc-sliders">
      <Slider label="Picture size" value={v.scale ?? 1} min={0.3} max={2} step={0.02} onChange={set("scale")} />
      <Slider label="Left ↔ right" value={v.dx ?? 0} min={-500} max={500} step={5} onChange={set("dx")} fmt={px} />
      <Slider label="Up ↕ down" value={v.dy ?? 0} min={-500} max={400} step={5} onChange={set("dy")} fmt={px} />
      {tilt && <Slider label="Tilt" value={v.tilt ?? 0} min={-15} max={15} step={0.5} onChange={set("tilt")} fmt={(x) => `${x}°`} />}
    </div>
  );
}

const STYLE_KEYS = ["font", "sizeK", "gapK", "lineK", "bold", "align", "firstRed", "color", "colorA", "colorB", "dateBlue", "textW", "nameK", "picMode"];
function savedStyle() { try { return JSON.parse(localStorage.getItem("pd-bayan-style") || "{}"); } catch { return {}; } }

const photoOf = (p) => { const ph = p?.photos?.[0]; return ph ? { src: ph.cutout || ph.url, cut: !!ph.cutout, person: p, credit: ph.credit ? `${ph.credit}${ph.license ? ` (${ph.license})` : ""}` : "" } : null; };

async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }

/** Pick a person from the library (with their cut-outs) or upload a photo. */
function PersonPicker({ label, value, onChange, allowPhotoKinds = false }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  async function search() {
    setBusy(true);
    const r = await searchPeopleAction(q);
    setBusy(false);
    setItems(r.items || []);
  }
  const pick = (p, ph) => {
    onChange({ ...value, src: ph.cutout || ph.url, cut: !!ph.cutout, person: p, credit: ph.credit ? `${ph.credit}${ph.license ? ` (${ph.license})` : ""}` : "" });
    setItems([]);
  };
  function file(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    // a PNG/WebP with transparency counts as a cut-out
    onChange({ ...value, src: URL.createObjectURL(f), cut: /png|webp/.test(f.type), person: null, credit: "" });
  }
  return (
    <fieldset className="sc-pick">
      <legend>{label}</legend>
      <div className="cm-row" style={{ alignItems: "end" }}>
        <label style={{ flex: 1 }}>Search the people library (English or Urdu)
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Imran Khan / عمران خان" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
        </label>
        <button type="button" className="btn secondary" onClick={search} disabled={busy || q.length < 2}>{busy ? "…" : "Search"}</button>
      </div>
      {items.length > 0 && (
        <div className="sc-results">
          {items.map((p) => (
            <div key={p.id} className="sc-person">
              <strong>{p.nameUr || p.name}</strong> <span className="muted">{p.name}{p.roleUr ? ` · ${p.roleUr}` : ""}</span>
              <div className="sc-photos">
                {!p.photos.length && <span className="muted">No photo yet — upload a handout in the People library.</span>}
                {p.photos.slice(0, 8).map((ph) => (
                  <button type="button" key={ph.url} onClick={() => pick(p, ph)} title={ph.cutout ? "Cut-out (background removed)" : "Photo"}>
                    <img src={ph.cutout || ph.thumb} alt="" className={ph.cutout ? "cut" : ""} />
                    <small>{ph.cutout ? "cut-out" : "photo"}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cm-row">
        <label>…or a file from your device<input type="file" accept="image/*" onChange={file} /></label>
        {value.src && (
          <>
            <label><span><input type="checkbox" checked={!!value.cut} onChange={(e) => onChange({ ...value, cut: e.target.checked })} /> Background already removed</span></label>
            <label><span><input type="checkbox" checked={!!value.flip} onChange={(e) => onChange({ ...value, flip: e.target.checked })} /> Mirror (face the other way)</span></label>
            <button type="button" className="btn secondary" onClick={() => onChange({ ...value, src: "", person: null })}>Remove</button>
          </>
        )}
      </div>
      {value.credit && <p className="hint">Photo: {value.credit}</p>}
    </fieldset>
  );
}

/** Statement ("bayan") card in the Pak Dharti post style. */
export default function StatementCardMaker({ initial = {} }) {
  const [d, setD] = useState({
    text: initial.text || "", name: initial.name || "", date: todayLabel(true),
    firstRed: true, dateBlue: false, side: "left", size: "square",
    font: "noori", sizeK: 1, gapK: 1, lineK: 1, bold: 1, align: "justify", color: "#111111", colorA: "#8B0000", colorB: "#0B3D91",
    picMode: "bottom",
    main: { src: initial.src || "", cut: !!initial.cut, flip: false, credit: initial.credit || "" },
    second: { kind: "none", src: "", cut: false, flip: false },
  });
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState({ title: "", titleEn: "", hashtags: "" });
  const [reading, setReading] = useState(false);
  const [missing, setMissing] = useState("");
  const [full, setFull] = useState(false);
  const [big, setBig] = useState(false);
  const canvas = useRef(null);
  const fontsOk = useUrduFonts();
  // the style you used last time comes back (only in this browser)
  useEffect(() => { const st = savedStyle(); if (Object.keys(st).length) setD((d0) => ({ ...d0, ...st })); }, []);
  useEffect(() => { try { localStorage.setItem("pd-bayan-style", JSON.stringify(Object.fromEntries(STYLE_KEYS.map((k) => [k, d[k]])))); } catch {} }, [d]);
  const words = wordColors(d.text);
  const tapWord = (i) => { const w = words.map((x) => ({ ...x })); w[i].c = (w[i].c + 1) % 3; setD({ ...d, text: markWords(w) }); };

  async function readPost(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReading(true); setMsg("");
    try {
      const r = await readStatementPostAction(await shrink(f));
      if (r.error) { setMsg(r.error); return; }
      let main = photoOf(r.person);
      let sec = r.second === "person" ? photoOf(r.secondP) : null;
      let secPhoto = "", bottom = "";
      if (d.picMode !== "library") {
        const img = await fileImage(f);
        const clean = img ? cleanPost(img, r.eraseBoxes) : null;
        if (clean && d.picMode === "bottom") bottom = cropCanvas(clean, r.bottomBox?.length === 4 ? r.bottomBox : [550, 0, 1000, 1000]);
        if (clean && d.picMode === "separate") {
          const m = cropCanvas(clean, r.mainBox);
          if (m) main = { src: m, cut: false, person: r.person || null, credit: "" };
          const s2 = cropCanvas(clean, r.secondBox, r.second === "photo" ? 0.015 : 0);
          if (s2 && r.second === "person") sec = { src: s2, cut: false, person: r.secondP || null, credit: "" };
          if (s2 && r.second === "photo") secPhoto = s2;
        }
      }
      if (bottom) {
        setD((d0) => ({ ...d0, text: r.text || d0.text, name: r.speakerUr || r.person?.nameUr || d0.name, date: r.date || d0.date,
          main: { ...d0.main, src: "", person: r.person || null, credit: "" },
          second: { ...d0.second, kind: "postbottom", src: bottom, scale: 1, dx: 0, dy: 0 } }));
        setMeta({ title: r.title, titleEn: r.titleEn, hashtags: (r.hashtags || []).join(" ") });
        setMissing("");
        setMsg(`Read. The lower part of the post is used (${(r.eraseBoxes || []).length} logos/codes/labels removed). Check the words before posting; move or resize the picture under “Second picture”.`);
        return;
      }
      setD((d0) => ({
        ...d0, text: r.text || d0.text, name: r.speakerUr || r.person?.nameUr || d0.name, date: r.date || d0.date,
        main: main ? { ...d0.main, ...main } : { ...d0.main, src: "", person: null, credit: "" },
        second: sec ? { ...d0.second, ...sec, kind: "person" } : r.second === "photo" ? { ...d0.second, kind: "photo", src: secPhoto } : { ...d0.second, kind: "none", src: "" },
      }));
      setMeta({ title: r.title, titleEn: r.titleEn, hashtags: (r.hashtags || []).join(" ") });
      const notes = [];
      if (!main) notes.push(r.person ? `${r.speaker} is in the library but has no photo yet: upload one in the People library.` : `${r.speaker || "The speaker"} is not in the library yet: add them (button below) and upload a photo, or pick a file under “Speaker”.`);
      setMissing(!main ? r.speaker || "" : "");
      if (r.second === "person" && !sec) notes.push(`Second person (${r.secondPerson || "?"}) not found in the library.`);
      if (r.second === "photo" && !secPhoto) notes.push("The post had a photo/screenshot: add your own copy (e.g. your screenshot of the tweet) under “Second picture”.");
      setMsg(["Read. Check the words against the original before posting.", ...notes].join(" "));
    } catch (err) { setMsg(String(err.message || err)); }
    finally { setReading(false); e.target.value = ""; }
  }

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const c = canvas.current || (canvas.current = document.createElement("canvas"));
      await drawStatementCard(c, d);
      if (alive) setPreview(c.toDataURL("image/jpeg", 0.85));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [d]);

  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setMain = (v) => {
    const p = v.person;
    setD({ ...d, main: v, name: p && (!d.name || d.name === d.main.person?.nameUr) ? p.nameUr || p.name : d.name });
  };
  async function save() {
    setBusy(true);
    const c = document.createElement("canvas");
    await drawStatementCard(c, d);
    download(await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95)), `pak-dharti-bayan-${Date.now()}.jpg`);
    setBusy(false);
  }
  function secondFile(e) {
    const f = e.target.files?.[0];
    if (f) setD({ ...d, second: { ...d.second, src: URL.createObjectURL(f), cut: /png|webp/.test(f.type) } });
  }

  return (
    <section className="card-maker sc-maker">
      <h2>Bayan card (statement)</h2>
      <p className="hint">The Pak Dharti post style: the statement in big Urdu at the top, the name strip and date, the speaker's cut-out at the bottom. Tap words to colour them, or type <b>*stars*</b> (colour 1) or <b>_underscores_</b> (colour 2) around them.</p>
      <div className="cm-grid">
        <div className="cm-form">
          <fieldset className="sc-pick sc-read">
            <legend>Quick start: from a post</legend>
            <label>Choose a screenshot of a statement post (e.g. from Siasat.pk). The words, speaker, date, title and hashtags are filled in, in our design.
              <input type="file" accept="image/*" onChange={readPost} disabled={reading} />
            </label>
            <label>Pictures
              <select value={d.picMode} onChange={set("picMode")}>
                <option value="bottom">From the post: the whole lower part (person, clipping …), QR code and logos removed</option>
                <option value="separate">From the post: person and picture separately</option>
                <option value="library">From our People library</option>
              </select>
            </label>
            {reading && <p className="hint">Reading the post…</p>}
            {missing && <p className="hint"><a className="btn secondary" href={`/admin/people?add=${encodeURIComponent(missing)}&q=${encodeURIComponent(missing)}`} target="_blank" rel="noopener">Add {missing} to the People library</a></p>}
          </fieldset>
          <label>Statement (Urdu)
            <textarea rows={6} value={d.text} onChange={set("text")} dir="rtl" className="cm-ur" placeholder="جو *معصوم لوگوں* کو مارتا ہے، وہ دہشت گرد ہے" />
          </label>
          {words.length > 0 && (
            <div className="sc-words" dir="rtl">
              <small dir="ltr">Tap a word to change its colour (black → colour 1 → colour 2):</small>
              <div>{words.map((w, i) => (
                <button type="button" key={i} onClick={() => tapWord(i)} style={{ color: w.c === 1 ? d.colorA : w.c === 2 ? d.colorB : d.color, borderColor: w.c ? "currentColor" : "#ddd" }}>{w.t}</button>
              ))}</div>
            </div>
          )}
          <fieldset className="sc-pick">
            <legend>Text style</legend>
            <div className="cm-row">
              <label>Font
                <select value={d.font} onChange={set("font")} style={{ fontFamily: URDU_FONTS.find((f) => f.id === d.font)?.family }}>
                  {URDU_FONTS.filter((f) => fontsOk.has(f.id) || f.id === d.font).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </label>
              <label>Alignment
                <select value={d.align} onChange={set("align")}>
                  <option value="justify">Justified (short lines centred)</option><option value="center">Centre</option><option value="right">Right</option>
                </select>
              </label>
            </div>
            <div className="sc-sliders">
              <Slider label="Text size" value={d.sizeK} min={0.4} max={2} step={0.02} onChange={(v) => setD({ ...d, sizeK: v })} />
              <Slider label="Space between words" value={d.gapK} min={0} max={3} step={0.05} onChange={(v) => setD({ ...d, gapK: v })} />
              <Slider label="Space between lines" value={d.lineK} min={0.5} max={2} step={0.02} onChange={(v) => setD({ ...d, lineK: v })} />
              <Slider label="Bold" value={d.bold} min={0} max={6} step={0.25} onChange={(v) => setD({ ...d, bold: v })} fmt={(v) => (v === 0 ? "off" : `${v}×`)} />
              <Slider label="Text width" value={d.textW ?? 1} min={0.5} max={1.06} step={0.01} onChange={(v) => setD({ ...d, textW: v })} />
              <Slider label="Text up ↕ down" value={d.textY ?? 0} min={-30} max={400} step={5} onChange={(v) => setD({ ...d, textY: v })} fmt={px} />
            </div>
            <div className="sc-sliders">
              <Slider label="Name strip size" value={d.nameK ?? 1} min={0.5} max={1.8} step={0.02} onChange={(v) => setD({ ...d, nameK: v })} />
              <Slider label="Name left ↔ right" value={d.nameX ?? 0} min={-450} max={450} step={5} onChange={(v) => setD({ ...d, nameX: v })} fmt={px} />
              <Slider label="Name up ↕ down" value={d.nameY ?? 0} min={-200} max={500} step={5} onChange={(v) => setD({ ...d, nameY: v })} fmt={px} />
            </div>
            <div className="cm-row sc-colors">
              <label>Text<input type="color" value={d.color} onChange={set("color")} /></label>
              <label>Colour 1<input type="color" value={d.colorA} onChange={set("colorA")} /></label>
              <label>Colour 2<input type="color" value={d.colorB} onChange={set("colorB")} /></label>
              <label><span><input type="checkbox" checked={d.firstRed} onChange={set("firstRed")} /> First line in colour 1</span></label>
            </div>
            <button type="button" className="btn secondary" onClick={() => setD({ ...d, font: "noori", sizeK: 1, gapK: 1, lineK: 1, bold: 1, align: "justify", color: "#111111", colorA: "#8B0000", colorB: "#0B3D91", firstRed: true, textW: 1, textY: 0, nameK: 1, nameX: 0, nameY: 0 })}>Reset style</button>
          </fieldset>
          <div className="cm-row">
            <label>Name on the strip (Urdu)<input value={d.name} onChange={set("name")} dir="rtl" className="cm-ur" placeholder="وزیراعلیٰ سہیل آفریدی" /></label>
            <label>Date<input value={d.date} onChange={set("date")} /></label>
          </div>
          {d.main.person?.roleUr && (
            <p className="hint">Role: <button type="button" className="btn secondary" onClick={() => setD({ ...d, name: `${d.main.person.roleUr} ${d.main.person.nameUr || d.main.person.name}` })}>Add “{d.main.person.roleUr}” to the name</button></p>
          )}
          <div className="cm-row">
            <label>Date colour
              <select value={d.dateBlue ? "blue" : "red"} onChange={(e) => setD({ ...d, dateBlue: e.target.value === "blue" })}>
                <option value="red">Dark red</option><option value="blue">Dark blue</option>
              </select>
            </label>
            <label>Speaker on the
              <select value={d.side} onChange={set("side")}><option value="left">Left</option><option value="right">Right</option></select>
            </label>
            <label>Size
              <select value={d.size} onChange={set("size")}>
                <option value="square">Square 1:1</option><option value="post">Portrait 4:5</option>
              </select>
            </label>
          </div>

          <PersonPicker label="Speaker" value={d.main} onChange={setMain} />
          {d.main.src && <PicControls v={d.main} onChange={(v) => setD({ ...d, main: v })} />}

          <fieldset className="sc-pick">
            <legend>Second picture (other side)</legend>
            <label>What
              <select value={d.second.kind} onChange={(e) => setD({ ...d, second: { ...d.second, kind: e.target.value } })}>
                <option value="none">Nothing</option>
                <option value="person">A second person (cut-out)</option>
                <option value="photo">A photo or screenshot in a frame (tweet, newspaper, event)</option>
                <option value="backdrop">A place photo behind (assembly, court, rally)</option>
                <option value="postbottom">The lower part of a post (full width)</option>
              </select>
            </label>
            {d.second.kind !== "none" && d.second.src && <PicControls v={d.second} tilt={d.second.kind === "photo"} onChange={(v) => setD({ ...d, second: v })} />}
          </fieldset>
          {d.second.kind === "person" && <PersonPicker label="Second person" value={d.second} onChange={(v) => setD({ ...d, second: { ...v, kind: "person" } })} />}
          {["photo", "backdrop", "postbottom"].includes(d.second.kind) && (
            <label>Picture file<input type="file" accept="image/*" onChange={secondFile} /></label>
          )}

          <fieldset className="sc-pick">
            <legend>Caption for the post</legend>
            <label>Title (Urdu)<input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} dir="rtl" className="cm-ur" /></label>
            <label>Title (English)<input value={meta.titleEn} onChange={(e) => setMeta({ ...meta, titleEn: e.target.value })} /></label>
            <label>Hashtags<textarea rows={2} value={meta.hashtags} onChange={(e) => setMeta({ ...meta, hashtags: e.target.value })} /></label>
          </fieldset>
          <div className="cm-actions">
            <button className="btn publish" onClick={save} disabled={busy}>{busy ? "Saving…" : "Download card"}</button>
            <button className="btn secondary" onClick={async () => setMsg((await copy(statementCaption({ ...d, ...meta }))) ? "Caption copied (title, statement, hashtags)." : "Could not copy.")}>Copy caption</button>
            <button className="btn secondary" onClick={async () => setMsg((await copy(meta.hashtags)) ? "Hashtags copied." : "Could not copy.")} disabled={!meta.hashtags}>Copy hashtags</button>
          </div>
          {msg && <p className="hint">{msg}</p>}
          <p className="hint">Use only real statements, word for word, and photos from the library, official handouts or your own. Screenshots of posts: keep the original link for the first comment.</p>
        </div>
        <div className={`cm-preview${big ? " big" : ""}`}>
          {preview ? <img src={preview} alt="Card preview" onClick={() => setFull(true)} style={{ cursor: "zoom-in" }} /> : <div className="cm-wait">Drawing…</div>}
          <div className="sc-view">
            <button type="button" className="btn secondary" onClick={() => setFull(true)} disabled={!preview}>View full size</button>
            <button type="button" className="btn secondary sc-mobile" onClick={() => setBig(!big)}>{big ? "Smaller preview" : "Bigger preview"}</button>
            <button type="button" className="btn publish" onClick={save} disabled={busy}>{busy ? "Saving…" : "Download"}</button>
          </div>
        </div>
      </div>
      {full && preview && (
        <div className="sc-full" onClick={() => setFull(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <img src={preview} alt="Card" />
            <div className="cm-actions">
              <button type="button" className="btn secondary" onClick={() => setFull(false)}>Close and edit</button>
              <button type="button" className="btn publish" onClick={save} disabled={busy}>{busy ? "Saving…" : "Download"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
