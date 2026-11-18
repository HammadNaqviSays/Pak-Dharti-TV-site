"use client";
import { useMemo, useState } from "react";

/** Converts between rupees and the listed currencies, using the day's rates (PKR per unit). */
export default function CurrencyCalc({ lang, fx, t }) {
  const list = useMemo(() => [{ code: "PKR", flag: "🇵🇰", name: lang === "ur" ? "پاکستانی روپیہ" : lang === "ar" ? "روبية باكستانية" : lang === "de" ? "Pakistanische Rupie" : "Pakistani Rupee", pkr: 1 },
    ...fx.map((c) => ({ code: c.code, flag: c.flag, name: c[lang] || c.en, pkr: c.pkr }))], [fx, lang]);
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("PKR");
  const rate = (code) => list.find((c) => c.code === code)?.pkr || 1;
  const n = Number(String(amount).replace(/,/g, "")) || 0;
  const result = (n * rate(from)) / rate(to);
  const fmt = (v) => new Intl.NumberFormat("en-US", { maximumFractionDigits: v < 1 ? 4 : 2 }).format(v);
  const opt = (c) => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>;

  return (
    <div className="calc">
      <label className="calc-amt">{t.amount}
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
      </label>
      <label>{t.from}<select value={from} onChange={(e) => setFrom(e.target.value)}>{list.map(opt)}</select></label>
      <button type="button" className="calc-swap" onClick={() => { setFrom(to); setTo(from); }} aria-label={t.swap} title={t.swap}>⇄</button>
      <label>{t.to}<select value={to} onChange={(e) => setTo(e.target.value)}>{list.map(opt)}</select></label>
      <output className="calc-out" dir="ltr">
        {fmt(n)} {from} = <strong>{fmt(result)} {to}</strong>
        <small>1 {from} = {fmt(rate(from) / rate(to))} {to}</small>
      </output>
    </div>
  );
}
