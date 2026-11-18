"use client";
import { useState } from "react";
import { drawQuoteCard } from "@/lib/quoteCard";
import { canvasToBlob } from "@/lib/poemCanvas";

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function quoteText(q, section) {
  const lines = [`✨ *${section}*`, "", q.text];
  if (q.meaning) lines.push("", `مطلب: ${q.meaning}`);
  if (q.by) lines.push("", `— ${q.by}${q.source ? ` (${q.source})` : ""}`);
  lines.push("", "— پاک دھرتی ٹی وی");
  return lines.join("\n");
}

/** A section of sayings; each can be saved as an HD square card or copied as ready text. */
export default function QuoteList({ section, sectionKey }) {
  const [busy, setBusy] = useState(-1);
  const [msg, setMsg] = useState("");
  const say = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  async function save(q, i) {
    setBusy(i);
    const c = document.createElement("canvas");
    await drawQuoteCard(c, q, section.title);
    download(await canvasToBlob(c, "image/jpeg", 0.95), `pak-dharti-${sectionKey}-${i + 1}.jpg`);
    setBusy(-1);
  }
  async function copy(q) {
    try { await navigator.clipboard.writeText(quoteText(q, section.title)); say("تحریر کاپی ہو گئی"); } catch { say("کاپی نہیں ہو سکی"); }
  }

  return (
    <>
      {msg && <p className="daily-toast" role="status">{msg}</p>}
      <div className="aqwal-grid">
        {section.items.map((q, i) => (
          <figure key={i} className={`qcard qcard-${sectionKey}`}>
            <blockquote className="q-text">{q.text}</blockquote>
            {q.meaning && <p className="q-meaning">مطلب: {q.meaning}</p>}
            {(q.by || q.source) && (
              <figcaption className="q-by">
                {q.by && <strong>{q.by}</strong>}
                {q.source && <span>{q.source}</span>}
              </figcaption>
            )}
            <div className="q-actions">
              <button className="pa-btn pa-main" onClick={() => save(q, i)} disabled={busy !== -1}>{busy === i ? "تیار ہو رہی ہے…" : "تصویر محفوظ کریں"}</button>
              <button className="pa-btn pa-wa" onClick={() => copy(q)}>تحریر کاپی کریں</button>
            </div>
          </figure>
        ))}
      </div>
    </>
  );
}
