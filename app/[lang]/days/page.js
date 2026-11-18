import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { PEOPLE, daysSince, pkDay } from "@/lib/daycount";

export const revalidate = 3600;

export const metadata = {
  title: "جیل میں دن: روزانہ شمار",
  description: "قید کے دنوں کا روزانہ شمار — ہر روز پاکستانی وقت کے مطابق 11 بجے اپ ڈیٹ۔",
  alternates: { canonical: "/ur/days" },
};

export default async function DaysPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const day = pkDay();
  return (
    <div className="wrap daily-page lang-ur-block" dir="rtl" lang="ur">
      <h1 className="page-title">قید کے دنوں کا شمار</h1>
      <p className="daily-lede">ہر روز پاکستانی وقت کے مطابق 11 بجے نیا کارڈ جاری ہوتا ہے۔</p>
      {PEOPLE.filter((p) => p.on).map((p) => (
        <section key={p.id} style={{ margin: "24px 0", textAlign: "center" }}>
          <h2>{p.ur} — {daysSince(p.start)} دن</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/card/days_${p.id}?d=${day}`} alt={`${p.ur} کو جیل میں ${daysSince(p.start)} دن ہو گئے`} width={1080} height={1093} style={{ maxWidth: "100%", height: "auto", borderRadius: 12 }} />
        </section>
      ))}
    </div>
  );
}
