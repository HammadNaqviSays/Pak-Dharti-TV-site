import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getMandi } from "@/lib/mandi";
import { MANDI_CITIES, MANDI_ITEMS, mandiUnit } from "@/lib/mandiItems";
import { money } from "@/lib/rates";
import { alt, todayLabel, MANDI_EN, MANDI_CITY_EN } from "@/lib/utilPage";
import UtilShell from "@/components/UtilShell";
import AdSlot from "@/components/Ads";

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  const d = todayLabel(lang);
  return {
    title: lang === "ur" ? `آج کے منڈی ریٹ: گندم، آلو، پیاز، ٹماٹر — ${d}` : `Mandi rates today: wheat, potato, onion, tomato — ${d}`,
    description: lang === "ur"
      ? `${d}: لاہور، فیصل آباد، راولپنڈی، ملتان اور بھکر کی منڈیوں کے تھوک نرخ فی کلو: گندم، دالیں، سبزیاں۔`
      : `Wholesale mandi prices per kg in Lahore, Faisalabad, Rawalpindi, Multan and Bhakkar on ${d}: wheat, pulses and vegetables.`,
    alternates: alt(lang, "/mandi-rates"),
  };
}

export default async function MandiPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const ur = lang === "ur";
  const m = await getMandi().catch(() => null);
  const d = todayLabel(lang);
  const cities = MANDI_CITIES.filter((c) => m?.prices?.[c.key]);
  const asOf = m ? new Intl.DateTimeFormat(ur ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(m.changedAt || m.fetchedAt)) : null;
  return (
    <UtilShell lang={lang} current="mandi-rates" h1={ur ? `منڈی کے نرخ — ${d}` : `Mandi rates in Pakistan — ${d}`}
      lede={ur ? "پنجاب کی بڑی منڈیوں کے تھوک نرخ (روپے فی کلو؛ گندم فی 40 کلو)۔ پرچون نرخ عموماً زیادہ ہوتے ہیں۔" : "Wholesale prices in Punjab's main markets, in rupees per kg (wheat per 40 kg). Retail prices are usually higher."}>
      {!cities.length ? <p className="empty">{ur ? "نرخ اس وقت دستیاب نہیں۔" : "Prices are temporarily unavailable."}</p> : (
        <>
          <div className="table-scroll">
            <table className="util-table">
              <thead><tr><th>{ur ? "جنس" : "Item"}</th><th>{ur ? "اکائی" : "Unit"}</th>{cities.map((c) => <th key={c.key}>{ur ? c.ur : MANDI_CITY_EN[c.key]}</th>)}</tr></thead>
              <tbody>
                {MANDI_ITEMS.filter((it) => cities.some((c) => m.prices[c.key][it.key])).map((it) => (
                  <tr key={it.key}><th scope="row">{ur ? it.ur : MANDI_EN[it.key].replace(" (per 40 kg)", "")}</th><td className="unit-cell">{mandiUnit(it)[lang]}</td>{cities.map((c) => <td key={c.key} dir="ltr">{m.prices[c.key][it.key] ? money(m.prices[c.key][it.key], 0) : "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rates-note">{ur ? "قیمتیں روپے میں ہیں۔ (—) کا مطلب ہے کہ اس منڈی کا نرخ آج دستیاب نہیں یا ماخذ میں واضح نہیں۔" : "Prices are in Pakistani rupees. A dash (—) means that market's price is not available today or not clear in the source."}</p>
          <p className="rates-note">{ur ? "ماخذ: زرعی مارکیٹنگ انفارمیشن سروس پنجاب (AMIS)" : "Source: Agriculture Marketing Information Service, Punjab (AMIS)"}{asOf && <> · {ur ? "نرخ بمطابق" : "Rates as of"}: {asOf}</>}</p>
        </>
      )}
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
