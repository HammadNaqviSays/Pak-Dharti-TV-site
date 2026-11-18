"use client";
import { useState } from "react";
import { findPhotosAction } from "./actions";

/** Fills in real photos for stories that only show a category banner, a few at a time. */
export default function FindPhotos({ missing }) {
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(missing);

  async function run() {
    setBusy(true); setLog([]);
    let total = 0;
    for (let round = 0; round < 8; round++) {   // about 24 stories per click (Unsplash allows 50 searches an hour)
      let r;
      try { r = await findPhotosAction(); } catch { r = { error: "Network error, try again." }; }
      if (r?.error) { setLog((l) => [...l, r.error]); break; }
      total += r.found;
      setLeft(r.left);
      setLog((l) => [...l, `Checked ${r.checked}, found ${r.found} photo(s). ${r.left} still without a photo.`]);
      if (!r.checked || !r.left) break;
    }
    setLog((l) => [...l, `Done: ${total} new photo(s).`]);
    setBusy(false);
  }

  return (
    <div className="find-photos">
      <p><strong>{left}</strong> stories have no news photo (only the section banner).</p>
      <button className="btn publish" onClick={run} disabled={busy || !left}>{busy ? "Searching…" : "Find photos for them"}</button>
      <p className="hint">Looks on Wikimedia Commons (people) and Unsplash, with credit. Stories where nothing fits keep the banner; give those a photo with "Change photo". Unsplash allows about 50 searches an hour, so run it again later if it stops.</p>
      {log.length > 0 && <ul className="ap-log">{log.map((x, i) => <li key={i}>{x}</li>)}</ul>}
    </div>
  );
}
