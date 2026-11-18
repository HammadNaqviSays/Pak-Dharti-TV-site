import { getRates, money } from "@/lib/rates";
import { getFuel } from "@/lib/fuel";
import { peekKse } from "@/lib/psx";
import { peekOil } from "@/lib/oil";

const pct = (now, prev) => (prev ? ((now - prev) / prev) * 100 : null);

function FxLayer({ type }) {
  const body = {
    gold: [10, 28, 52, 74, 88].map((l, k) => <i key={k} style={{ left: `${l}%`, top: `${[62, 30, 70, 24, 56][k]}%`, "--d": `${k * 0.55}s` }} />),
    usd: [14, 40, 66, 86].map((l, k) => <i key={k} style={{ left: `${l}%`, "--d": `${k * 0.9}s` }}>$</i>),
    fill: <><i className="lq" /><i className="wv" /></>,
    drain: <><i className="lq" /><i className="wv" /></>,
    chart: (
      <svg viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="0,34 14,28 26,31 40,18 54,22 68,10 82,14 100,3" pathLength="100" /></svg>
    ),
    stars: [12, 34, 58, 82].map((l, k) => <i key={k} style={{ left: `${l}%`, top: `${[58, 24, 66, 34][k]}%`, "--d": `${k * 0.7}s` }}>✦</i>),
  }[type];
  return <span className={`rs-fx rs-fx-${type}`} aria-hidden="true">{body}</span>;
}

/** Row of today's key rates under the ticker: icon, label, value, daily change. Each tile links to its own page. */
export default async function RateStrip({ lang }) {
  const ur = lang === "ur";
  const [rates, fuel, kse, oil] = await Promise.all([getRates().catch(() => null), getFuel().catch(() => null), peekKse(), peekOil()]);
  const usd = rates?.fx?.find((c) => c.code === "USD");
  const items = [
    rates?.gold && { href: "gold-rate", icon: "🪙", ic: "spin", fx: "gold", k: ur ? "سونا · 24 قیراط · تولہ" : "Gold · 24K · tola", v: money(rates.gold.tola24), u: "PKR" },
    usd && { href: "dollar-rate", icon: "💵", ic: "bob", fx: "usd", k: ur ? "امریکی ڈالر" : "US Dollar", v: money(usd.pkr, 2), u: "PKR", ch: pct(usd.pkr, usd.prev) },
    fuel?.petrol && { href: "petrol-price", icon: "⛽", ic: "beat", fx: "fill", k: ur ? "پیٹرول · فی لیٹر" : "Petrol · per litre", v: money(fuel.petrol, 2), u: "PKR" },
    kse?.close && { href: "psx", icon: "📈", ic: "rise", fx: "chart", k: "KSE-100", v: money(kse.close, 0), ch: Number.isFinite(kse.pct) ? kse.pct : null },
    oil?.brent?.price && { href: "petrol-price", icon: "🛢️", ic: "wobble", fx: "drain", k: ur ? "برینٹ خام تیل · بیرل" : "Brent crude · barrel", v: money(oil.brent.price, 2), u: "USD", ch: pct(oil.brent.price, oil.brent.prev) },
    { href: "prayer-times", icon: "🕌", fx: "stars", k: ur ? "نماز کے اوقات" : "Prayer times", cta: ur ? "اوقات دیکھیں" : "View timings" },
  ].filter(Boolean);
  if (items.length < 2) return null;
  return (
    <div className="wrap">
      <nav className="rate-strip" aria-label={ur ? "آج کے نرخ" : "Today's rates"}>
        {items.map((i, n) => (
          <a key={i.href + i.k} href={`/${lang}/${i.href}`} className={i.cta ? "rs-cta" : undefined} style={{ "--i": n }}>
            <span className="rs-shine" aria-hidden="true" />
            {i.fx && <FxLayer type={i.fx} />}
            <span className="rs-icon" aria-hidden="true"><span className={`rs-ic ${i.ic || ""}`}>{i.icon}</span></span>
            <span className="rs-k">{i.k}</span>
            {i.cta ? <b className="rs-go">{i.cta} <span aria-hidden="true">{ur ? "←" : "→"}</span></b> : (
              <b className="rs-v" dir="ltr">{i.v}<small>{i.u}</small></b>
            )}
            {i.ch != null && Math.abs(i.ch) >= 0.005 && (
              <span className={`rs-ch ${i.ch > 0 ? "up" : "down"}`} dir="ltr">{i.ch > 0 ? "▲" : "▼"} {Math.abs(i.ch).toFixed(2)}%</span>
            )}
          </a>
        ))}
      </nav>
    </div>
  );
}
