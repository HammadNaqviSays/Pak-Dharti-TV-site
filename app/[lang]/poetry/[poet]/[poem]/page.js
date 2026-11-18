import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { POETS, findPoet, findPoem } from "@/lib/poetry";
import { SITE } from "@/lib/site";
import { PoetryUrduOnly } from "@/components/PoetryGate";
import PoemCard from "@/components/PoemCard";
import { ShareBar } from "@/components/Stories";

export const revalidate = 3600;
export function generateStaticParams() {
  return POETS.flatMap((p) => p.poems.map((q) => ({ lang: "ur", poet: p.slug, poem: q.slug })));
}

export async function generateMetadata({ params }) {
  const { lang, poet: ps, poem: qs } = await params;
  const poet = findPoet(ps); const poem = findPoem(poet, qs);
  if (lang !== "ur" || !poem) return { robots: { index: false } };
  const first = poem.lines[0].filter(Boolean).join(" / ");
  return {
    title: `${poem.title} — ${poet.name}`,
    description: `${first} — ${poet.name}. خطاطی میں تصویر یا PDF محفوظ کریں۔`,
    alternates: { canonical: `/ur/poetry/${ps}/${qs}` },
  };
}

export default async function PoemPage({ params }) {
  const { lang, poet: ps, poem: qs } = await params;
  if (!LANGS.includes(lang)) notFound();
  if (lang !== "ur") return <PoetryUrduOnly lang={lang} />;
  const poet = findPoet(ps); const poem = findPoem(poet, qs);
  if (!poem) notFound();
  const url = `${SITE.url}/ur/poetry/${ps}/${qs}`;
  const others = poet.poems.filter((p) => p.slug !== qs);

  return (
    <div className="poetry">
      <div className="wrap poem-page">
        <p className="poetry-kicker"><a href="/ur/poetry">شعر و ادب</a> · <a href={`/ur/poetry/${poet.slug}`}>{poet.name}</a></p>
        <h1 className="poem-title">{poem.title}</h1>
        <p className="poem-kind">{poem.kind}{poem.selection ? " · منتخب اشعار" : ""} · {poem.lines.length === 1 ? "ایک شعر" : `${poem.lines.length} ${poem.kind === "کافی" || poem.kind === "بیت" ? "بند" : "اشعار"}`}</p>
        <div className="poem-layout">
          <PoemCard poem={poem} poet={{ name: poet.name }} fileName={`pak-dharti-${poet.slug}-${poem.slug}`} pageUrl={url} />
          <aside className="poem-side">
            <h2 className="side-heading">مکمل کلام</h2>
            <div className="verse-block poem-full">
              {poem.lines.map((c, i) => <div key={i} className="couplet">{c.filter(Boolean).map((m, j) => <p key={j}>{m}</p>)}</div>)}
            </div>
            {poem.selection && <p className="poem-source">اس کلام کے منتخب اشعار پیش کیے گئے ہیں۔</p>}
            <h2 className="side-heading">تشریح</h2>
            <p className="poem-note">{poem.note}</p>
            {poem.source && <p className="poem-source">ماخذ: {poem.source}</p>}
            <h2 className="side-heading">شاعر</h2>
            <p className="poem-note">{poet.bio}</p>
            <ShareBar lang="ur" url={url} title={`${poem.title} — ${poet.name}`} />
          </aside>
        </div>

        {others.length > 0 && (
          <section className="block">
            <h2 className="sec-title">{poet.name} کا مزید کلام</h2>
            <div className="poem-list">
              {others.map((p) => (
                <a key={p.slug} href={`/ur/poetry/${poet.slug}/${p.slug}`} className="poem-tile">
                  <span className="poem-tile-title">{p.title}</span>
                  <div className="verse-block">
                    {p.lines.map((c, i) => <div key={i} className="couplet">{c.filter(Boolean).map((m, j) => <p key={j}>{m}</p>)}</div>)}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
