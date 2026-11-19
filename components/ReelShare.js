"use client";
import { useState } from "react";

const S = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const ICON = {
  tiktok: <svg {...S}><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 4c.4 2.4 2 4 4.5 4.2" /></svg>,
  facebook: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="20" textAnchor="middle" fontSize="22" fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff">f</text></svg>,
  instagram: <svg {...S}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".9" fill="#fff" stroke="none" /></svg>,
  x: <svg {...S} strokeWidth="2.4"><path d="M5 5l14 14M19 5L5 19" /></svg>,
  whatsapp: <svg {...S}><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.9L3.5 20.5l4.2-1.1A8.5 8.5 0 1 0 12 3.5z" /><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2z" fill="#fff" stroke="none" /></svg>,
};
const B = [
  { k: "tiktok", label: "TikTok", bg: "#111" },
  { k: "facebook", label: "Facebook", bg: "#1877f2" },
  { k: "instagram", label: "Instagram", bg: "#c13584" },
  { k: "x", label: "X", bg: "#000" },
  { k: "whatsapp", label: "WhatsApp", bg: "#1faa59" },
];

export function ShareMark() {
  return <svg className="reel-share-mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5.5" r="2.7" /><circle cx="6" cy="12" r="2.7" /><circle cx="18" cy="18.5" r="2.7" /><path d="M8.4 10.7l7.2-3.9M8.4 13.3l7.2 3.9" /></svg>;
}

/** Five round share buttons of the same size in one row. Facebook, X and WhatsApp take the link directly; TikTok and Instagram have no link-share address, so they open the phone's share sheet (or copy the link). */
export default function ReelShare({ url, title, copied = "لنک کاپی ہو گیا۔ اب ایپ میں چسپاں کریں۔" }) {
  const [msg, setMsg] = useState("");
  const u = (src) => encodeURIComponent(`${url}?utm_source=${src}&utm_medium=video`);
  const t = encodeURIComponent(title);
  const href = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u("facebook")}`,
    x: `https://x.com/intent/post?text=${t}&url=${u("x")}`,
    whatsapp: `https://wa.me/?text=${t}%20${u("whatsapp")}`,
  };
  const viaApp = async (k) => {
    const link = `${url}?utm_source=${k}&utm_medium=video`;
    try { if (navigator.share) { await navigator.share({ title, url: link }); return; } } catch { /* cancelled: fall back to copy */ }
    try { await navigator.clipboard.writeText(link); setMsg(copied); setTimeout(() => setMsg(""), 4000); } catch { setMsg(link); }
  };
  return (
    <div className="reel-share" dir="ltr">
      {B.map((b) => href[b.k]
        ? <a key={b.k} href={href[b.k]} target="_blank" rel="noopener noreferrer" aria-label={b.label} title={b.label} style={{ background: b.bg }}>{ICON[b.k]}</a>
        : <button key={b.k} type="button" onClick={() => viaApp(b.k)} aria-label={b.label} title={b.label} style={{ background: b.bg }}>{ICON[b.k]}</button>)}
      {msg && <span className="reel-share-msg" dir="rtl">{msg}</span>}
    </div>
  );
}
