import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getTicker, getMostRead, pickText } from "@/lib/queries";
import { Ticker, Sidebar } from "@/components/SiteChrome";
import { DICT } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { getWriter } from "@/lib/writers";
import WriterLinks, { writerLinks } from "@/components/WriterLinks";

export const revalidate = 300;
const absImg = (u) => (u ? (u.startsWith("http") ? u : `${SITE.url}${u}`) : undefined);

export async function generateMetadata({ params }) {
  const { lang, slug } = await params;
  if (!DICT[lang]) return {};
  const w = await getWriter(slug);
  if (!w) return {};
  const ur = lang === "ur", au = w.author;
  const name = ur && au.nameUr ? au.nameUr : au.name;
  const bio = (ur && au.bioUr) || au.bio || "";
  return {
    title: ur ? `${name} کی تحریریں` : `${name} — columns and articles`,
    description: bio.slice(0, 155),
    alternates: { canonical: `/${lang}/writers/${slug}`, languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}/writers/${slug}`])) },
  };
}

export default async function WriterPage({ params }) {
  const { lang, slug } = await params;
  if (!LANGS.includes(lang)) notFound();
  const w = await getWriter(slug);
  if (!w) notFound();
  const [ticker, mostRead] = await Promise.all([getTicker(), getMostRead()]);
  const ur = lang === "ur", t = DICT[lang], au = w.author;
  const name = ur && au.nameUr ? au.nameUr : au.name;
  const role = ur && au.roleUr ? au.roleUr : au.role;
  const bio = (ur && au.bioUr) || au.bio;
  const ld = {
    "@context": "https://schema.org", "@type": "ProfilePage",
    mainEntity: { "@type": "Person", name: au.name, ...(au.nameUr ? { alternateName: au.nameUr } : {}), ...(role ? { jobTitle: au.role } : {}),
      ...(au.bio ? { description: au.bio } : {}), ...(au.photo ? { image: absImg(au.photo) } : {}), ...(writerLinks(au).length ? { sameAs: writerLinks(au).map((x) => x.url) } : {}),
      url: `${SITE.url}/${lang}/writers/${slug}` },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Ticker lang={lang} items={ticker} />
      <div className="wrap with-sidebar">
        <div className="main-col">
          <section className="wp-hero">
            {au.photo && <img className="wp-photo" src={au.photo} alt={name} width="240" height="255" />}
            <div>
              <p className="colx-kicker">{ur ? "لکھاری" : "Writer"}</p>
              <h1 className="wp-name">{name}</h1>
              {role && <p className="wp-role">{role}</p>}
              {bio && <p className="wp-bio">{bio}</p>}
              {writerLinks(au).length > 0 && (
                <div className="wp-connect">
                  <p className="wp-connect-label">{ur ? "لکھاری کے ساتھ جڑیں" : "Connect with the writer"}</p>
                  <WriterLinks au={au} ur={ur} />
                  {au.photoCredit && <small className="wp-credit">{ur ? "تصویر" : "Photo"}: {ur && au.photoCredit === "Courtesy of the writer" ? "بشکریہ لکھاری" : au.photoCredit}</small>}
                </div>
              )}
            </div>
          </section>
          <h2 className="wp-sub">{ur ? `${name} کی تحریریں` : `Columns by ${name}`}</h2>
          <div className="colx-grid">
            {w.items.map((a) => {
              const x = pickText(a, lang), href = `/${lang}/news/${a.slug}`;
              return (
                <article key={a.slug} className="colx">
                  {a.image?.url && <a href={href} className="colx-img" tabIndex={-1} aria-hidden="true"><img src={a.image.url} alt="" loading="lazy" /><span className="colx-badge">{t.types[a.contentType] || t.types.opinion}</span></a>}
                  <div className="colx-body">
                    <h3 className="colx-title"><a href={href}>{x.title}</a></h3>
                    {x.summary && <p className="colx-sum">{x.summary}</p>}
                    <a href={href} className="colx-btn">{ur ? "پورا کالم پڑھیں" : "Read the column"} <span aria-hidden="true">{ur ? "←" : "→"}</span></a>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="wp-back"><a href={`/${lang}/columns`}>{ur ? "← تمام کالم" : "← All columns"}</a></p>
        </div>
        <Sidebar lang={lang} mostRead={mostRead} />
      </div>
    </>
  );
}
