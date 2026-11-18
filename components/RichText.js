/**
 * Small text helper for the utility pages. Numbers are set in their own left-to-right span (with breathing space in
 * Urdu text) and **double-starred** parts, such as prices, are shown bold: "**429,136 PKR**".
 */
// Latin codes like KSE-100 and numbers or dates like 2026-11-06, 9:30, 173,886.68 each stay in one left-to-right piece
const TOKEN = /([A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)?|\d+(?:[,.:\-/]\d+)*)/g;
const num = (s, k) => String(s).split(TOKEN).map((p, i) => (i % 2 === 1 ? <span key={`${k}-${i}`} className="n" dir="ltr">{p}</span> : p));

export default function RichText({ text }) {
  if (!text) return null;
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i} className="n price" dir="ltr">{p.slice(2, -2)}</b> : <span key={i}>{num(p, i)}</span>));
}

export const plain = (s) => String(s || "").replace(/\*\*/g, "");
