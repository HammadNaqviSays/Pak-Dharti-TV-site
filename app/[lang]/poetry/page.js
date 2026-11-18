import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { POETS, verseOfTheDay } from "@/lib/poetry";
import { PoetryUrduOnly } from "@/components/PoetryGate";

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (lang !== "ur") return { title: "Poetry", robots: { index: false } };
  return {
    title: "شعر و ادب: اقبال، غالب، میر، بلھے شاہ اور دیگر",
    description: "علامہ اقبال، غالب، میر، حالی، اکبر، داغ، بلھے شاہ، سلطان باہو، وارث شاہ اور خواجہ غلام فرید کا منتخب کلام، تشریح کے ساتھ۔ خوبصورت خطاطی میں تصویر یا PDF محفوظ کریں۔",
    alternates: { canonical: "/ur/poetry" },
  };
}

function Couplets({ lines }) {
  return lines.map((c, i) => (
    <div key={i} className="couplet">{c.filter(Boolean).map((m, j) => <p key={j}>{m}</p>)}</div>
  ));
}

export default async function PoetryHome({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  if (lang !== "ur") return <PoetryUrduOnly lang={lang} />;
  const { poet, poem } = verseOfTheDay();

  return (
    <div className="poetry">
      <section className="poetry-hero">
        <div className="wrap">
          <p className="poetry-kicker">شعر و ادب</p>
          <h1>اس دھرتی کی آوازیں</h1>
          <p className="poetry-lede">اقبال کے خواب سے بلھے شاہ کی کافی تک — وہ شعر جو صدیوں سے دلوں میں بستے ہیں۔ ہر شعر کو خوبصورت خطاطی میں تصویر یا PDF کی صورت محفوظ کریں اور اپنوں کو بھیجیں۔</p>
        </div>
      </section>

      <div className="wrap">
        <section className="verse-of-day" aria-labelledby="vod-h">
          <h2 id="vod-h" className="vod-label">آج کا شعر</h2>
          <a href={`/ur/poetry/${poet.slug}/${poem.slug}`} className="vod-card">
            <div className="verse-block"><Couplets lines={poem.lines.slice(0, 2)} /></div>
            <p className="vod-poet">— {poet.name}</p>
            <span className="vod-cta">خطاطی میں دیکھیں اور محفوظ کریں</span>
          </a>
        </section>

        <section aria-labelledby="poets-h" className="block">
          <h2 id="poets-h" className="sec-title">شعرا</h2>
          <div className="poet-grid">
            {POETS.map((p) => (
              <a key={p.slug} href={`/ur/poetry/${p.slug}`} className="poet-card">
                <span className="poet-lang">{p.lang}</span>
                <strong className="poet-name">{p.name}</strong>
                <span className="poet-title">{p.title}</span>
                <span className="poet-meta" dir="ltr">{p.years}</span>
                <span className="poet-place">{p.place}</span>
                <span className="poet-count">{p.poems.length} کلام</span>
              </a>
            ))}
          </div>
        </section>

        <p className="poetry-note">
          یہاں صرف وہ کلام شامل ہے جو عوامی ملکیت (پبلک ڈومین) میں آ چکا ہے۔ فیض، فراز، جون ایلیا اور پروین شاکر جیسے
          جدید شعرا کا کلام ابھی کاپی رائٹ میں ہے، اس لیے اُن پر تعارفی مضامین شائع کیے جائیں گے۔
        </p>
      </div>
    </div>
  );
}
