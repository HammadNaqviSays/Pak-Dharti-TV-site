"use client";
import { useState } from "react";
import { moveCutoutsAction, reclaimCutoutDiskAction } from "../peopleSpace";

/** Moves the cut-out pictures out of the database into Blob storage, in small steps. */
export default function MoveCutouts() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setMsg("Starting…");
    let total = 0;
    try {
      for (let i = 0; i < 400; i++) {
        const r = await moveCutoutsAction(30);
        if (r.error && !r.moved) { setMsg(r.error); setBusy(false); return; }
        total += r.moved || 0;
        setMsg(`Moved ${total}… ${r.left} left`);
        if (r.error) { setMsg(`${r.error} (moved ${total}, ${r.left} left)`); setBusy(false); return; }
        if (!r.left) { setMsg(`Done ✓ moved ${total} cut-outs. Reload the page.`); setBusy(false); return; }
      }
    } catch { setMsg(`Stopped (moved ${total}). Press the button again to continue.`); }
    setBusy(false);
  }
  async function reclaim() {
    if (!window.confirm("Give the empty disk space back to the database? Cut-out pictures may flash as missing for a few seconds.")) return;
    setBusy(true); setMsg("Working…");
    try { const r = await reclaimCutoutDiskAction(); setMsg(r.error || `Done ✓ ${r.count} records kept. Check Atlas in a few minutes.`); }
    catch { setMsg("Could not finish, tell Claude."); }
    setBusy(false);
  }
  return (
    <div className="cm-actions" style={{ margin: ".6rem 0" }}>
      <button className="btn secondary" disabled={busy} onClick={run}>Move cut-outs out of the database (to Blob storage)</button>
      <button className="btn secondary" disabled={busy} onClick={reclaim}>Give the empty disk space back</button>
      {msg && <span className="hint">{msg}</span>}
    </div>
  );
}
