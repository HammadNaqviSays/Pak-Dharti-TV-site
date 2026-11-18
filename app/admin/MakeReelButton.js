"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { startReelAction } from "./reelsAction";
import { BusyOverlay } from "./Busy";

/** Writes the reel script for a story, then opens the reel in a NEW tab so the page here stays free for the next story. */
export default function MakeReelButton({ slug, label = "Make reel", className = "btn secondary" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  const go = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    let w = null;
    try { w = window.open("", "_blank"); } catch {}
    const r = await startReelAction(slug);
    setBusy(false);
    if (r?.id) {
      if (w) w.location.href = `/admin/reels/${r.id}`; else window.location.href = `/admin/reels/${r.id}`;
      router.refresh();
    } else {
      if (w) w.close();
      setErr(r?.error || "Failed, try again");
    }
  };
  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={go}>{busy ? "Please wait…" : label}</button>
      {err && <small style={{ color: "#a00" }}> {err}</small>}
      <BusyOverlay show={busy} text="Writing the reel script. Please wait — the reel will open in a new tab." />
    </>
  );
}
