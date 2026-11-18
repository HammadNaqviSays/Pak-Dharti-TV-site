"use client";
import { useEffect, useState } from "react";

/** "Install app" button next to the Mission Control name. Uses the browser's install prompt when it offers one,
 *  otherwise explains the two taps (Chrome menu / iPhone Share). Hidden inside the installed app. */
export default function AdminInstall() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || !!window.navigator.standalone);
    const on = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (installed) return null;
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  async function click() {
    if (prompt) { prompt.prompt(); try { await prompt.userChoice; } catch {} setPrompt(null); return; }
    setHelp(!help);
  }
  return (
    <span className="admin-install-wrap">
      <button type="button" className="btn admin-install" onClick={click}>⬇ Install app</button>
      {help && (
        <span className="admin-install-help" role="note">
          {ios ? "Safari: tap Share (⬆︎), then “Add to Home Screen”." : "If this page opened inside another app (WhatsApp, Facebook…), first tap ⋮ → “Open in Chrome”. Then in Chrome: ⋮ → “Install app” / “Add to Home screen”. It installs as “Mission Control”."}
        </span>
      )}
    </span>
  );
}
