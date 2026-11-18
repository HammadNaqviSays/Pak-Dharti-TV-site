"use client";
import { useEffect, useRef, useState } from "react";
import { CARD_DEFS, drawDailyCard } from "@/lib/dailyCards";
import { caption, allCaption, PLATFORMS } from "@/lib/dailyCaptions";
import { canvasToBlob, jpegsToPdf } from "@/lib/poemCanvas";
import { sendSocialAction, socialStatusAction } from "@/app/admin/socialAction";

// Which site page each card links to (first comment on Facebook)
const CARD_PAGE = { currency: "dollar-rate", gold: "gold-rate", kse: "psx", prayer: "prayer-times", nawafil: "prayer-times", fuel: "petrol-price", mandi: "mandi-rates" };

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }

/** Today's share cards: HD JPEG / PDF, plus ready-made text for WhatsApp, Facebook, Instagram and X. */
export default function DailyCards({ data, links }) {
  const defs = CARD_DEFS.filter((d) => d.needs(data));
  const canvases = useRef({});
  const [srcs, setSrcs] = useState({});
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);          // card whose text panel is open
  const [platform, setPlatform] = useState("facebook");
  const [toast, setToast] = useState("");
  const [canPost, setCanPost] = useState(false);   // true only for the logged-in editor (Urdu page connected)
  const [posting, setPosting] = useState("");
  const [view, setView] = useState(-1);           // index of the card open in the full-screen viewer
  const touch = useRef(null);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const def of defs) {
        const c = document.createElement("canvas");
        await drawDailyCard(c, def, data);
        if (!alive) return;
        canvases.current[def.key] = c;
        const url = URL.createObjectURL(await canvasToBlob(c, "image/jpeg", 0.9));
        if (alive) setSrcs((s) => ({ ...s, [def.key]: url }));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    socialStatusAction().then((r) => setCanPost(!!r?.ur?.token)).catch(() => {});
  }, []);

  async function postToSocial(key) {
    if (!window.confirm("یہ کارڈ ابھی فیس بک اور انسٹاگرام پر لائیو پوسٹ ہو جائے گا۔ جاری رکھیں؟")) return;
    setPosting(key);
    try {
      const page = CARD_PAGE[key];
      const link = `${links.site}/ur${page ? `/${page}` : ""}?utm_source=facebook&utm_medium=social&utm_campaign=daily`;
      const fd = new FormData();
      fd.set("slug", `daily-${key}`); fd.set("lang", "ur"); fd.set("fb", "1"); fd.set("ig", "1");
      fd.set("fbText", caption(key, "facebook", data)); fd.set("igText", caption(key, "instagram", data));
      fd.set("fbComment", `👇 مکمل تفصیل یہاں دیکھیں\n${link}`);
      fd.set("card", new File([await jpeg(key)], fname(key), { type: "image/jpeg" }));
      const r = await sendSocialAction(fd);
      if (r.error) say(r.error);
      else say(`فیس بک: ${r.fb?.error || "پوسٹ ہو گئی ✓"} — انسٹاگرام: ${r.ig?.error || "پوسٹ ہو گئی ✓"}`);
    } catch { say("پوسٹ نہیں ہو سکی، دوبارہ کوشش کریں"); }
    setPosting("");
  }

  const say = (t) => { setToast(t); setTimeout(() => setToast(""), 3500); };
  const jpeg = (key) => canvasToBlob(canvases.current[key], "image/jpeg", 0.95);
  const fname = (key) => `pak-dharti-${key}-${day}.jpg`;
  const file = async (key) => new File([await jpeg(key)], fname(key), { type: "image/jpeg" });

  async function shareFiles(files, text, { fallbackWa = false } = {}) {
    // The text is also copied, because Facebook and Instagram drop text that comes with a shared photo
    await copyText(text);
    try {
      if (navigator.canShare?.({ files })) { await navigator.share({ files, text }); return; }
    } catch { return; }
    for (const f of files) download(f, f.name);
    if (fallbackWa) window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    say("تصویر محفوظ ہو گئی اور تحریر کاپی ہو گئی");
  }

  async function shareFor(key, p) {
    setBusy(key);
    await shareFiles([await file(key)], caption(key, p, data));
    say("تحریر کاپی ہو گئی؛ پوسٹ میں پیسٹ کر دیں");
    setBusy("");
  }
  async function saveJpg(key) { setBusy(key); download(await jpeg(key), fname(key)); setBusy(""); }
  async function saveAllPdf() {
    setBusy("pdf");
    const cards = [];
    for (const def of defs) {
      const c = canvases.current[def.key];
      if (c) cards.push({ blob: await jpeg(def.key), w: c.width, h: c.height });
    }
    download(await jpegsToPdf(cards), `pak-dharti-daily-${day}.pdf`);
    setBusy("");
  }

  const ready = Object.keys(srcs).length === defs.length;
  const go = (d) => setView((v) => (v + d + defs.length) % defs.length);
  useEffect(() => {
    if (view < 0) return;
    const onKey = (e) => {
      if (e.key === "Escape") setView(-1);
      if (e.key === "ArrowLeft") go(1);      // Urdu reads right-to-left: left = next card
      if (e.key === "ArrowRight") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const cur = view >= 0 ? defs[view] : null;
  async function copyFor(key, p, msg) { const ok = await copyText(caption(key, p, data)); say(ok ? msg : "کاپی نہیں ہو سکی"); }
  return (
    <>
      <div className="daily-all">
        <button className="pa-btn pa-main" onClick={saveAllPdf} disabled={!ready || !!busy}>{busy === "pdf" ? "تیار ہو رہی ہے…" : "تمام کارڈ — ایک PDF"}</button>
        <button className="pa-btn pa-wa" onClick={async () => { await copyText(allCaption("whatsapp", data)); say("مشترکہ تحریر کاپی ہو گئی"); }}>تمام کارڈز کی مشترکہ تحریر کاپی</button>
      </div>
      {toast && <p className="daily-toast" role="status">{toast}</p>}
      <div className="daily-grid">
        {defs.map((def) => (
          <figure key={def.key} className="daily-card">
            <figcaption className="daily-name">{def.name}</figcaption>
            <div className="daily-img">
              {srcs[def.key] ? <button type="button" className="daily-open" onClick={() => setView(defs.indexOf(def))} aria-label={`${def.name} بڑا کر کے دیکھیں`}><img src={srcs[def.key]} alt={def.name} width="1440" height="1800" /></button> : <div className="daily-wait">تیار ہو رہا ہے…</div>}
            </div>
            <div className="daily-actions">
              <button className="pa-btn pa-main" onClick={() => saveJpg(def.key)} disabled={!srcs[def.key] || !!busy}>تصویر محفوظ کریں</button>
              <button className="pa-btn pa-wa" onClick={async () => { const ok = await copyText(caption(def.key, "whatsapp", data)); say(ok ? "تحریر کاپی ہو گئی — چینل میں تصویر کے ساتھ پیسٹ کریں" : "کاپی نہیں ہو سکی، نیچے سے کاپی کریں"); if (!ok) { setPlatform("whatsapp"); setOpen(def.key); } }}>تحریر کاپی کریں</button>
              <button className="pa-btn" onClick={() => setOpen(open === def.key ? null : def.key)}>{open === def.key ? "بند کریں" : "فیس بک / انسٹا تحریر"}</button>
              {canPost && <button className="pa-btn pa-main" onClick={() => postToSocial(def.key)} disabled={!srcs[def.key] || !!busy || !!posting}>{posting === def.key ? "پوسٹ ہو رہی ہے…" : "فیس بک + انسٹا پر پوسٹ"}</button>}
            </div>
            {open === def.key && (
              <div className="daily-text">
                <div className="dt-tabs" role="tablist">
                  {PLATFORMS.map((p) => (
                    <button key={p.key} role="tab" aria-selected={platform === p.key} className={platform === p.key ? "on" : ""} onClick={() => setPlatform(p.key)}>{p.name}</button>
                  ))}
                </div>
                <textarea readOnly rows={10} value={caption(def.key, platform, data)} dir="rtl" />
                <div className="daily-actions">
                  <button className="pa-btn pa-main" onClick={async () => { await copyText(caption(def.key, platform, data)); say("تحریر کاپی ہو گئی"); }}>تحریر کاپی کریں</button>
                  <button className="pa-btn" onClick={() => shareFor(def.key, platform)} disabled={!srcs[def.key] || !!busy}>تصویر + تحریر شیئر</button>
                </div>
              </div>
            )}
          </figure>
        ))}
      </div>
      {cur && (
        <div className="dv" role="dialog" aria-modal="true" aria-label={cur.name} onClick={(e) => { if (e.target === e.currentTarget) setView(-1); }}>
          <button className="dv-close" onClick={() => setView(-1)} aria-label="بند کریں">×</button>
          <button className="dv-nav dv-prev" onClick={() => go(-1)} aria-label="پچھلا کارڈ">›</button>
          <div className="dv-body">
            <div className="dv-img"
              onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}>
              {srcs[cur.key] ? <img src={srcs[cur.key]} alt={cur.name} /> : <div className="daily-wait">تیار ہو رہا ہے…</div>}
            </div>
            <aside className="dv-side">
              <h3>{cur.name}</h3>
              <p className="dv-count">{view + 1} / {defs.length}</p>
              <button className="pa-btn pa-main" onClick={() => saveJpg(cur.key)} disabled={!srcs[cur.key] || !!busy}>تصویر ڈاؤن لوڈ کریں</button>
              <button className="pa-btn pa-wa" onClick={() => copyFor(cur.key, "whatsapp", "واٹس ایپ تحریر کاپی ہو گئی")}>واٹس ایپ تحریر کاپی</button>
              <button className="pa-btn" onClick={() => copyFor(cur.key, "facebook", "فیس بک / انسٹا تحریر کاپی ہو گئی")}>فیس بک / انسٹا تحریر کاپی</button>
              <textarea readOnly rows={7} value={caption(cur.key, "whatsapp", data)} dir="rtl" />
              <p className="dv-hint">دائیں بائیں سوائپ کریں یا تیر دبائیں</p>
            </aside>
          </div>
          <button className="dv-nav dv-next" onClick={() => go(1)} aria-label="اگلا کارڈ">‹</button>
          {toast && <p className="daily-toast dv-toast" role="status">{toast}</p>}
        </div>
      )}
    </>
  );
}
