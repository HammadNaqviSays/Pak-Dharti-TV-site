import { notFound } from "next/navigation";
import { getCategory, getTicker, getMostRead } from "@/lib/queries";
import { DICT } from "@/lib/i18n";
import { LANGS, CATEGORIES } from "@/models";
import { Ticker, Sidebar } from "@/components/SiteChrome";
import { Story } from "@/components/Stories";
import { PoetryUrduOnly } from "@/components/PoetryGate";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { lang, cat } = await params;
  if (!DICT[lang] || !CATEGORIES.includes(cat)) return {};
  return {
    title: DICT[lang].cats[cat],
    description: lang === "ur"
      ? `${DICT[lang].cats[cat]} کی تازہ ترین خبریں اور تجزیے — پاک دھرتی ٹی وی۔`
      : `Latest ${DICT[lang].cats[cat]} news and updates from Pakistan and the world — Pak Dharti TV.`,
    alternates: {
      canonical: `/${lang}/category/${cat}`,
      languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}/category/${cat}`])),
    },
  };
}

export default async function CategoryPage({ params }) {
  const { lang, cat } = await params;
  if (!LANGS.includes(lang) || !CATEGORIES.includes(cat)) notFound();
  if (cat === "poetry" && lang !== "ur") return <PoetryUrduOnly lang={lang} />;
  const t = DICT[lang];
  const [items, ticker, mostRead] = await Promise.all([getCategory(cat), getTicker(), getMostRead()]);
  const [first, ...others] = items;

  return (
    <>
      <Ticker lang={lang} items={ticker} />
      <div className="wrap with-sidebar">
        <div className="main-col">
          <h1 className="page-title">{t.cats[cat]}</h1>
          {cat === "poetry" && <p className="poetry-gate-link"><a className="btn-link" href="/ur/poetry">اقبال، غالب، میر اور بلھے شاہ کا منتخب کلام ←</a></p>}
          {!first ? <p className="empty">{t.empty}</p> : (
            <>
              <section className="front">
                <Story a={first} lang={lang} variant="lead" showCategory={false} />
              </section>
              {others.length > 0 && (
                <section className="block">
                  <div className="grid-3">
                    {others.map((a) => <Story key={a.slug} a={a} lang={lang} variant="card" showCategory={false} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
        <Sidebar lang={lang} mostRead={mostRead} />
      </div>
    </>
  );
}
