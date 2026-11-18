"use client";
import { useState } from "react";
import { setPhotoAction } from "./actions";

// Shrinks a photo in the browser (max 1600 px wide, JPEG) so uploads stay small and fast.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export default function PhotoChanger({ id, current }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(current);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (file && file.size > 0) form.set("file", await shrink(file));
    const r = await setPhotoAction(form);
    setBusy(false);
    if (r.error) setMsg(r.error);
    else { setMsg("Photo changed."); setPreview(r.url); setTimeout(() => location.reload(), 600); }
  }

  if (!open) return <button className="btn secondary" onClick={() => setOpen(true)}>Change photo</button>;
  return (
    <form className="panel photo-changer" onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      {preview && <img src={preview} alt="" style={{ maxHeight: 140, borderRadius: 6, marginBottom: ".75rem" }} />}
      <div className="row">
        <div className="field">
          <label htmlFor="pc-file">Upload your own photo</label>
          <input id="pc-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <div className="field">
          <label htmlFor="pc-link">…or paste a photo link</label>
          <input id="pc-link" name="link" type="url" placeholder="https://upload.wikimedia.org/…" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="pc-credit">Photo credit (required)</label>
        <input id="pc-credit" name="credit" required maxLength={120} placeholder="Pak Dharti TV · PID handout · PTI handout · Wikimedia Commons" />
        <small>Use your own photos, official handouts (PID, ISPR, party handouts) or freely licensed photos. Agency photos (AFP, Reuters, Getty) need a paid licence.</small>
      </div>
      {msg && <p className={msg.startsWith("Photo changed") ? "" : "error"} role="status">{msg}</p>}
      <button className="btn publish" disabled={busy}>{busy ? "Saving…" : "Save photo"}</button>{" "}
      <button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}
