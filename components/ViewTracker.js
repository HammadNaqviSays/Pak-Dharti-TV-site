"use client";
import { useEffect } from "react";

// Counts one view per article per browser session.
export default function ViewTracker({ slug, lang }) {
  useEffect(() => {
    const key = `pd_seen_${slug}_${lang}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch {}
    fetch("/api/track", {
      method: "POST", keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, lang }),
    }).catch(() => {});
  }, [slug, lang]);
  return null;
}
