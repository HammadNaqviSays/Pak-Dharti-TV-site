"use client";
import { useEffect, useRef } from "react";

// Google AdSense. Nothing is shown until NEXT_PUBLIC_ADSENSE_CLIENT (ca-pub-…) is set in Vercel,
// and each slot needs its own ad-unit id from the AdSense dashboard.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

const SLOTS = {
  header: process.env.NEXT_PUBLIC_AD_SLOT_HEADER || "",
  sidebar: process.env.NEXT_PUBLIC_AD_SLOT_SIDEBAR || "",
  inArticle: process.env.NEXT_PUBLIC_AD_SLOT_ARTICLE || "",
};

export default function AdSlot({ name, className = "" }) {
  const ref = useRef(null);
  const slot = SLOTS[name];

  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot || !ref.current || ref.current.dataset.loaded) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      ref.current.dataset.loaded = "1";
    } catch {}
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) return null;
  return (
    <div className={`ad ad-${name} ${className}`}>
      <ins ref={ref} className="adsbygoogle" style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT} data-ad-slot={slot}
        data-ad-format={name === "header" ? "horizontal" : "auto"} data-full-width-responsive="true" />
    </div>
  );
}
