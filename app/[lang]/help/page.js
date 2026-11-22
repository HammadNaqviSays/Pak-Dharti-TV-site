import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Article, LANGS } from "@/models";
import { GUIDE, CHECKED } from "@/lib/guideData";
import { SITE } from "@/lib/site";

export const revalidate = 600;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  const ur = lang === "ur";
  return {
    title: ur ? "مفید معلومات: ہیلپ لائن نمبر اور حقوق" : "Useful information: helplines and your rights",
    description: ur ? "پولیس، ہراسانی، سائبر کرائم، نادرا اور ایمرجنسی کے سرکاری ہیلپ لائن نمبر، سرکاری ذرائع کے ساتھ۔" : "Official helpline numbers for police, harassment, cybercrime, NADRA and emergencies, with their sources.",
    alternates: { canonical: `/${lang}/help`, languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}/help`])) },
  };
}

export default async function HelpPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const ur = lang === "ur";
  let slugs = {};
  try {
    await connectDB();
    const rows = await Article.find({ status: "published", tags: { $in: GUIDE.map((g) => `guide:${g.key}`) } }).select("slug tags").lean();
    for (const r of rows) slugs[(r.tags.find((t) => t.startsWith("guide:")) || "").slice(6)] = r.slug;
  } catch {}
  const l = ur ? "ur" : "en";
  return (
    <div className="wrap info-page" dir={ur ? "rtl" : "ltr"} lang={l}>
      <h1 className="page-title">{ur ? "مفید معلومات" : "Useful information"}</h1>
      <p className="tm-intro">{ur ? `ہیلپ لائن نمبر اور سرکاری سہولتیں، صرف سرکاری ذرائع سے۔ آخری بار تصدیق: ${CHECKED}۔` : `Helpline numbers and public services, taken only from official sources. Last checked: ${CHECKED}.`}</p>
      {GUIDE.map((g) => (
        <section key={g.key} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "1rem", margin: "1rem 0", background: "#fff" }}>
          <h2 style={{ marginTop: 0 }}>{slugs[g.key] ? <a href={`/${lang}/news/${slugs[g.key]}`}>{g[l].title}</a> : g[l].title}</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {g.rows.map((r) => (
              <li key={r.n} style={{ display: "flex", gap: ".8rem", alignItems: "baseline", padding: ".35rem 0", borderTop: "1px solid #eee" }}>
                <a href={`tel:${r.n}`} style={{ fontWeight: 800, fontSize: "1.5rem", color: "#9b0016", minWidth: "4.5rem", direction: "ltr", textDecoration: "none" }}>{r.n}</a>
                <span>{r[l]}</span>
              </li>
            ))}
          </ul>
          {g.note && <p style={{ margin: ".5rem 0 0", color: "#555" }}>{g.note[l]}</p>}
          <p style={{ margin: ".6rem 0 0", fontSize: ".85rem" }}>{ur ? "ماخذ: " : "Sources: "}{g.sources.map(([n, u], i) => <span key={u}>{i ? " · " : ""}<a href={u} target="_blank" rel="noopener noreferrer">{n}</a></span>)}</p>
        </section>
      ))}
      <p className="hint">{ur ? "اگر کوئی نمبر بدل گیا ہو تو ہمیں بتائیں، ہم فوراً درست کریں گے۔" : "If a number has changed, tell us and we will correct it straight away."}</p>
    </div>
  );
}
