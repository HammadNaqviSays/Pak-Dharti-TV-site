import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { POETS, findPoet } from "@/lib/poetry";
import { PoetryUrduOnly } from "@/components/PoetryGate";

export const revalidate = 3600;
export function generateStaticParams() { return POETS.map((p) => ({ lang: "ur", poet: p.slug })); }

export async function generateMetadata({ params }) {
  const { lang, poet: slug } = await params;
  const poet = findPoet(slug);
  if (lang !== "ur" || !poet) return { robots: { index: false } };
  return { title: `${poet.name}: منتخب کلام`, description: poet.bio.slice(0, 155), alternates: { canonical: `/ur/poetry/${slug}` } };
}

export default async function PoetPage({ params }) {
  const { lang, poet: slug } = await params;
  if (!LANGS.includes(lang)) notFound();
  if (lang !== "ur") return <PoetryUrduOnly lang={lang} />;
  const poet = findPoet(slug);
  if (!poet) notFound();

  return (
    <div className="poetry">
      <section className="poetry-hero poet-hero">
        <div className="wrap">
          <p className="poetry-kicker"><a href="/ur/poetry">شعر و ادب</a> · {poet.lang}</p>
          <h1>{poet.name}</h1>
          <p className="poet-hero-meta"><span>{poet.title}</span> · <span dir="ltr">{poet.years}</span> · <span>{poet.place}</span></p>
        </div>
      </section>
      <div className="wrap">
        <p className="poet-bio">{poet.bio}</p>
        <div className="poem-list">
          {poet.poems.map((poem) => (
            <a key={poem.slug} href={`/ur/poetry/${poet.slug}/${poem.slug}`} className="poem-tile">
              <span className="poem-tile-title">{poem.title}</span>
              <span className="poem-tile-kind">{poem.kind} · {poem.lines.length === 1 ? "ایک شعر" : `${poem.lines.length} ${poem.kind === "کافی" || poem.kind === "بیت" ? "بند" : "اشعار"}`}</span>
              <div className="verse-block">
                {poem.lines.slice(0, 3).map((c, i) => <div key={i} className="couplet">{c.filter(Boolean).map((m, j) => <p key={j}>{m}</p>)}</div>)}
              </div>
              <span className="vod-cta">خطاطی میں دیکھیں</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
