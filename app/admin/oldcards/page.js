import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Article } from "@/models";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earlier cards", robots: { index: false } };

/** Every card the site already made for a story (the ones that went to Facebook / Instagram), and the same story in the new look. */
export default async function OldCards({ searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin");
  const { n } = await searchParams;
  const limit = Math.min(300, Math.max(20, Number(n) || 60));
  freshDB(); await connectDB();
  const list = await Article.find({ status: "published", "social.ur.card": { $exists: true, $ne: null } })
    .sort({ publishedAt: -1 }).limit(limit).select("slug translations publishedAt social").lean();
  return (
    <main className="wrap" style={{ padding: "1rem 0" }}>
      <p><a className="btn secondary" href="/admin">← Mission Control</a></p>
      <h1>Earlier cards</h1>
      <p className="hint">The card that was posted for each story, newest first ({list.length} shown). &quot;Old card&quot; downloads exactly what was posted. &quot;New look (edit)&quot; opens the card editor, which draws the story in the current design (two people in panels) with a Download button.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: "1rem" }}>
        {list.map((a) => {
          const t = a.translations?.ur?.title || a.slug, id = String(a.social.ur.card);
          return (
            <div key={String(a._id)} style={{ border: "1px solid #e2dcda", borderRadius: 10, padding: ".5rem", display: "grid", gap: ".4rem" }}>
              <a href={`/api/media/${id}`} target="_blank" rel="noopener"><img src={`/api/media/${id}`} alt="" loading="lazy" style={{ width: "100%", borderRadius: 6 }} /></a>
              <div dir="rtl" lang="ur" style={{ fontSize: ".95rem", lineHeight: 1.7 }}>{t.slice(0, 90)}</div>
              <small>{a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : ""}</small>
              <span style={{ display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
                <a className="btn secondary" href={`/api/media/${id}`} download={`${a.slug}-old.jpg`}>Old card</a>
                <a className="btn publish" href={`/admin/preview/${a._id}?lang=ur`}>New look (edit)</a>
              </span>
            </div>
          );
        })}
      </div>
      {list.length >= limit && <p><a className="btn secondary" href={`?n=${limit + 60}`}>Show more</a></p>}
    </main>
  );
}
