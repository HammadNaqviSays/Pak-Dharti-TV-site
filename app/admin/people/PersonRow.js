"use client";
import { useActionState } from "react";
import { addPersonPhotoAction, updatePersonAction } from "../actions";

export default function PersonRow({ p }) {
  const [upd, updAction, updPending] = useActionState(updatePersonAction, null);
  const [ph, phAction, phPending] = useActionState(addPersonPhotoAction, null);
  return (
    <div className="person">
      <div className="person-photos">
        {p.photos.length ? p.photos.map((x, i) => (
          <figure key={i} title={`${x.credit || ""} ${x.license ? `(${x.license})` : ""}`}>
            <img src={x.cutout || x.url} alt="" loading="lazy" className={x.cutout ? "cut" : ""} />
            {x.cutout && <figcaption>cut-out</figcaption>}
          </figure>
        )) : <div className="person-none">No free photo yet</div>}
      </div>
      <div className="person-info">
        <strong>{p.name}</strong> {p.wiki && <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki)}`} target="_blank" rel="noopener noreferrer">wiki</a>}
        <div className="meta">{[p.party, p.constituency, p.groups.join(", "), p.mentions ? `${p.mentions} stories` : ""].filter(Boolean).join(" · ")}</div>
        <form action={updAction} className="cm-row">
          <input type="hidden" name="id" value={p.id} />
          <label>Urdu name<input name="nameUr" defaultValue={p.nameUr} dir="rtl" className="cm-ur" /></label>
          <label>Urdu role<input name="roleUr" defaultValue={p.roleUr} dir="rtl" className="cm-ur" /></label>
          <button className="btn secondary" disabled={updPending}>{upd?.ok ? "Saved" : "Save"}</button>
        </form>
        <details>
          <summary>Add a handout photo</summary>
          <form action={phAction} className="cm-row">
            <input type="hidden" name="id" value={p.id} />
            <label>File<input type="file" name="file" accept="image/jpeg,image/png,image/webp" /></label>
            <label>…or link<input name="link" placeholder="https://..." /></label>
            <label>Source<input name="credit" placeholder="PID handout" /></label>
            <button className="btn publish" disabled={phPending}>{phPending ? "Uploading…" : "Add"}</button>
          </form>
          {ph?.error && <p className="hint" style={{ color: "#8a0000" }}>{ph.error}</p>}
          {ph?.ok && <p className="hint">Added. It is now this person's main photo (cut-out is made in the nightly run).</p>}
        </details>
      </div>
    </div>
  );
}
