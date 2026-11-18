"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { classifySource } from "@/lib/traffic";

// Counts one page view per page opened and, once per browser session, where the visit came from.
// No cookies, no IDs and no IP address are stored: only anonymous counters (see /api/hit).
export default function Analytics() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith("/admin")) return;
    try {
      if (navigator.webdriver) return;
      let src = "direct", rh = "", first = false;
      try {
        const saved = sessionStorage.getItem("pd_src");
        if (saved) { src = saved; rh = sessionStorage.getItem("pd_rh") || ""; }
        else {
          first = true;
          const c = classifySource({ ref: document.referrer, search: location.search, ua: navigator.userAgent, selfHost: location.hostname });
          src = c.src; rh = c.host;
          sessionStorage.setItem("pd_src", src); sessionStorage.setItem("pd_rh", rh);
        }
      } catch { /* storage blocked: count the view, not the visit */ }
      const app = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
      fetch("/api/hit", {
        method: "POST", keepalive: true, headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, src, rh, first, app }),
      }).catch(() => {});
    } catch {}
  }, [path]);
  return null;
}
