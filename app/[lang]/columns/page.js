import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Article, LANGS } from "@/models";
import { getTicker, getMostRead, pickText } from "@/lib/queries";
import { Ticker, Sidebar } from "@/components/SiteChrome";
import { DICT } from "@/lib/i18n";
import { writerSlug } from "@/lib/writerSlug";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!DICT[lang]) return {};
  return {
    title: lang === "ur" ? "کالم اور مہمان تحریریں" : "Columns and guest writers",
    description: lang === "ur"
      ? "پاک دھرتی ٹی وی پر مصنفین اور مہمان لکھاریوں کے کالم اور تحریریں۔"
      : "Columns and articles by writers and guest authors on Pak Dharti TV.",
    alternates: { canonical: `/${lang}/columns`, languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}/columns`])) },
  };
}

export default async function ColumnsPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  await connectDB();
  const [items, ticker, mostRead] = await Promise.all([
    Article.find({ status: "published", "author.name": { $exists: true, $ne: "" } },
      { slug: 1, image: 1, publishedAt: 1, author: 1, translations: 1, contentType: 1 }).sort({ publishedAt: -1 }).limit(60).lean(),
    getTicker(), getMostRead(),
  ]);
  const ur = lang === "ur";
  const t = DICT[lang];
  const who = (au) => ({ name: ur && au.nameUr ? au.nameUr : au.name, role: ur && au.roleUr ? au.roleUr : au.role });
  const writers = [...new Map(items.map((a) => [a.author.name, a.author])).values()];
  const card = (a, big) => {
    const x = pickText(a, lang), au = a.author, w = who(au), href = `/${lang}/news/${a.slug}`;
    return (
      <article key={a.slug} className={big ? "colx colx-big" : "colx"}>
        {a.image?.url && (
          <a href={href} className="colx-img" tabIndex={-1} aria-hidden="true">
            <img src={a.image.url} alt="" loading={big ? "eager" : "lazy"} />
            <span className="colx-badge">{t.types[a.contentType] || t.types.opinion}</span>
          </a>
        )}
        <div className="colx-body">
          <h2 className="colx-title"><a href={href}>{x.title}</a></h2>
          {x.summary && <p className="colx-sum">{x.summary}</p>}
          <div className="colx-by">
            {au.photo && <img src={au.photo} alt={w.name} width="44" height="44" loading="lazy" />}
            <span><small>{ur ? "تحریر" : "By"}</small><b><a href={`/${lang}/writers/${writerSlug(au.name)}`}>{w.name}</a></b></span>
          </div>
          <a href={href} className="colx-btn">{ur ? "پورا کالم پڑھیں" : "Read the column"} <span aria-hidden="true">{ur ? "←" : "→"}</span></a>
        </div>
      </article>
    );
  };
  return (
    <>
      <Ticker lang={lang} items={ticker} />
      <div className="wrap with-sidebar">
        <div className="main-col">
          <header className="colx-head">
            <p className="colx-kicker">{ur ? "رائے · تحریریں" : "Opinion · Voices"}</p>
            <h1 className="colx-h1">{ur ? "کالم اور مہمان تحریریں" : "Columns and guest writers"}</h1>
            <p className="colx-intro">{ur
              ? "یہاں وہ آوازیں ہیں جو بات کھل کر کہتی ہیں۔ ہر تحریر لکھاری کے اپنے نام اور اپنی رائے کے ساتھ شائع ہوتی ہے۔"
              : "Writers who say what they think. Every piece carries its author’s own name and opinion."}</p>
          </header>
          {writers.length > 0 && (
            <ul className="colx-writers" aria-label={ur ? "ہمارے لکھاری" : "Our writers"}>
              {writers.map((au) => { const w = who(au); return (
                <li key={au.name}>
                  {au.photo ? <img src={au.photo} alt="" width="56" height="56" loading="lazy" /> : <span className="colx-dot" />}
                  <span><b><a href={`/${lang}/writers/${writerSlug(au.name)}`}>{w.name}</a></b>{w.role && <small>{w.role}</small>}</span>
                </li>); })}
            </ul>
          )}
          {!items.length ? <p className="empty">{ur ? "جلد ہی کالم شائع ہوں گے۔" : "Columns will appear here soon."}</p> : (
            <>
              {card(items[0], true)}
              {items.length > 1 && <div className="colx-grid">{items.slice(1).map((a) => card(a, false))}</div>}
            </>
          )}
          <aside className="colx-join">
            <div>
              <h2>{ur ? "کیا آپ بھی لکھنا چاہتے ہیں؟" : "Want to write for us?"}</h2>
              <p>{ur
                ? "پاک دھرتی ٹی وی نیا پلیٹ فارم ہے اور ہمیں اچھے لکھنے والوں کی تلاش ہے۔ اپنی تحریر بھیجیں، آپ کے نام اور تعارف کے ساتھ شائع کریں گے۔"
                : "Pak Dharti TV is a new platform and we are looking for good writers. Send us your piece and we will publish it with your name and bio."}</p>
            </div>
            <a href={`/${lang}/contact`} className="colx-btn">{ur ? "ہمیں لکھیں" : "Write to us"} <span aria-hidden="true">{ur ? "←" : "→"}</span></a>
          </aside>
        </div>
        <Sidebar lang={lang} mostRead={mostRead} />
      </div>
    </>
  );
}
