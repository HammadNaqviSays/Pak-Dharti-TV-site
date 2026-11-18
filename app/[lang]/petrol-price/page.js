import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getFuel, updateFuelFromNews } from "@/lib/fuel";
import { getOil } from "@/lib/oil";
import { money } from "@/lib/rates";
import { alt, todayLabel } from "@/lib/utilPage";
import UtilShell from "@/components/UtilShell";
import Faq, { QuickAnswer } from "@/components/Faq";
import AdSlot from "@/components/Ads";

export const revalidate = 1800;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  const d = todayLabel(lang);
  const f = await getFuel().catch(() => null);
  const nums = f?.petrol ? (lang === "ur" ? `پیٹرول ${money(f.petrol, 2)} روپے${f.diesel ? `، ڈیزل ${money(f.diesel, 2)} روپے` : ""} فی لیٹر` : `Petrol Rs ${money(f.petrol, 2)}${f.diesel ? `, Diesel Rs ${money(f.diesel, 2)}` : ""} per litre`) : "";
  return {
    title: lang === "ur" ? `پیٹرول اور ڈیزل کی قیمت آج${nums ? `: ${nums}` : ""} — ${d}` : `Petrol and diesel price in Pakistan today${nums ? `: ${nums}` : ""} — ${d}`,
    description: lang === "ur"
      ? `${d}: پاکستان میں پیٹرول اور ہائی اسپیڈ ڈیزل کی تازہ ترین فی لیٹر قیمت۔`
      : `Latest official petrol and high-speed diesel prices per litre in Pakistan, ${d}.`,
    alternates: alt(lang, "/petrol-price"),
  };
}

export default async function PetrolPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const ur = lang === "ur";
  try { await updateFuelFromNews(); } catch {}
  const [f, oil] = await Promise.all([getFuel(), getOil().catch(() => null)]);
  const d = todayLabel(lang);
  const eff = f?.effective ? new Intl.DateTimeFormat(ur ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(`${f.effective}T12:00:00Z`)) : null;
  const qa = f?.petrol ? (ur
    ? `${d} کو پاکستان میں پیٹرول **${money(f.petrol, 2)} PKR** فی لیٹر${f.diesel ? ` اور ہائی اسپیڈ ڈیزل **${money(f.diesel, 2)} PKR** فی لیٹر` : ""} ہے۔`
    : `On ${d}, petrol in Pakistan costs **${money(f.petrol, 2)} PKR** per litre${f.diesel ? ` and high-speed diesel **${money(f.diesel, 2)} PKR** per litre` : ""}.`) : null;
  const faq = f?.petrol ? (ur ? [
    { q: "آج پاکستان میں پیٹرول کی قیمت کیا ہے؟", a: qa },
    ...(oil?.brent ? [{ q: "برینٹ خام تیل فی بیرل کتنے ڈالر کا ہے؟", a: `برینٹ خام تیل تقریباً $${money(oil.brent.price, 2)} فی بیرل ہے۔` }] : []),
    { q: "ایک بیرل میں کتنے لیٹر ہوتے ہیں؟", a: "ایک بیرل میں تقریباً 159 لیٹر ہوتے ہیں۔" },
  ] : [
    { q: "What is the petrol price in Pakistan today?", a: qa },
    ...(oil?.brent ? [{ q: "What is the Brent crude oil price per barrel?", a: `Brent crude is about $${money(oil.brent.price, 2)} per barrel.` }] : []),
    { q: "How many litres are in a barrel of oil?", a: "A barrel holds about 159 litres." },
  ]) : [];
  return (
    <UtilShell lang={lang} current="petrol-price" h1={ur ? `پیٹرول اور ڈیزل کی قیمت — ${d}` : `Petrol and diesel price in Pakistan — ${d}`}
      lede={ur ? "اوگرا کی جانب سے اعلان کردہ تازہ ترین فی لیٹر قیمتیں۔ ہفتہ اور اتوار کو جمعہ کی قیمتیں برقرار رہتی ہیں۔" : "The latest per-litre prices announced by OGRA. Friday's prices stay in force over the weekend."}>
      <QuickAnswer>{qa}</QuickAnswer>
      {!f?.petrol && !f?.diesel ? <p className="empty">{ur ? "قیمت اس وقت دستیاب نہیں، کچھ دیر بعد دیکھیں۔" : "Prices are temporarily unavailable. Please check back soon."}</p> : (
        <>
          <div className="stat-row">
            {f.petrol && <div className="stat"><span className="st-k">{ur ? "پیٹرول (فی لیٹر)" : "Petrol (per litre)"}</span><strong dir="ltr">{money(f.petrol, 2)} PKR</strong></div>}
            {f.diesel && <div className="stat"><span className="st-k">{ur ? "ہائی اسپیڈ ڈیزل (فی لیٹر)" : "High-speed diesel (per litre)"}</span><strong dir="ltr">{money(f.diesel, 2)} PKR</strong></div>}
          </div>
          <p className="rates-note">
            {eff && <>{ur ? "نافذ العمل از" : "Effective"}: <b>{eff}</b>. </>}
            {f.source && <>{ur ? "ماخذ" : "Source"}: {f.url ? <a href={f.url} rel="noopener noreferrer nofollow" target="_blank">{f.source}</a> : f.source}. </>}
            {ur ? "قیمتیں خبروں سے لی جاتی ہیں؛ پمپ پر قیمت میں معمولی فرق ممکن ہے۔" : "Prices are read from news reports of the official notification; pump prices can differ slightly."}
          </p>
        </>
      )}
      {(oil?.brent || oil?.wti) && (
        <section className="rates-section">
          <h2 className="sec-title">{ur ? "عالمی منڈی میں خام تیل (ڈالر فی بیرل)" : "World crude oil price (US$ per barrel)"}</h2>
          <div className="stat-row">
            {[["brent", "Brent"], ["wti", "WTI"]].filter(([k]) => oil[k]).map(([k, name]) => {
              const o = oil[k], ch = o.prev ? o.price - o.prev : null;
              return (
                <div key={k} className={`stat ${ch == null ? "" : ch > 0 ? "up" : ch < 0 ? "down" : ""}`}>
                  <span className="st-k">{name} {ur ? "خام تیل" : "crude"}</span>
                  <strong dir="ltr">${money(o.price, 2)}</strong>
                  {ch != null && <span className="st-s" dir="ltr">{ch >= 0 ? "▲" : "▼"} ${money(Math.abs(ch), 2)} ({ch >= 0 ? "+" : ""}{((ch / o.prev) * 100).toFixed(2)}%)</span>}
                </div>
              );
            })}
          </div>
          <p className="rates-note">
            {ur ? "پاکستان میں پیٹرول کی قیمت عالمی منڈی کے تیل کے نرخ اور ڈالر روپے کی شرح سے جڑی ہے۔ ایک بیرل تقریباً 159 لیٹر ہوتا ہے۔" : "Pakistan's pump prices follow world oil prices and the dollar–rupee rate. One barrel is about 159 litres."}
            {" "}{ur ? "ماخذ" : "Source"}: {oil.brent?.source || oil.wti?.source}{(oil.brent?.date || oil.wti?.date) && <> · <span dir="ltr">{oil.brent?.date || oil.wti?.date}</span></>}.
          </p>
        </section>
      )}
      <Faq lang={lang} items={faq} />
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
