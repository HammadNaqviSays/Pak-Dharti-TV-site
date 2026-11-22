import { redirect } from "next/navigation";
import AdminInstall from "../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Article } from "@/models";
import { GUIDE, CHECKED } from "@/lib/guideData";
import InfoRow from "./InfoRow";

export const dynamic = "force-dynamic";

export default async function InfoPage() {
  if (!(await isLoggedIn())) redirect("/admin");
  freshDB(); await connectDB();
  const have = await Article.find({ tags: { $in: GUIDE.map((g) => `guide:${g.key}`) } }).select("_id slug tags status").lean();
  const byKey = Object.fromEntries(have.map((a) => [(a.tags.find((t) => t.startsWith("guide:")) || "").slice(6), { id: String(a._id), slug: a.slug, status: a.status }]));
  return (
    <>
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall />
        <a className="btn secondary" href="/admin">Back</a>
      </div></div>
      <div className="wrap" style={{ paddingBottom: "3rem" }}>
        <h1>Useful information for the public</h1>
        <p className="hint">Helplines, rights and government services. Every number here was read on an official page (last checked {CHECKED}); the sources are printed under each story. Publish it on the site, then make the Pak Dharti cards and the video from its preview page.</p>
        {GUIDE.map((g) => <InfoRow key={g.key} g={g} done={byKey[g.key] || null} />)}
      </div>
    </>
  );
}
