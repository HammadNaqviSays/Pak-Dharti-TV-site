"use client";
import { useEffect, useMemo, useState } from "react";

const PK = ["pakistan", "politics", "economy"];

/**
 * The top of the home page: the hottest recent stories, rotating every 7 seconds.
 * Order adapts to the reader: in Pakistan, Pakistan news first; elsewhere, stories that mention
 * the reader's country, then world news, mixed with Pakistan's biggest stories.
 */
export default function LeadSlider({ items, lang }) {
  const [country, setCountry] = useState(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch("/api/geo").then((r) => r.json()).then((g) => setCountry(g?.country || "")).catch(() => setCountry(""));
  }, []);

  const ordered = useMemo(() => {
    if (country === null) return items;
    let countryName = "";
    try { countryName = new Intl.DisplayNames(["en"], { type: "region" }).of(country) || ""; } catch {}
    const score = (a, idx) => {
      let s = -idx; // keep the hotness order as the base
      if (country === "PK") { if (PK.includes(a.category)) s += 10; }
      else {
        if (countryName && a.titleEn?.toLowerCase().includes(countryName.toLowerCase())) s += 20;
        if (a.category === "world") s += 6;
      }
      return s;
    };
    return items.map((a, idx) => ({ a, s: score(a, idx) })).sort((x, y) => y.s - x.s).map((x) => x.a);
  }, [items, country]);

  useEffect(() => { setI(0); }, [country]);
  useEffect(() => {
    if (paused || ordered.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % ordered.length), 7000);
    return () => clearInterval(t);
  }, [paused, ordered.length]);

  const a = ordered[i] || ordered[0];
  if (!a) return null;
  return (
    <div className="lead-slider" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <article className="story story-lead" lang={a.fallback ? "en" : undefined}>
        <a href={a.href} className="story-link">
          {a.img && <div className="story-img"><img key={a.img} src={a.img} alt="" className="lead-fade" /></div>}
          <div className="story-body">
            <div className="kicker"><span className="kicker-cat">{a.cat}</span>{a.type && <span className="kicker-type">{a.type}</span>}</div>
            <h2 className="story-title">{a.title}</h2>
            {a.summary && <p className="story-summary">{a.summary}</p>}
            {a.time && <time className="story-time" dir={lang === "ar" ? "rtl" : "ltr"}>{a.time}</time>}
          </div>
        </a>
      </article>
      {ordered.length > 1 && (
        <div className="lead-dots" role="tablist" aria-label="Top stories">
          {ordered.map((x, n) => (
            <button key={x.href} role="tab" aria-selected={n === i} aria-label={x.title} className={n === i ? "on" : ""} onClick={() => { setI(n); setPaused(true); }} />
          ))}
        </div>
      )}
    </div>
  );
}
