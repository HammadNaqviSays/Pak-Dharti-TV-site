"use client";
import { useActionState } from "react";
import { addPersonAction } from "../actions";

/** Add someone who is not in the library yet (e.g. a TV anchor), then upload their photo in their row. */
export default function AddPerson({ initialName = "" }) {
  const [st, act, busy] = useActionState(addPersonAction, null);
  return (
    <details className="sc-pick" open={!!initialName}>
      <summary><strong>Add a person who is not in the library</strong></summary>
      <form action={act} className="cm-row" style={{ alignItems: "end", flexWrap: "wrap" }}>
        <label>Name (English)<input name="name" defaultValue={initialName} required placeholder="Muneeb Farooq" /></label>
        <label>Name (Urdu)<input name="nameUr" dir="rtl" className="cm-ur" placeholder="منیب فاروق" /></label>
        <label>Role (Urdu)<input name="roleUr" dir="rtl" className="cm-ur" placeholder="سینئر صحافی" /></label>
        <label>Group
          <select name="group" defaultValue="public">
            <option value="public">Journalists & public figures</option><option value="pti">PTI</option><option value="federal">Leaders</option>
            <option value="judiciary">Judiciary & lawyers</option><option value="military">Military</option><option value="international">International</option>
          </select>
        </label>
        <button className="btn publish" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
      </form>
      {st?.error && <p className="hint" style={{ color: "#8a0000" }}>{st.error}</p>}
      {st?.ok && <p className="hint">{st.existed ? `${st.name} is already in the library.` : `${st.name} added.`} <a href={`/admin/people?q=${encodeURIComponent(st.name)}`}>Open and upload a photo →</a></p>}
    </details>
  );
}
