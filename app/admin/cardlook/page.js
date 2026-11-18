import { redirect } from "next/navigation";
import AdminInstall from "../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article } from "@/models";
import { getCardLook } from "@/lib/cardLook";
import CardLookForm from "./CardLookForm";

export const dynamic = "force-dynamic";

export default async function CardLookPage() {
  if (!(await isLoggedIn())) redirect("/admin");
  await connectDB();
  const look = await getCardLook(true);
  const list = await Article.find({ status: "published", "visual.people.0": { $exists: true } }, { slug: 1, "translations.en.title": 1 })
    .sort({ publishedAt: -1 }).limit(15).lean();
  const stories = list.map((a) => ({ slug: a.slug, title: a.translations?.en?.title || a.slug }));
  return (
    <>
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall />
        <a className="btn secondary" href="/admin">Back</a>
      </div></div>
      <div className="wrap">
        <h2>Card look</h2>
        <p className="hint">How the people are drawn on the Facebook and Instagram cards. Change the sliders, the card redraws by itself after a moment, and press Save when it looks right. Saved settings are used by new cards within a minute.</p>
        <CardLookForm initial={look} stories={stories} />
      </div>
    </>
  );
}
