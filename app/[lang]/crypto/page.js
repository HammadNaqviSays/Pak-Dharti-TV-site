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
  const pk = (sym) => { const x = rows.find((k) => k.sym === sym); return x && usdPkr ? money(x.p.usd * usdPkr, x.p.usd * usdPkr >= 100 ? 0 : 2) : null; };
  const pkBtc = pk("BTC"), pkEth = pk("ETH"), pkUsdt = pk("USDT");
  const faq = ur ? [
    ...(qa ? [{ q: "آج بٹ کوائن کی قیمت کتنی ہے؟", a: qa }] : []),
    { q: "ٹیتھر (USDT) کیا ہے؟", a: "ٹیتھر ایسی ڈیجیٹل کرنسی ہے جس کی قیمت امریکی ڈالر کے برابر رکھنے کی کوشش کی جاتی ہے، اس لیے اس کی قیمت عموماً تقریباً ایک ڈالر رہتی ہے۔" },
    ...(pkBtc ? [{ q: "ایک بٹ کوائن پاکستانی روپوں میں کتنے کا ہے؟", a: `آج کے ڈالر ریٹ کے حساب سے ایک بٹ کوائن تقریباً ${pkBtc} پاکستانی روپے کا ہے۔ قیمت ہر لمحہ بدلتی ہے، اوپر والا جدول دیکھیں۔` }] : []),
    ...(pkEth ? [{ q: "ایک ایتھیریم (ETH) کتنے روپے کا ہے؟", a: `آج کے ڈالر ریٹ کے حساب سے ایک ایتھیریم تقریباً ${pkEth} پاکستانی روپے کا ہے۔` }] : []),
    ...(pkUsdt ? [{ q: "ایک ٹیتھر (USDT) کتنے روپے کا ہے؟", a: `ایک ٹیتھر تقریباً ${pkUsdt} پاکستانی روپے کے برابر ہے، کیونکہ اس کی قیمت امریکی ڈالر کے قریب رکھی جاتی ہے۔ حقیقی بازار میں خرید و فروخت کی قیمت اس سے مختلف ہو سکتی ہے۔` }] : []),
    { q: "بٹ کوائن کیا ہے؟", a: "بٹ کوائن ایک ڈیجیٹل کرنسی ہے جو کسی ایک ملک کے بینک یا حکومت کے کنٹرول میں نہیں۔ اس کا لین دین بلاک چین نامی عوامی ریکارڈ پر درج ہوتا ہے۔ اس کی کل تعداد 21 ملین تک محدود ہے۔" },
    { q: "ایتھیریم کیا ہے؟", a: "ایتھیریم ایک بلاک چین نیٹ ورک ہے جس پر مختلف ڈیجیٹل ایپلی کیشنز اور معاہدے چلتے ہیں۔ اس کی اپنی کرنسی ایتھر (ETH) کہلاتی ہے۔" },
    { q: "بٹ کوائن کی قیمت کیوں بدلتی ہے؟", a: "کرپٹو کی قیمتیں خرید و فروخت کی طلب اور رسد، بڑی خبروں، حکومتی قوانین اور سرمایہ کاروں کے رجحان سے بدلتی ہیں۔ یہ بازار اسٹاک مارکیٹ کے مقابلے میں کہیں زیادہ تیزی سے اوپر نیچے ہوتا ہے، اور ہفتے کے ساتوں دن، چوبیس گھنٹے کھلا رہتا ہے۔" },
    { q: "اسٹیبل کوائن کیا ہوتا ہے؟", a: "اسٹیبل کوائن ایسی ڈیجیٹل کرنسی ہے جس کی قیمت کسی روایتی کرنسی، عموماً امریکی ڈالر، کے برابر رکھنے کی کوشش کی جاتی ہے۔ ٹیتھر (USDT) اس کی ایک مثال ہے۔" },
    { q: "کیا کرپٹو میں پیسہ لگانا محفوظ ہے؟", a: "کرپٹو میں سرمایہ کاری بہت خطرناک ہو سکتی ہے۔ قیمتیں چند گھنٹوں میں بہت گر سکتی ہیں اور آپ کا سارا سرمایہ ڈوب سکتا ہے۔ پاک دھرتی ٹی وی کسی کو خرید یا فروخت کا مشورہ نہیں دیتا۔ فیصلے سے پہلے کسی مستند مالی ماہر سے مشورہ کریں۔" },
    { q: "یہ قیمتیں کہاں سے آتی ہیں اور کتنی بار بدلتی ہیں؟", a: "قیمتیں عالمی ڈیٹا سروس (CoinGecko) سے لی جاتی ہیں اور تقریباً ہر 15 منٹ بعد اپ ڈیٹ ہوتی ہیں۔ روپے کی قیمت آج کے ڈالر ریٹ سے نکالی جاتی ہے۔" },
    { q: "کیا یہ صفحہ سرمایہ کاری کا مشورہ ہے؟", a: "نہیں۔ یہ صرف معلومات ہیں۔ پاک دھرتی ٹی وی کسی کرپٹو کرنسی یا ایکسچینج کی خرید یا فروخت کا مشورہ نہیں دیتا۔ کرپٹو کی قیمتیں بہت تیزی سے بدلتی ہیں اور سرمایہ ڈوب سکتا ہے۔" },
    { q: "پاکستان میں کرپٹو کا قانونی ڈھانچہ کیا ہے؟", a: "پاکستان نے 2026 میں ورچوئل اثاثوں کا قانون منظور کیا جس کے تحت ورچوئل اثاثوں کی ریگولیٹری اتھارٹی (PVARA) کرپٹو سے متعلق کمپنیوں کو لائسنس دینے اور نگرانی کا کام کرتی ہے۔ اپنی صورتحال کے لیے مستند قانونی یا مالی ماہر سے رجوع کریں۔" },
  ] : [
    ...(qa ? [{ q: "What is the Bitcoin price today?", a: qa }] : []),
    { q: "What is Tether (USDT)?", a: "Tether is a digital token designed to stay close to the value of one US dollar, so its price is normally about one dollar." },
    ...(pkBtc ? [{ q: "How much is one Bitcoin in Pakistani rupees?", a: `At today's dollar rate, one Bitcoin is about ${pkBtc} Pakistani rupees. The price changes every moment, see the table above.` }] : []),
    ...(pkEth ? [{ q: "How much is one Ethereum (ETH) in rupees?", a: `At today's dollar rate, one Ethereum is about ${pkEth} Pakistani rupees.` }] : []),
    ...(pkUsdt ? [{ q: "How much is one Tether (USDT) in rupees?", a: `One Tether is about ${pkUsdt} Pakistani rupees, because it is designed to stay close to one US dollar. The price you actually get when buying or selling can differ.` }] : []),
    { q: "What is Bitcoin?", a: "Bitcoin is a digital currency that is not controlled by any one country's bank or government. Its transactions are recorded on a public ledger called the blockchain. Its total supply is capped at 21 million coins." },
    { q: "What is Ethereum?", a: "Ethereum is a blockchain network on which many digital applications and contracts run. Its own currency is called ether (ETH)." },
    { q: "Why does the price of Bitcoin change?", a: "Crypto prices move with supply and demand, big news, government rules and investor mood. The market moves far faster than the stock market and trades 24 hours a day, seven days a week." },
    { q: "What is a stablecoin?", a: "A stablecoin is a digital currency designed to keep its value close to a traditional currency, usually the US dollar. Tether (USDT) is one example." },
    { q: "Is it safe to put money into crypto?", a: "Crypto investing can be very risky. Prices can fall sharply within hours and you can lose all your money. Pak Dharti TV does not advise anyone to buy or sell. Speak to a qualified financial adviser before deciding." },
    { q: "Where do these prices come from and how often do they update?", a: "Prices come from a global data service (CoinGecko) and update about every 15 minutes. The rupee price is worked out from today's dollar rate." },
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
                    <th scope="row"><span className="coin-cell"><span className="coin-badge" aria-hidden="true" data-sym={k.sym}>{k.mark}</span><span className="coin-name">{ur ? k.ur : k.en}</span><span className="coin-sym" dir="ltr">{k.sym}</span></span></th>
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
