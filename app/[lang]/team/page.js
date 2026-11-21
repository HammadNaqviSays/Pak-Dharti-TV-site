import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Article, LANGS } from "@/models";
import { SITE } from "@/lib/site";
import { getTeam, TEAM_GROUPS } from "@/lib/team";
import { writerSlug } from "@/lib/writerSlug";

export const revalidate = 600;
const absImg = (u) => (u ? (u.startsWith("http") ? u : `${SITE.url}${u}`) : undefined);

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  const ur = lang === "ur";
  return {
    title: ur ? "ہماری ٹیم" : "Our team",
    description: ur ? "پاک دھرتی ٹی وی کو چلانے والی انتظامیہ، نیوز روم اور لکھاری۔" : "The management, newsroom and writers behind Pak Dharti TV.",
    alternates: { canonical: `/${lang}/team`, languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}/team`])) },
  };
}

async function columnists() {
  await connectDB();
  const rows = await Article.find({ status: "published", "author.name": { $exists: true, $ne: "" } }, { author: 1, publishedAt: 1 }).sort({ publishedAt: -1 }).limit(300).lean();
  const seen = new Map();
  for (const r of rows) { const s = writerSlug(r.author.name); if (s && !seen.has(s)) seen.set(s, { slug: s, ...r.author }); }
  return [...seen.values()];
}

export default async function TeamPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const ur = lang === "ur";
  const [team, writers] = await Promise.all([getTeam(), columnists()]);
  const pick = (m, k) => (ur && m[`${k}Ur`]) || m[k] || "";
  const ld = {
    "@context": "https://schema.org", "@type": "AboutPage", name: ur ? "ہماری ٹیم" : "Our team", url: `${SITE.url}/${lang}/team`,
    mainEntity: { "@type": "NewsMediaOrganization", name: "Pak Dharti TV", url: SITE.url,
      member: team.map((m) => ({ "@type": "Person", name: m.name, ...(m.nameUr ? { alternateName: m.nameUr } : {}), ...(m.role ? { jobTitle: m.role } : {}),
        ...(m.photo ? { image: absImg(m.photo) } : {}), ...(m.bio ? { description: m.bio } : {}), sameAs: [m.fb, m.x, m.ig, m.web].filter(Boolean) })) },
  };
  const Links = ({ m }) => {
    const L = [[m.fb, "Facebook"], [m.x, "X"], [m.ig, "Instagram"], [m.web, ur ? "ویب سائٹ" : "Website"]].filter((x) => x[0]);
    return L.length ? <p className="tm-links">{L.map(([u, n]) => <a key={n} href={u} target="_blank" rel="noopener noreferrer me">{n}</a>)}</p> : null;
  };
  return (
    <div className="wrap info-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="page-title">{ur ? "ہماری ٹیم" : "Our team"}</h1>
      <p className="tm-intro" lang={ur ? "ur" : "en"} dir={ur ? "rtl" : "ltr"}>{ur ? "پاک دھرتی ٹی وی کو چلانے والے لوگ: انتظامیہ، نیوز روم اور ہمارے لکھاری۔" : "The people who run Pak Dharti TV: management, newsroom and our writers."}</p>
      {Object.keys(TEAM_GROUPS).map((g) => {
        const rows = team.filter((m) => m.group === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="tm-sec">
            <h2>{TEAM_GROUPS[g][ur ? "ur" : "en"]}</h2>
            <div className="tm-grid">
              {rows.map((m) => (
                <article key={m.id} className="tm-card" dir={ur ? "rtl" : "ltr"}>
                  {m.photo && <img src={m.photo} alt={pick(m, "name")} width="160" height="160" loading="lazy" />}
                  <h3>{pick(m, "name")}</h3>
                  {pick(m, "role") && <p className="tm-role">{pick(m, "role")}</p>}
                  {pick(m, "bio") && <p className="tm-bio">{pick(m, "bio")}</p>}
                  <Links m={m} />
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {writers.length > 0 && (
        <section className="tm-sec">
          <h2>{ur ? "کالم نگار اور لکھاری" : "Columnists and writers"}</h2>
          <div className="tm-grid">
            {writers.map((w) => (
              <article key={w.slug} className="tm-card" dir={ur ? "rtl" : "ltr"}>
                {w.photo && <img src={w.photo} alt={(ur && w.nameUr) || w.name} width="160" height="160" loading="lazy" />}
                <h3><a href={`/${lang}/writers/${w.slug}`}>{(ur && w.nameUr) || w.name}</a></h3>
                {((ur && w.roleUr) || w.role) && <p className="tm-role">{(ur && w.roleUr) || w.role}</p>}
                <p className="tm-links"><a href={`/${lang}/writers/${w.slug}`}>{ur ? "تحریریں پڑھیں" : "Read their columns"}</a></p>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="tm-join" dir={ur ? "rtl" : "ltr"}>
        <h2>{ur ? "ہمارے ساتھ شامل ہوں" : "Join our team"}</h2>
        <p>{ur ? "پاک دھرتی ٹی وی بڑھ رہا ہے۔ اگر آپ لکھنا، رپورٹنگ، ویڈیو یا ڈیزائن کا شوق رکھتے ہیں تو ہمیں اپنا تعارف بھیجیں۔" : "Pak Dharti TV is growing. If you love writing, reporting, video or design, send us a short introduction."}</p>
        <ul>{(ur ? ["رپورٹر اور نیوز روم ڈیسک", "کالم نگار اور بلاگر", "ویڈیو ایڈیٹر", "گرافک ڈیزائنر", "سوشل میڈیا ایڈیٹر"] : ["Reporters and newsroom desk", "Columnists and bloggers", "Video editors", "Graphic designers", "Social media editors"]).map((r) => <li key={r}>{r}</li>)}</ul>
        <a className="tm-btn" href={`/${lang}/contact`}>{ur ? "درخواست بھیجیں" : "Apply now"}</a>
      </section>
    </div>
  );
}
