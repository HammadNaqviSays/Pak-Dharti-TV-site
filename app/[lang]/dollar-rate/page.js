import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getRates, money } from "@/lib/rates";
import { W } from "@/lib/widgetText";
import { alt, todayLabel } from "@/lib/utilPage";
import UtilShell from "@/components/UtilShell";
import CurrencyCalc from "@/components/CurrencyCalc";
import Faq, { QuickAnswer } from "@/components/Faq";
import AdSlot from "@/components/Ads";

export const revalidate = 1800;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  const d = todayLabel(lang);
  const usd = (await getRates().catch(() => null))?.fx?.find((c) => c.code === "USD");
  const n = usd ? money(usd.pkr, 2) : "";
  return {
    title: lang === "ur" ? `آج ڈالر کا ریٹ پاکستان میں${n ? `: 1 ڈالر = ${n} روپے` : ""} — ${d}` : `Dollar rate in Pakistan today${n ? `: 1 USD = Rs ${n}` : ""} — ${d}`,
    description: lang === "ur"
      ? `${d}: ڈالر، ریال، درہم، پاؤنڈ اور یورو کے مقابلے میں پاکستانی روپے کا ریٹ، اور کرنسی کیلکولیٹر۔`
      : `USD to PKR on ${d}, plus rupee rates for the Saudi riyal, UAE dirham, pound and euro, with a currency calculator.`,
    alternates: alt(lang, "/dollar-rate"),
  };
}

export default async function DollarPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const w = W[lang], ur = lang === "ur";
  const rates = await getRates().catch(() => null);
  const d = todayLabel(lang);
  const usd = rates?.fx?.find((c) => c.code === "USD");
  const change = usd?.prev ? ((usd.pkr - usd.prev) / usd.prev) * 100 : null;
  const sar = rates?.fx?.find((c) => c.code === "SAR"), aed = rates?.fx?.find((c) => c.code === "AED");
  const qa = usd ? (ur ? `${d} کو 1 امریکی ڈالر **${money(usd.pkr, 2)} PKR** کے برابر ہے (انٹربینک اوسط نرخ)۔` : `On ${d}, 1 US dollar is **${money(usd.pkr, 2)} PKR** (interbank mid-market rate).`) : null;
  const faq = usd ? (ur ? [
    { q: "آج ڈالر کا ریٹ کیا ہے؟", a: qa },
    ...(sar ? [{ q: "1 سعودی ریال کتنے روپے کا ہے؟", a: `1 سعودی ریال تقریباً **${money(sar.pkr, 2)} PKR** کے برابر ہے۔` }] : []),
    ...(aed ? [{ q: "1 اماراتی درہم کتنے روپے کا ہے؟", a: `1 اماراتی درہم تقریباً **${money(aed.pkr, 2)} PKR** کے برابر ہے۔` }] : []),
    { q: "اوپن مارکیٹ اور اس ریٹ میں فرق کیوں ہے؟", a: "یہ انٹربینک اوسط نرخ ہیں؛ اوپن مارکیٹ اور بینکوں کے نرخ تھوڑے مختلف ہو سکتے ہیں۔" },
  ] : [
    { q: "What is the dollar rate in Pakistan today?", a: qa },
    ...(sar ? [{ q: "How many rupees is 1 Saudi riyal?", a: `1 Saudi riyal is about **${money(sar.pkr, 2)} PKR**.` }] : []),
    ...(aed ? [{ q: "How many rupees is 1 UAE dirham?", a: `1 UAE dirham is about **${money(aed.pkr, 2)} PKR**.` }] : []),
    { q: "Why can open-market rates differ from this rate?", a: "These are interbank mid-market rates; open-market and bank rates can differ slightly." },
  ]) : [];
  const gulf = ["SAR", "AED", "GBP", "EUR", "QAR", "KWD"];
  return (
    <UtilShell lang={lang} current="dollar-rate" h1={ur ? `آج ڈالر کا ریٹ — ${d}` : `Dollar rate in Pakistan today — ${d}`}
      lede={ur ? "امریکی ڈالر کے مقابلے میں پاکستانی روپے کا آج کا ریٹ، اور دوسری اہم کرنسیوں کے نرخ۔" : "Today's US dollar to Pakistani rupee rate, with the other main currencies Pakistanis ask about."}>
      <QuickAnswer>{qa}</QuickAnswer>
      {!rates?.fx?.length ? <p className="empty">{w.unavailable}</p> : (
        <>
          {usd && (
            <div className="stat-row">
              <div className={`stat ${change == null ? "" : change > 0.0005 ? "up" : change < -0.0005 ? "down" : ""}`}>
                <span className="st-k">1 USD →</span><strong dir="ltr">{money(usd.pkr, 2)} PKR</strong>
                {change != null && <span className="st-s" dir="ltr">{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% {ur ? "پچھلے دن کے مقابلے میں" : "vs previous day"}</span>}
              </div>
              {rates.fx.filter((c) => gulf.includes(c.code)).slice(0, 3).map((c) => (
                <div className="stat" key={c.code}><span className="st-k">1 {c.code} · {c[lang] || c.en}</span><strong dir="ltr">{money(c.pkr, 2)} PKR</strong></div>
              ))}
            </div>
          )}
          <div className="table-scroll">
            <table className="util-table">
              <thead><tr><th>{w.currency}</th><th>{w.buyOne}</th></tr></thead>
              <tbody>
                {rates.fx.map((c) => (
                  <tr key={c.code}><th scope="row"><span aria-hidden="true">{c.flag}</span> {c[lang] || c.en} <span className="fx-code">{c.code}</span></th><td dir="ltr">{money(c.pkr, c.pkr < 10 ? 3 : 2)} PKR</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rates-note">{w.fxNote} {rates.date && <>{w.updated}: <span dir="ltr">{rates.date}</span></>}</p>
          <section className="rates-section">
            <h2 className="sec-title">{w.calc}</h2>
            <CurrencyCalc lang={lang} fx={rates.fx} t={w} />
          </section>
        </>
      )}
      <Faq lang={lang} items={faq} />
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
