import { redirect } from "next/navigation";
import AdminInstall from "../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Person, PersonCutout, Setting } from "@/models";
import PersonRow from "./PersonRow";
import AddPerson from "./AddPerson";
import MoveCutouts from "./MoveCutouts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GROUPS = { pti: "PTI", federal: "Leaders", military: "Military", police: "Police", judiciary: "Judiciary & lawyers", mna: "MNAs",
  senator: "Senators", "mpa-punjab": "Punjab MPAs", "mpa-kp": "KP MPAs", "mpa-sindh": "Sindh MPAs", "mpa-balochistan": "Balochistan MPAs",
  historical: "Historical", sports: "Sports", public: "Public figures", international: "International", news: "From the news" };

export default async function PeoplePage({ searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin");
  const { q = "", g = "", nophoto = "", add = "" } = await searchParams;
  await connectDB();
  const filter = {};
  if (g) filter.groups = g;
  if (nophoto) filter["photos.0"] = { $exists: false };
  if (q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { nameUr: rx }, { aliases: rx }, { constituency: rx }];
  }
  const [list, total, withPhoto, cutouts, byGroup, scenes] = await Promise.all([
    Person.find(filter).sort({ priority: -1, mentions: -1, name: 1 }).limit(60).lean(),
    Person.countDocuments(), Person.countDocuments({ "photos.0": { $exists: true } }), PersonCutout.countDocuments(),
    Person.aggregate([{ $unwind: "$groups" }, { $group: { _id: "$groups", n: { $sum: 1 }, photo: { $sum: { $cond: [{ $gt: [{ $size: "$photos" }, 0] }, 1, 0] } } } }]),
    Setting.findOne({ key: "scenes" }).lean(),
  ]);
  const gmap = Object.fromEntries(byGroup.map((x) => [x._id, x]));
  const people = list.map((p) => ({
    id: String(p._id), name: p.name, nameUr: p.nameUr || "", roleUr: p.roleUr || "", party: p.party || "", constituency: p.constituency || "",
    groups: p.groups || [], mentions: p.mentions || 0, wiki: p.wiki || "",
    photos: (p.photos || []).slice(0, 8).map((ph) => ({ url: ph.thumb || ph.url, credit: ph.credit, license: ph.license, cutout: ph.cutout ? `/api/people/cutout/${ph.cutout}` : "" })),
  }));
  return (
    <>
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall />
        <a className="btn secondary" href="/admin">Back</a>
      </div></div>
      <div className="wrap">
        <h2>People library</h2>
        <div className="kpis">
          <div className="kpi"><span>People</span><strong>{total}</strong></div>
          <div className="kpi"><span>With a free photo</span><strong>{withPhoto}</strong></div>
          <div className="kpi"><span>Cut-outs</span><strong>{cutouts}</strong></div>
          <div className="kpi"><span>Place photos</span><strong>{Object.keys(scenes?.value || {}).length}</strong></div>
        </div>
        <MoveCutouts />
        <p className="hint">Built automatically every night from Wikipedia and Wikimedia Commons (only freely licensed photos, with credit). Names that appear in our news are added the next night. For someone without a photo, upload an official handout (PID, ISPR, DGPR, party media cell) below.</p>
        <div className="cm-flags" style={{ margin: ".8rem 0" }}>
          <a className={`btn ${!g ? "publish" : "secondary"}`} href="/admin/people">All</a>
          {Object.entries(GROUPS).filter(([k]) => gmap[k]).map(([k, v]) => (
            <a key={k} className={`btn ${g === k ? "publish" : "secondary"}`} href={`/admin/people?g=${k}`}>{v} ({gmap[k].photo}/{gmap[k].n})</a>
          ))}
        </div>
        <AddPerson initialName={add} />
        <form className="cm-row" style={{ alignItems: "end" }}>
          <label style={{ flex: 1 }}>Search (English or Urdu name, constituency)<input name="q" defaultValue={q} /></label>
          {g && <input type="hidden" name="g" value={g} />}
          <label className="cm-inline"><input type="checkbox" name="nophoto" value="1" defaultChecked={!!nophoto} /> Only without photo</label>
          <button className="btn publish">Search</button>
        </form>
        <div className="people-list">
          {people.map((p) => <PersonRow key={p.id} p={p} />)}
          {!people.length && <p className="muted">Nobody found. The library fills up after the first nightly run.</p>}
        </div>
      </div>
    </>
  );
}
