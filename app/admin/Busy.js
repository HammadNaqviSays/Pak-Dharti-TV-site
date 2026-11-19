"use client";
import { useEffect, useRef, useState } from "react";
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

const fire = (msg) => { try { window.dispatchEvent(new CustomEvent("admin-toast", { detail: msg })); } catch {} };

/** A green message at the bottom of the screen that stays for 8 seconds: proof that the button did its job (put ONE <ToastHost/> on the page). */
export function ToastHost() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let t;
    const on = (e) => { setMsg(String(e.detail || "Done")); clearTimeout(t); t = setTimeout(() => setMsg(""), 8000); };
    window.addEventListener("admin-toast", on);
    return () => { window.removeEventListener("admin-toast", on); clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return (
    <div role="status" onClick={() => setMsg("")} style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 10000, background: "#0b6b2c", color: "#fff", padding: ".9rem 1.3rem", borderRadius: 12, fontWeight: 700, fontSize: "1.05rem", boxShadow: "0 8px 30px rgba(0,0,0,.4)", maxWidth: "92vw", textAlign: "center", cursor: "pointer" }}>
      {msg}
    </div>
  );
}

/** Submit button for a <form action={serverAction}>: shows the popup, stays disabled until the action finishes, then shows a green "done" message
 *  (even when the button itself disappears because the item moved to another state). */
export function BusyButton({ children, className = "btn secondary", text, done = "✅ Ho gaya" }) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    if (pending) was.current = true;
    else if (was.current) { was.current = false; fire(done); }
  }, [pending, done]);
  useEffect(() => () => { if (was.current) fire(done); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return (<><button className={className} disabled={pending}>{children}</button><BusyOverlay show={pending} text={text} /></>);
}
