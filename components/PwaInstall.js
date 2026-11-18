"use client";
import { useEffect, useState } from "react";

const KEY = "pd-install-dismissed";
const TEXT = {
  ur: { title: "پاک دھرتی ٹی وی ایپ", body: "فون پر ایپ کی طرح انسٹال کریں — تیز، اور آف لائن بھی", install: "انسٹال کریں", ios: "نیچے Share (⬆︎) دبائیں، پھر “Add to Home Screen”", close: "بند کریں" },
  en: { title: "Pak Dharti TV app", body: "Install it like an app — faster, and works offline", install: "Install", ios: "Tap Share (⬆︎), then “Add to Home Screen”", close: "Close" },
};

/** Registers the service worker and offers "install the app" once (Android / desktop prompt, iPhone hint). */
export default function PwaInstall({ lang = "ur" }) {
  const [prompt, setPrompt] = useState(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const t = TEXT[lang] || TEXT.en;

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    let dismissed = false;
    try { dismissed = Number(localStorage.getItem(KEY) || 0) > Date.now() - 14 * 86400e3; } catch {}
    if (standalone || dismissed) return;
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); setShow(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (isIos) { setIos(true); const id = setTimeout(() => setShow(true), 4000); return () => { clearTimeout(id); window.removeEventListener("beforeinstallprompt", onPrompt); }; }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch {} };
  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    try { await prompt.userChoice; } catch {}
    setPrompt(null); close();
  };

  if (!show) return null;
  return (
    <div className="pwa-bar" role="dialog" aria-label={t.title} dir={lang === "ur" ? "rtl" : "ltr"}>
      <img src="/brand/icon-192.png" alt="" width="44" height="44" />
      <div className="pwa-text"><strong>{t.title}</strong><span>{ios ? t.ios : t.body}</span></div>
      {!ios && <button className="pwa-install" onClick={install}>{t.install}</button>}
      <button className="pwa-close" onClick={close} aria-label={t.close}>×</button>
    </div>
  );
}
