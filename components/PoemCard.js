"use client";
import { useEffect, useRef, useState } from "react";
import { drawPoemPages, canvasToBlob, jpegsToPdf } from "@/lib/poemCanvas";

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// The poem as framed calligraphy cards (one per page for long poems). What you see is exactly what you save.
export default function PoemCard({ poem, poet, fileName, pageUrl }) {
  const canvases = useRef([]);
  const [srcs, setSrcs] = useState([]);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const data = { lines: poem.lines, title: poem.title, poet: poet.name, source: poem.source };
  const many = srcs.length > 1;

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await drawPoemPages(data);
      if (!alive) return;
      canvases.current = list;
      const urls = [];
      for (const c of list) urls.push(URL.createObjectURL(await canvasToBlob(c)));
      if (alive) { setSrcs(urls); setCur(0); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poem.slug]);

  const jpeg = (i) => canvasToBlob(canvases.current[i], "image/jpeg", 0.95);
  const pageName = (i) => (many ? `${fileName}-${i + 1}` : fileName);

  async function saveImage() {
    setBusy("jpg"); setMsg("");
    download(await jpeg(cur), `${pageName(cur)}.jpg`);
    setBusy("");
  }

  async function savePdf() {
    setBusy("pdf"); setMsg("");
    const cards = [];
    for (let i = 0; i < canvases.current.length; i++) {
      const c = canvases.current[i];
      cards.push({ blob: await jpeg(i), w: c.width, h: c.height });
    }
    download(await jpegsToPdf(cards), `${fileName}.pdf`);
    setBusy("");
  }

  async function share() {
    const text = `${poem.title} — ${poet.name}\n${pageUrl}`;
    try {
      if (canvases.current.length && navigator.canShare) {
        const files = [];
        for (let i = 0; i < canvases.current.length; i++) {
          files.push(new File([await jpeg(i)], `${pageName(i)}.jpg`, { type: "image/jpeg" }));
        }
        if (navigator.canShare({ files })) { await navigator.share({ files, text }); return; }
      }
      if (navigator.share) { await navigator.share({ text, url: pageUrl }); return; }
    } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function copy() {
    const verses = poem.lines.map((c) => c.filter(Boolean).join("\n")).join("\n\n");
    const text = `${poem.title}\n\n${verses}\n\n— ${poet.name}\n(پاک دھرتی ٹی وی)`;
    try { await navigator.clipboard.writeText(text); setMsg("کلام کاپی ہو گیا"); } catch { setMsg("کاپی نہیں ہو سکا"); }
    setTimeout(() => setMsg(""), 2500);
  }

  const alt = (i) => `${poem.title} — ${poet.name}${many ? ` (صفحہ ${i + 1})` : ""}`;

  return (
    <figure className="poem-figure">
      <div className={`poem-frame${srcs.length ? " ready" : ""}`}>
        {srcs.length
          ? <img src={srcs[cur]} alt={alt(cur)} width={canvases.current[cur]?.width} height={canvases.current[cur]?.height} />
          : (
            <div className="poem-fallback" aria-hidden="true">
              <p className="poem-fallback-title">{poem.title}</p>
              {poem.lines.slice(0, 4).map((c, i) => <div key={i} className="couplet">{c.filter(Boolean).map((m, j) => <p key={j}>{m}</p>)}</div>)}
              <p className="poem-fallback-poet">{poet.name}</p>
            </div>
          )}
      </div>

      {many && (
        <div className="poem-pager">
          <button className="pg-btn" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0} aria-label="پچھلا صفحہ">→</button>
          <div className="pg-thumbs">
            {srcs.map((s, i) => (
              <button key={i} className={`pg-thumb${i === cur ? " on" : ""}`} onClick={() => setCur(i)} aria-label={`صفحہ ${i + 1}`}>
                <img src={s} alt="" />
              </button>
            ))}
          </div>
          <button className="pg-btn" onClick={() => setCur((c) => Math.min(srcs.length - 1, c + 1))} disabled={cur === srcs.length - 1} aria-label="اگلا صفحہ">←</button>
        </div>
      )}

      <figcaption className="poem-actions">
        <button className="pa-btn pa-main" onClick={saveImage} disabled={!srcs.length || !!busy}>
          {busy === "jpg" ? "تیار ہو رہی ہے…" : many ? `صفحہ ${cur + 1} کی تصویر` : "تصویر محفوظ کریں"}
        </button>
        <button className="pa-btn pa-main" onClick={savePdf} disabled={!srcs.length || !!busy}>
          {busy === "pdf" ? "تیار ہو رہی ہے…" : many ? "مکمل کلام PDF" : "PDF محفوظ کریں"}
        </button>
        <button className="pa-btn" onClick={share} disabled={!srcs.length}>شیئر کریں</button>
        <button className="pa-btn" onClick={copy}>کلام کاپی کریں</button>
        {msg && <span className="pa-msg" role="status">{msg}</span>}
      </figcaption>
    </figure>
  );
}
