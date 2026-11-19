"use client";
import { useState } from "react";

const B = [
  { k: "tiktok", label: "TikTok", bg: "#111", app: true },
  { k: "facebook", label: "Facebook", bg: "#1877f2" },
  { k: "instagram", label: "Instagram", bg: "#c13584", app: true },
  { k: "x", label: "X", bg: "#000" },
  { k: "whatsapp", label: "WhatsApp", bg: "#1faa59" },
];

/** Share buttons for the video. Facebook, X and WhatsApp take the link directly; TikTok and Instagram have no link-share address, so they open the phone's share sheet (or copy the link). */
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
        ? <a key={b.k} href={href[b.k]} target="_blank" rel="noopener noreferrer" style={{ background: b.bg }}>{b.label}</a>
        : <button key={b.k} type="button" onClick={() => viaApp(b.k)} style={{ background: b.bg }}>{b.label}</button>)}
      {msg && <span className="reel-share-msg" dir="rtl">{msg}</span>}
    </div>
  );
}
