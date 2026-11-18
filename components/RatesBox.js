import { W } from "@/lib/widgetText";
import { money } from "@/lib/rates";

const FEATURED = ["AED", "SAR", "USD", "GBP", "EUR", "QAR", "KWD", "OMR"];
const MINI = ["USD", "EUR", "GBP", "SAR", "AED"];

function Arrow({ now, prev }) {
  if (!prev || !now) return null;
  const d = (now - prev) / prev;
  if (Math.abs(d) < 0.0005) return <span className="fx-flat" aria-hidden="true">•</span>;
  return d > 0 ? <span className="fx-up" title="▲">▲</span> : <span className="fx-down" title="▼">▼</span>;
}

/** Sidebar box: gold per tola and five main currencies. */
export function RatesMini({ lang, rates }) {
  const w = W[lang];
  if (!rates) return null;
  const g = rates.gold;
  return (
    <section className="side-box rates-mini">
      <h2 className="side-title">{w.rates}</h2>
      {g && (
        <div className="gold-mini">
          <span className="gold-mini-label">{w.gold} · {w.k24} · {w.perTola}</span>
          <strong dir="ltr">Rs {money(g.tola24)} <Arrow now={g.tola24} prev={g.prevTola24} /></strong>
          <span className="gold-mini-sub">{w.k22}: <b dir="ltr">Rs {money(g.tola22)}</b></span>
        </div>
      )}
      <table className="fx-mini">
        <tbody>
          {rates.fx.filter((c) => MINI.includes(c.code)).map((c) => (
            <tr key={c.code}>
              <th scope="row"><span aria-hidden="true">{c.flag}</span> {c[lang] || c.en}</th>
              <td dir="ltr">{money(c.pkr, 2)} <Arrow now={c.pkr} prev={c.prev} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <a className="side-more" href={`/${lang}/rates`}>{w.seeAll} {lang === "ur" || lang === "ar" ? "←" : "→"}</a>
    </section>
  );
}

/** Full tables for the rates page. */
export function RatesTables({ lang, rates }) {
  const w = W[lang];
  if (!rates) return <p className="empty">{w.unavailable}</p>;
  const g = rates.gold;
  return (
    <>
      {g && (
        <section className="rates-section">
          <h2 className="sec-title">{w.gold}</h2>
          <div className="gold-cards">
            {[["k24", g.tola24], ["k22", g.tola22], ["k21", g.tola21], ["k18", g.tola18]].map(([k, v]) => (
              <div key={k} className={`gold-card ${k}`}>
                <span className="gc-k">{w[k]}</span>
                <strong dir="ltr">Rs {money(v)}</strong>
                <span className="gc-u">{w.perTola}</span>
                <span className="gc-s" dir="ltr">Rs {money((v / 11.6638) * 10)} <small>/ 10g</small></span>
              </div>
            ))}
          </div>
          <p className="rates-note">
            {g.source === "sarafa" ? w.sarafa : w.intl}
            {g.ounceUsd ? <> · {w.ounce}: <b dir="ltr">${money(g.ounceUsd, 2)}</b></> : null}
          </p>
          {rates.silver && (
            <p className="silver-line">{w.silver}: <b dir="ltr">Rs {money(rates.silver.tola)}</b> {w.perTola} · <b dir="ltr">Rs {money(rates.silver.gram * 10)}</b> {w.per10g}</p>
          )}
        </section>
      )}
      {rates.fx.length > 0 && (
        <section className="rates-section">
          <h2 className="sec-title">{w.currency}</h2>
          <div className="fx-cards">
            {FEATURED.map((code) => rates.fx.find((c) => c.code === code)).filter(Boolean).map((c) => (
              <div key={c.code} className={`fx-card${c.code === "AED" ? " fx-card-hero" : ""}`}>
                <span className="fxc-flag" aria-hidden="true">{c.flag}</span>
                <span className="fxc-name">{c[lang] || c.en}</span>
                <strong dir="ltr">{money(c.pkr, c.pkr < 10 ? 3 : 2)} <small>PKR</small></strong>
                <span className="fxc-meta" dir="ltr"><span className="fx-code">{c.code}</span> <Arrow now={c.pkr} prev={c.prev} /></span>
              </div>
            ))}
          </div>
          <div className="table-scroll">
            <table className="fx-table">
              <thead><tr><th>{w.currency}</th><th>{w.buyOne}</th></tr></thead>
              <tbody>
                {rates.fx.map((c) => (
                  <tr key={c.code}>
                    <th scope="row"><span aria-hidden="true">{c.flag}</span> {c[lang] || c.en} <span className="fx-code">{c.code}</span></th>
                    <td dir="ltr">{money(c.pkr, c.pkr < 10 ? 3 : 2)} <Arrow now={c.pkr} prev={c.prev} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rates-note">{w.fxNote} {rates.date && <>{w.updated}: <span dir="ltr">{rates.date}</span></>}</p>
        </section>
      )}
    </>
  );
}
