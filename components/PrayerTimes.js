"use client";
import { useEffect, useMemo, useState } from "react";
import { prayerTimes, todayIn, methodFor, METHODS, CITIES } from "@/lib/prayTimes";

const KEY = "pd-prayer-place";
const ORDER = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
const DEFAULT = CITIES[0]; // Islamabad

function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }

/**
 * Prayer times for the visitor's city (found from their connection, or their device if they allow it).
 * variant: "mini" for the sidebar, "full" for the prayer-times page.
 */
export default function PrayerTimes({ lang, t, variant = "mini" }) {
  const [place, setPlace] = useState(null);       // { lat, lng, tz, city, country, label }
  const [asrSchool, setAsrSchoolState] = useState(null);
  const setAsrSchool = (v) => { setAsrSchoolState(v); try { localStorage.setItem("pd-prayer-school", v); } catch {} };
  useEffect(() => { try { const v = localStorage.getItem("pd-prayer-school"); if (v) setAsrSchoolState(v); } catch {} }, []);
  const [now, setNow] = useState(() => Date.now());
  const [locating, setLocating] = useState(false);

  // Where is the reader? Saved choice → Vercel's location headers → Islamabad
  useEffect(() => {
    const saved = load();
    if (saved?.lat) { setPlace(saved); return; }
    fetch("/api/geo").then((r) => r.json()).then((g) => {
      if (g?.lat) {
        const known = CITIES.find((c) => c.n.toLowerCase() === String(g.city).toLowerCase());
        setPlace({ ...g, tz: g.tz || Intl.DateTimeFormat().resolvedOptions().timeZone, label: known && lang === "ur" ? known.ur : g.city });
      }
      else setPlace(cityPlace(DEFAULT));
    }).catch(() => setPlace(cityPlace(DEFAULT)));
  }, []);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);

  function cityPlace(c) { return { lat: c.lat, lng: c.lng, tz: c.tz, country: c.c, city: c.n, label: lang === "ur" ? c.ur : c.n }; }
  function choose(p) { setPlace(p); save(p); }

  function useDevice() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocating(false);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      choose({ lat: pos.coords.latitude, lng: pos.coords.longitude, tz, country: place?.country || "", city: "", label: `📍 ${t.myLocation}` });
    }, () => setLocating(false), { timeout: 10000, maximumAge: 3600e3 });
  }

  const school = asrSchool === "jafari" ? "jafari" : "hanafi";
  const method = place ? methodFor(place.country) : "karachi";

  const data = useMemo(() => {
    if (!place) return null;
    const day = todayIn(place.tz);
    const times = prayerTimes(day, place.lat, place.lng, { method, asr: school });
    // after Isha, the next prayer is tomorrow's Fajr
    const tomorrow = prayerTimes(todayIn(place.tz, 1), place.lat, place.lng, { method, asr: school });
    const upcoming = ORDER.filter((k) => k !== "sunrise").map((k) => [k, times[k]]).find(([, d]) => d.getTime() > now)
      || ["fajr", tomorrow.fajr];
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: place.tz }).format(new Date(now));
    return { times, upcoming, friday: weekday === "Fri" };
  }, [place, method, school, now]);

  const fmt = (d) => new Intl.DateTimeFormat(lang === "ur" || lang === "en" ? "en-US" : lang, { hour: "numeric", minute: "2-digit", timeZone: place.tz }).format(d);
  const left = (d) => {
    const m = Math.max(0, Math.round((d.getTime() - now) / 60000));
    const h = Math.floor(m / 60), mm = m % 60;
    const U = { ur: ["گھنٹے", "منٹ"], ar: ["س", "د"], de: ["Std", "Min"], en: ["h", "m"] }[lang] || ["h", "m"];
    const sep = lang === "en" ? "" : " ";
    return h ? `${h}${sep}${U[0]} ${mm}${sep}${U[1]}` : `${mm}${sep}${U[1]}`;
  };
  const dateLabel = place ? new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : lang, { weekday: "long", day: "numeric", month: "long", timeZone: place.tz }).format(new Date(now)) : "";

  return (
    <section className={`side-box prayer prayer-${variant}`} aria-live="polite">
      <h2 className="side-title">{t.prayer}</h2>
      {!data ? <p className="prayer-wait">{t.detecting}</p> : (
        <>
          <div className="prayer-place">
            <span className="pp-city">{place.label || place.city || "📍"}</span>
            <span className="pp-date">{dateLabel}</span>
          </div>
          <div className="prayer-next">
            <span>{t.next}: <b>{t.names[data.upcoming[0] === "dhuhr" && data.friday ? "jumuah" : data.upcoming[0]]}</b></span>
            <span className="pn-time"><span dir="ltr">{fmt(data.upcoming[1])}</span> · {left(data.upcoming[1])}</span>
          </div>
          {variant === "full" && <h3 className="side-title prayer-sub">{t.farzHead}</h3>}
          <ul className="prayer-list">
            {ORDER.map((k) => (
              <li key={k} className={`${k === data.upcoming[0] ? "on" : ""} ${k === "sunrise" ? "dim" : ""}`}>
                <span>{t.names[k === "dhuhr" && data.friday ? "jumuah" : k]}</span>
                <time dir="ltr">{fmt(data.times[k])}</time>
              </li>
            ))}
          </ul>
          <div className="prayer-tools">
            <select aria-label={t.city} value="" onChange={(e) => { const c = CITIES[+e.target.value]; if (c) choose(cityPlace(c)); }}>
              <option value="">{t.city}…</option>
              {CITIES.map((c, i) => <option key={c.n} value={i}>{lang === "ur" ? c.ur : c.n}</option>)}
            </select>
            <button type="button" onClick={useDevice} disabled={locating}>{locating ? "…" : `📍 ${t.useLoc}`}</button>
          </div>
          {variant === "full" && (
            <div className="prayer-opts">
              <label>{t.asr}:{" "}
                <select value={school} onChange={(e) => setAsrSchool(e.target.value)}>
                  <option value="hanafi">{t.hanafi}</option><option value="jafari">{t.jafari}</option>
                </select>
              </label>
              <span className="muted">{t.method}: {METHODS[school === "jafari" ? "jafari" : method].name}</span>
            </div>
          )}
          {variant === "full" && (
            <>
              <h3 className="side-title prayer-sub">{t.naflHead}</h3>
              <ul className="prayer-list">
                <li><span>{t.tahajjud}</span><time dir="ltr">{fmt(data.times.tahajjud)}</time></li>
                <li><span>{t.ishraq}</span><time dir="ltr">{fmt(data.times.ishraq)}</time></li>
                <li><span>{t.chasht}</span><time dir="ltr">{fmt(data.times.chasht)}</time></li>
                <li className="dim"><span>{t.zawal}</span><time dir="ltr">{fmt(data.times.zawal)}</time></li>
              </ul>
              <h3 className="side-title prayer-sub">{t.rozaHead}</h3>
              <ul className="prayer-list">
                <li><span>{t.sehri}</span><time dir="ltr">{fmt(school === "jafari" ? data.times.imsak : data.times.fajr)}</time></li>
                <li><span>{t.iftar}</span><time dir="ltr">{fmt(data.times.maghrib)}</time></li>
              </ul>
              <p className="prayer-note">{t.naflNote}</p>
            </>
          )}
          <p className="prayer-note">{t.approx}</p>
        </>
      )}
      {variant === "mini" && <a className="side-more" href={`/${lang}/prayer-times`}>{t.allTimes} {lang === "ur" || lang === "ar" ? "←" : "→"}</a>}
    </section>
  );
}
