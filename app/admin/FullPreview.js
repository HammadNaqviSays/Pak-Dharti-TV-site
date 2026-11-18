"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** A full-screen look at a picture or a video. One click anywhere (or Esc, or the Close button) leaves it. */
export default function FullPreview({ onClose, children, note = "" }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!ready) return null;
  // drawn directly in <body>, so no bar or sticky box of the page can sit above it
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(0,0,0,.92)", display: "grid", placeItems: "center", padding: ".5rem", cursor: "zoom-out" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: ".4rem", justifyItems: "center", cursor: "default", maxWidth: "100%", maxHeight: "100%" }}>
        {children}
        <span style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
          <button type="button" className="btn publish" onClick={onClose}>✕ Close</button>
          <small style={{ color: "#fff" }}>{note || "Click anywhere outside, or press Esc, to go back."}</small>
        </span>
      </div>
    </div>,
    document.body
  );
}
