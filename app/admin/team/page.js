import { redirect } from "next/navigation";
import AdminInstall from "../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import { getTeam, TEAM_GROUPS } from "@/lib/team";
import { saveMemberAction, deleteMemberAction } from "../teamAction";
import { BusyButton, ToastHost } from "../Busy";

export const dynamic = "force-dynamic";

function Form({ m }) {
  const v = m || { group: "newsroom", order: 100, active: true };
  const inp = { style: { width: "100%", padding: ".4rem" } };
  return (
    <form action={saveMemberAction} style={{ display: "grid", gap: ".5rem", margin: ".6rem 0" }}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <input name="name" defaultValue={v.name || ""} placeholder="Name (English) *" required {...inp} />
      <input name="nameUr" defaultValue={v.nameUr || ""} placeholder="نام (اردو)" dir="rtl" {...inp} />
      <input name="role" defaultValue={v.role || ""} placeholder="Role (English), e.g. Chief Editor" {...inp} />
      <input name="roleUr" defaultValue={v.roleUr || ""} placeholder="ذمہ داری (اردو)" dir="rtl" {...inp} />
      <textarea name="bio" defaultValue={v.bio || ""} placeholder="Short bio (English)" rows={3} {...inp} />
      <textarea name="bioUr" defaultValue={v.bioUr || ""} placeholder="مختصر تعارف (اردو)" dir="rtl" rows={3} {...inp} />
      <input name="photo" defaultValue={v.photo || ""} placeholder="Photo link (https://… or /brand/host.jpg)" {...inp} />
      <input name="fb" defaultValue={v.fb || ""} placeholder="Facebook link" {...inp} />
      <input name="x" defaultValue={v.x || ""} placeholder="X link" {...inp} />
      <input name="ig" defaultValue={v.ig || ""} placeholder="Instagram link" {...inp} />
      <input name="web" defaultValue={v.web || ""} placeholder="Website link" {...inp} />
      <div>Group: <select name="group" defaultValue={v.group}>{Object.entries(TEAM_GROUPS).map(([k, g]) => <option key={k} value={k}>{g.en}</option>)}</select>
        {" "}Order: <input type="number" name="order" defaultValue={v.order} style={{ width: 70 }} />
        {" "}<label><input type="checkbox" name="active" defaultChecked={v.active !== false} /> Show on the site</label></div>
      <div><BusyButton className="btn publish" text="Saving…" done="✅ Save ho gaya">{m ? "Save" : "Add to team"}</BusyButton></div>
    </form>
  );
}

export default async function TeamAdmin() {
  if (!(await isLoggedIn())) redirect("/admin");
  const list = await getTeam({ all: true });
  return (
    <>
      <ToastHost />
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall /><a className="btn secondary" href="/admin">Back</a>
      </div></div>
      <div className="wrap">
        <h2>Team</h2>
        <p className="hint">People shown on the public page <a href="/ur/team" target="_blank" rel="noopener">/ur/team</a> (and /en/team). Columnists appear there by themselves from their published columns; here you add management, newsroom and other people. Lower “Order” comes first.</p>
        {list.map((m) => (
          <details key={m.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: ".6rem 1rem", margin: ".6rem 0" }}>
            <summary><strong>{m.name}</strong> · {m.role || "—"} · {TEAM_GROUPS[m.group].en}{m.active ? "" : " · hidden"}</summary>
            <Form m={m} />
            <form action={deleteMemberAction}><input type="hidden" name="id" value={m.id} /><BusyButton className="btn secondary" text="Deleting…" done="✅ Delete ho gaya">Delete this person</BusyButton></form>
          </details>
        ))}
        <h3>Add a person</h3>
        <Form />
      </div>
    </>
  );
}
