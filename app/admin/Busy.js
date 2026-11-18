"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** A popup with a running timer: shown while something slow is being done, so it is clear the button was pressed. */
export function BusyOverlay({ show, text }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!show) { setS(0); return; }
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [show]);
  if (!show) return null;
  return (
    <div role="status" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9999, display: "grid", placeItems: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", color: "#222", borderRadius: 14, padding: "1.4rem 1.6rem", maxWidth: 340, textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>
        <div style={{ fontSize: "2rem" }}>⏳</div>
        <strong style={{ display: "block", margin: ".3rem 0" }}>{text || "Please wait, doing it…"}</strong>
        <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#7a1020" }}>{s}s</div>
        <small>Your button has been pressed. Do not press again.</small>
      </div>
    </div>
  );
}

/** Submit button for a <form action={serverAction}>: shows the popup and stays disabled until the action finishes. */
export function BusyButton({ children, className = "btn secondary", text }) {
  const { pending } = useFormStatus();
  return (<><button className={className} disabled={pending}>{children}</button><BusyOverlay show={pending} text={text} /></>);
}
