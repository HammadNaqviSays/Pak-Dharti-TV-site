import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getCrypto, COINS } from "@/lib/crypto";
import { getRates, money } from "@/lib/rates";
import { alt, todayLabel } from "@/lib/utilPage";
import UtilShell from "@/components/UtilShell";
import Faq, { QuickAnswer } from "@/components/Faq";
import AdSlot from "@/components/Ads";

export const revalidate = 900;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  const d = todayLabel(lang);
  return {
    title: lang === "ur" ? `بٹ کوائن اور کرپٹو کرنسی کی قیمت آج — ${d}` : `Bitcoin and crypto prices today — ${d}`,
    description: lang === "ur"
      ? `${d}: بٹ کوائن، ایتھیریم، ٹیتھر، بی این بی، ایکس آر پی اور سولانا کی ڈالر اور روپے میں قیمت، 24 گھنٹے کا فرق۔ صرف معلومات، مالی مشورہ نہیں۔`
      : `Prices of Bitcoin, Ethereum, Tether, BNB, XRP and Solana on ${d} in US dollars and Pakistani rupees, with the 24-hour change. Information only, not financial advice.`,
    alternates: alt(lang, "/crypto"),
  };
}

export default async function CryptoPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const ur = lang === "ur";
  const [c, rates] = await Promise.all([getCrypto(), getRates().catch(() => null)]);
  const usdPkr = rates?.fx?.find((x) => x.code === "USD")?.pkr;
  const d = todayLabel(lang);
  const rows = COINS.map((k) => ({ ...k, p: c?.prices?.[k.sym] })).filter((k) => k.p);
  const btc = rows.find((k) => k.sym === "BTC");
  const digits = (n) => (n >= 100 ? 0 : n >= 1 ? 2 : 4);
  const qa = btc ? (ur
    ? `بٹ کوائن کی قیمت اس وقت تقریباً ${money(btc.p.usd, 0)} امریکی ڈالر${usdPkr ? ` (تقریباً ${money(btc.p.usd * usdPkr, 0)} پاکستانی روپے)` : ""} ہے${btc.p.pct != null ? `، پچھلے 24 گھنٹوں میں ${Math.abs(btc.p.pct).toFixed(2)} فیصد ${btc.p.pct >= 0 ? "اضافہ" : "کمی"}` : ""}۔`
    : `Bitcoin is around ${money(btc.p.usd, 0)} US dollars${usdPkr ? ` (about ${money(btc.p.usd * usdPkr, 0)} Pakistani rupees)` : ""}${btc.p.pct != null ? `, ${btc.p.pct >= 0 ? "up" : "down"} ${Math.abs(btc.p.pct).toFixed(2)}% in the last 24 hours` : ""}.`) : "";
  const faq = ur ? [
    ...(qa ? [{ q: "آج بٹ کوائن کی قیمت کتنی ہے؟", a: qa }] : []),
    { q: "ٹیتھر (USDT) کیا ہے؟", a: "ٹیتھر ایسی ڈیجیٹل کرنسی ہے جس کی قیمت امریکی ڈالر کے برابر رکھنے کی کوشش کی جاتی ہے، اس لیے اس کی قیمت عموماً تقریباً ایک ڈالر رہتی ہے۔" },
    { q: "کیا یہ صفحہ سرمایہ کاری کا مشورہ ہے؟", a: "نہیں۔ یہ صرف معلومات ہیں۔ پاک دھرتی ٹی وی کسی کرپٹو کرنسی یا ایکسچینج کی خرید یا فروخت کا مشورہ نہیں دیتا۔ کرپٹو کی قیمتیں بہت تیزی سے بدلتی ہیں اور سرمایہ ڈوب سکتا ہے۔" },
    { q: "پاکستان میں کرپٹو کا قانونی ڈھانچہ کیا ہے؟", a: "پاکستان نے 2026 میں ورچوئل اثاثوں کا قانون منظور کیا جس کے تحت ورچوئل اثاثوں کی ریگولیٹری اتھارٹی (PVARA) کرپٹو سے متعلق کمپنیوں کو لائسنس دینے اور نگرانی کا کام کرتی ہے۔ اپنی صورتحال کے لیے مستند قانونی یا مالی ماہر سے رجوع کریں۔" },
  ] : [
    ...(qa ? [{ q: "What is the Bitcoin price today?", a: qa }] : []),
    { q: "What is Tether (USDT)?", a: "Tether is a digital token designed to stay close to the value of one US dollar, so its price is normally about one dollar." },
    { q: "Is this page investment advice?", a: "No. It is information only. Pak Dharti TV does not recommend buying or selling any cryptocurrency or exchange. Crypto prices change very fast and you can lose your money." },
    { q: "What is the legal framework for crypto in Pakistan?", a: "Pakistan passed a Virtual Assets Act in 2026 under which the Pakistan Virtual Assets Regulatory Authority (PVARA) licenses and supervises crypto service providers. For your own situation, ask a qualified legal or financial professional." },
  ];
  return (
    <UtilShell lang={lang} current="crypto" h1={ur ? `بٹ کوائن اور کرپٹو کی قیمت — ${d}` : `Bitcoin and crypto prices — ${d}`}
      lede={ur ? "چھ بڑی اور مشہور ڈیجیٹل کرنسیوں کی تازہ قیمت۔ یہ صرف معلومات ہیں، سرمایہ کاری کا مشورہ نہیں۔" : "Latest prices of six large, well-known digital currencies. Information only, not investment advice."}>
      {qa && <QuickAnswer>{qa}</QuickAnswer>}
      {!rows.length ? <p className="empty">{ur ? "قیمتیں اس وقت دستیاب نہیں۔" : "Prices are temporarily unavailable."}</p> : (
        <>
          <div className="table-scroll">
            <table className="util-table">
              <thead><tr>
                <th scope="col">{ur ? "کرنسی" : "Coin"}</th>
                <th scope="col">{ur ? "ڈالر (USD)" : "USD"}</th>
                {usdPkr && <th scope="col">{ur ? "روپے (PKR)" : "PKR"}</th>}
                <th scope="col">{ur ? "24 گھنٹے" : "24 h"}</th>
              </tr></thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.sym}>
                    <th scope="row"><span aria-hidden="true">{k.mark}</span> {ur ? k.ur : k.en} <small dir="ltr">({k.sym})</small></th>
                    <td dir="ltr">${money(k.p.usd, digits(k.p.usd))}</td>
                    {usdPkr && <td dir="ltr">{money(k.p.usd * usdPkr, digits(k.p.usd * usdPkr))}</td>}
                    <td dir="ltr" className={k.p.pct > 0 ? "up" : k.p.pct < 0 ? "down" : ""}>{k.p.pct != null ? `${k.p.pct >= 0 ? "▲ +" : "▼ "}${k.p.pct.toFixed(2)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rates-note">
            {ur ? "ماخذ" : "Source"}: {c?.source}. {ur ? "روپے کی قیمت آج کے ڈالر ریٹ سے نکالی گئی ہے۔" : "Rupee prices use today's dollar rate."}{" "}
            {c?.fetchedAt && (ur ? "آخری اپ ڈیٹ" : "Last updated")}{c?.fetchedAt && `: ${new Intl.DateTimeFormat(ur ? "ur-PK" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(c.fetchedAt))}`}
          </p>
        </>
      )}
      <p className="rates-note" role="note">
        <strong>{ur ? "انتباہ:" : "Notice:"}</strong>{" "}
        {ur ? "یہ معلومات ہیں، مالی مشورہ نہیں۔ کرپٹو کرنسی کی قیمتیں بہت تیزی سے بدلتی ہیں اور آپ کا پورا سرمایہ ڈوب سکتا ہے۔ ہم کسی کرپٹو یا ایکسچینج کی تشہیر یا سفارش نہیں کرتے۔"
          : "This is information, not financial advice. Crypto prices change very fast and you can lose all your money. We do not promote or recommend any coin or exchange."}
      </p>
      <Faq lang={lang} items={faq} />
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
