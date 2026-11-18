import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getRates } from "@/lib/rates";
import { getHomepage, getCategory } from "@/lib/queries";
import { getKse } from "@/lib/psx";
import { updateFuelFromNews, getFuel } from "@/lib/fuel";
import { cleanUrdu } from "@/lib/urdu";
import { getMandi } from "@/lib/mandi";
import DailyCards from "@/components/DailyCards";
import { SITE } from "@/lib/site";

export const revalidate = 1800;

export const metadata = {
  title: "روزانہ کارڈز: کرنسی، سونا، نماز کے اوقات اور اہم خبریں",
  description: "آج کے کرنسی ریٹ، سونے کا نرخ، حنفی، شافعی اور جعفری نماز کے اوقات اور اہم خبریں — تصویر یا PDF میں محفوظ کریں اور شیئر کریں۔",
  alternates: { canonical: "/ur/daily" },
};

export default async function DailyPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  try { await updateFuelFromNews(); } catch {}
  const [rates, home, fuel, mandi, kse, sportsList] = await Promise.all([
    getRates().catch(() => null),
    getHomepage().catch(() => null),
    getFuel(),
    getMandi().catch(() => null),
    getKse(),
    getCategory("sports", 40).catch(() => []),
  ]);
  const since = Date.now() - 36 * 3600e3;
  const recent = (home?.latest || []).filter((a) => a.translations?.ur?.title && new Date(a.publishedAt).getTime() > since);
  const pick = (cats) => recent.filter((a) => cats.includes(a.category)).slice(0, 7).map((a) => ({ title: cleanUrdu(a.translations.ur.title) }));
  const data = {
    fx: (rates?.fx || []).map(({ code, ur, pkr, prev }) => ({ code, ur, pkr, prev })),
    gold: rates?.gold ? { ...rates.gold, at: rates.gold.at ? new Date(rates.gold.at).toISOString() : null } : null,
    silver: rates?.silver || null,
    pakistan: pick(["pakistan", "politics", "economy"]),
    // Pakistan sports only: stories that mention Pakistan / national teams / PSL / PCB
    sports: (sportsList || []).filter((a) => a.translations?.ur?.title && new Date(a.publishedAt).getTime() > Date.now() - 48 * 3600e3)
      .filter((a) => /pakistan|pcb|psl|babar|shaheen|rizwan|green shirts/i.test(`${a.translations?.en?.title} ${(a.tags || []).join(" ")}`) || /پاکستان|قومی ٹیم|پی ایس ایل|شاہین|بابر/.test(a.translations.ur.title))
      .slice(0, 7).map((a) => ({ title: cleanUrdu(a.translations.ur.title) })),
    kse: kse || null,
    mandi: mandi?.prices ? { prices: mandi.prices, asOf: new Date(mandi.changedAt || mandi.fetchedAt).toISOString() } : null,
    fxDate: rates?.date || null,
    fuel: fuel ? { petrol: fuel.petrol, diesel: fuel.diesel, effective: fuel.effective, source: fuel.source, sourceAt: fuel.sourceAt ? new Date(fuel.sourceAt).toISOString() : null } : null,
  };
  return (
    <div className="wrap daily-page lang-ur-block" dir="rtl" lang="ur">
      <h1 className="page-title">روزانہ کارڈز</h1>
      <p className="daily-lede">آج کے کرنسی ریٹ، سونے کا نرخ، نماز، سحر و افطار کے اوقات (اہلِ سنت اور فقہ جعفریہ)، منڈی کے نرخ، اور پاکستان و دنیا کی اہم خبریں — ہر کارڈ HD تصویر میں محفوظ کریں یا سب ایک PDF میں۔ واٹس ایپ چینل، فیس بک اور انسٹاگرام کے لیے تیار۔</p>
      <DailyCards data={data} links={{ whatsapp: SITE.social.whatsapp, site: SITE.url }} />
    </div>
  );
}
