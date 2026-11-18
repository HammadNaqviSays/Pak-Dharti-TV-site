// Daily cards drawn on the SERVER, so they can be posted automatically.
// Design = the browser cards of lib/dailyCards.js. Their fixed parts (background, ribbon, panel, flags, Urdu words) were drawn once in a real
// browser and saved as pictures (public/cardkit/bg_*.jpg, l_*.png — built by scripts/cardkit); Satori cannot shape Urdu itself.
// Here we only lay the LIVE parts on top: Latin numbers, arrows, and the date / status lines built from ready-made Urdu word pictures.
// Output: PNG from next/og, converted to JPEG with sharp (Instagram needs JPEG).
import React from "react";
import { ImageResponse } from "next/og";
import { getRates } from "./rates";
import { getFuel } from "./fuel";
import { getKse } from "./psx";
import { prayerTimes, todayIn } from "./prayTimes";
import { tradingDay, fuelStatus, marketAsOf } from "./asOf";
import { PEOPLE, daysSince } from "./daycount";

const h = React.createElement;
const W = 1080, H = 1350, TZ = "Asia/Karachi";
const INK = "#151515", MUTED = "#6B6B6B", DEEP = "#4C0000";

const num = (v, d = 0) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

async function loadAssets(origin, withSerif) {
  const [fontRes, manRes, serifRes] = await Promise.all([
    fetch(`${origin}/fonts/latin/DejaVuSans-Bold.ttf`, { cache: "no-store" }),
    fetch(`${origin}/cardkit/manifest.json`, { cache: "no-store" }),
    withSerif ? fetch(`${origin}/fonts/latin/DejaVuSerif-Bold.ttf`, { cache: "no-store" }) : Promise.resolve(null),
  ]);
  if (!fontRes.ok || !manRes.ok || (serifRes && !serifRes.ok)) throw new Error("card assets missing");
  return { font: await fontRes.arrayBuffer(), serif: serifRes ? await serifRes.arrayBuffer() : null, manifest: await manRes.json(), origin };
}

// ---------------------------------------------------------------- building blocks
const abs = (style, ...kids) => h("div", { style: { display: "flex", position: "absolute", ...style } }, ...kids);

// a Latin text placed by its anchor: left / center / right edge at x, vertically centred on cy
function txt(text, { x, cy, size, color = INK, align = "left", weight = 800 }) {
  const box = { height: size * 2, top: cy - size, alignItems: "center", fontSize: size, color, fontWeight: weight, whiteSpace: "pre" };
  if (align === "left") return abs({ ...box, left: x }, text);
  if (align === "right") return abs({ ...box, right: W - x, justifyContent: "flex-end" }, text);
  return abs({ ...box, left: x - 500, width: 1000, justifyContent: "center" }, text);
}

const img = (A, key) => {
  const m = A.manifest[key];
  if (!m) throw new Error(`label ${key} missing`);
  return h("img", { src: `${A.origin}/cardkit/l_${key}.png`, width: m.w, height: m.h });
};
// a label centred on (cx, cy) — cy is the y given to the old canvas ur() call (text baseline "middle" + size*0.08)
const label = (A, key, cx, cy) => {
  const m = A.manifest[key];
  return abs({ left: cx - m.w / 2, top: Math.round(cy + m.size * 0.08 - m.h / 2) }, img(A, key));
};
// pills have their text centred in the box itself
const pill = (A, key, cy) => {
  const m = A.manifest[`pill_${key}`];
  if (!m) return null;
  return abs({ left: W / 2 - m.w / 2, top: cy - m.h / 2 }, img(A, `pill_${key}`));
};

// number written with the digit pictures (left to right)
const digits = (A, n) => h("div", { style: { display: "flex" } },
  ...String(n).split("").map((c, i) => h("div", { key: i, style: { display: "flex", margin: "0 -2px" } }, img(A, `d_${c}`))));

const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function dateParts(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { wd: WD[p.weekday], day: Number(p.day), mo: Number(p.month), year: Number(p.year) };
}

// "<prefix> پیر، 9 نومبر، 2026" under the ribbon, centred at y = 212 (as the old frame drew it)
function dateLine(A, date, prefixKey) {
  const p = dateParts(date);
  const items = [prefixKey ? img(A, prefixKey) : null, img(A, `wd_${p.wd}`), img(A, "comma"), digits(A, p.day), img(A, `mo_${p.mo}`), img(A, "comma"), digits(A, p.year)].filter(Boolean);
  const hh = 120;
  return abs({ left: 0, top: 212 + Math.round(46 * 0.08) - hh / 2, width: W, height: hh, justifyContent: "center", alignItems: "center" },
    h("div", { style: { display: "flex", flexDirection: "row-reverse", alignItems: "center" } },
      ...items.map((it, i) => h("div", { key: i, style: { display: "flex", margin: "0 1px" } }, it))));
}

const frame = (A, bg, children) => h("div", { style: { display: "flex", position: "relative", width: W, height: H, fontFamily: "Lat" } },
  h("img", { src: `${A.origin}/cardkit/bg_${bg}.jpg`, width: W, height: H, style: { position: "absolute", left: 0, top: 0 } }),
  ...children.filter(Boolean));

const PILL = {
  "ہفتہ وار تعطیل — نئے ریٹ پیر کو آئیں گے": "weekend", "آج کے تازہ ریٹ": "today", "نئے ریٹ آنے تک یہی ریٹ نافذ ہیں": "hold",
  "آج کی سرکاری قیمت — اوگرا روزانہ قیمت جاری کرتا ہے": "fuel_today", "ہفتہ وار تعطیل — جمعہ کی قیمتیں پیر تک برقرار": "fuel_weekend",
  "نئی قیمت کا اعلان متوقع — اوگرا روزانہ قیمت جاری کرتا ہے": "fuel_wait",
};
const noonUtc = (ymd) => new Date(`${ymd}T12:00:00Z`);
const ymdNow = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

// ---------------------------------------------------------------- cards
async function currencyTree(A) {
  const rates = await getRates();
  if (!rates?.fx?.length) throw new Error("no currency data");
  const want = ["USD", "EUR", "GBP", "SAR", "AED", "QAR", "KWD", "OMR", "BHD", "CAD", "AUD", "CNY"];
  const as = rates.date ? marketAsOf(tradingDay(rates.date)) : null;
  const asOf = as?.day || new Date();
  const rh = 58, y0 = 366, px = 60;
  const kids = [dateLine(A, asOf, "pre_rate")];
  want.forEach((code, i) => {
    const c = rates.fx.find((x) => x.code === code);
    if (!c) return;
    const cy = y0 + i * rh + rh / 2;
    kids.push(txt(num(c.pkr, 2), { x: px + 40, cy, size: 38 }));
    // currency code in its own straight column, left of the longest name, with a clear gap
    kids.push(txt(code, { x: 690, cy, size: 24, color: "#8A8A8A", align: "center", weight: 700 }));
    if (c.prev) {
      const d = c.pkr - c.prev;
      if (Math.abs(d / c.prev) >= 0.0005) {
        const up = d > 0;
        kids.push(abs({ left: px + 250 - 11, top: cy - 9.5 }, h("svg", { width: 22, height: 19, viewBox: "0 0 22 19" },
          h("path", { d: up ? "M11 0 L22 19 L0 19 Z" : "M0 0 L22 0 L11 19 Z", fill: up ? "#138A3E" : "#C21B1B" }))));
      }
    }
  });
  if (as) kids.push(pill(A, PILL[as.status], y0 + want.length * rh + 38));
  return frame(A, "currency", kids);
}

async function goldTree(A) {
  const rates = await getRates();
  const g = rates?.gold;
  if (!g?.tola24) throw new Error("no gold data");
  const sarafa = g.source === "sarafa";
  const as = sarafa && g.at ? marketAsOf(g.at) : rates.date ? marketAsOf(tradingDay(rates.date)) : null;
  const asOf = as?.day || new Date();
  const kids = [dateLine(A, asOf, "pre_rate"),
    txt(`Rs ${num(g.tola24)}`, { x: W / 2, cy: 422, size: 92, color: "#2B1F00", align: "center", weight: 900 }),
    txt(`Rs ${num(g.tenGram24)}  / 10 gram`, { x: W / 2, cy: 492, size: 30, color: "#3A2A00", align: "center", weight: 700 })];
  const s = rates.silver;
  const rows = [[g.tola22, (g.tola22 / 11.6638) * 10], [g.tola21, (g.tola21 / 11.6638) * 10], [g.tola18, (g.tola18 / 11.6638) * 10], [s?.tola, s?.gram ? s.gram * 10 : null]];
  rows.forEach(([tola, ten], i) => {
    const cy = 642 + i * 82 + 41;
    kids.push(txt(tola ? `Rs ${num(tola)}` : "—", { x: W / 2 + 40, cy, size: 40, align: "center" }));
    kids.push(txt(ten ? `Rs ${num(ten)}` : "—", { x: 60 + 150, cy, size: 34, color: "#333", align: "center", weight: 700 }));
  });
  if (g.ounceUsd) kids.push(txt(`International: $${num(g.ounceUsd, 2)} / ounce`, { x: W / 2, cy: 1050, size: 24, color: "#222", align: "center", weight: 800 }));
  if (as) kids.push(pill(A, PILL[as.status], 1108));
  return frame(A, sarafa ? "gold_sarafa" : "gold_intl", kids);
}

async function fuelTree(A) {
  const f = await getFuel();
  if (!f?.petrol || !f?.diesel) throw new Error("no fuel data");
  const since = f.effective ? noonUtc(f.effective) : f.sourceAt ? new Date(f.sourceAt) : null;
  const kids = [since ? dateLine(A, since, "pre_eff") : null,
    txt(`Rs ${num(f.petrol, 2)}`, { x: W / 2, cy: 452, size: 88, color: "#fff", align: "center", weight: 900 }),
    txt(`Rs ${num(f.diesel, 2)}`, { x: W / 2, cy: 722, size: 88, color: "#fff", align: "center", weight: 900 }),
    pill(A, PILL[fuelStatus(f.effective)], 852)];
  return frame(A, "fuel", kids);
}

async function kseTree(A) {
  const k = await getKse();
  if (!k?.close) throw new Error("no KSE data");
  const up = (k.change ?? 0) >= 0;
  const isToday = k.day === ymdNow();
  const kids = [dateLine(A, noonUtc(k.day), "pre_kse"),
    label(A, k.live ? "kse_state_live" : "kse_state_close", W / 2, 334),
    txt(num(k.close, 2), { x: W / 2, cy: 422, size: 100, color: "#fff", align: "center", weight: 900 })];
  if (k.change != null) {
    const sign = up ? "+" : "−";
    kids.push(txt(`${up ? "▲" : "▼"} ${sign}${num(Math.abs(k.change), 2)}  (${sign}${num(Math.abs(k.pct), 2)}%)`, { x: W / 2, cy: 504, size: 44, color: "#fff", align: "center" }));
    kids.push(label(A, `kse_${up ? "up" : "down"}${isToday ? "_today" : ""}`, W / 2, 554));
  }
  [k.open, k.high, k.low, k.prevClose].forEach((v, i) => kids.push(txt(v ? num(v, 2) : "—", { x: 120, cy: 631 + i * 84 + 42, size: 42 })));
  kids.push(pill(A, isToday ? (k.live ? "kse_live" : "kse_done") : "kse_old", 1017));
  return frame(A, up ? "kse_up" : "kse_down", kids);
}

// Cities far enough apart that their prayer times differ by several minutes
const PK_CITIES = [[24.8607, 67.0011], [30.1798, 66.975], [30.1575, 71.5249], [31.5204, 74.3587], [33.6844, 73.0479], [34.0151, 71.5249], [35.9208, 74.308]];
const hm = (d) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).format(d).replace(/\s?[AP]M$/, "");
const FARZ = [(s) => s.fajr, (s, j) => j.fajr, (s) => s.sunrise, (s) => s.dhuhr, (s) => s.asr, (s, j) => j.asr, (s) => s.maghrib, (s, j) => j.maghrib, (s) => s.isha, (s, j) => j.isha];
const FARZ_DIM = [2];
const NAFL = [(s) => s.tahajjud, (s) => s.ishraq, (s) => s.chasht, (s) => s.zawal, (s) => s.fajr, (s, j) => j.imsak, (s) => s.maghrib, (s, j) => j.maghrib];
const NAFL_DIM = [3];

function prayerTree(bg, rows, dim) {
  return async (A) => {
    const day = todayIn(TZ);
    const times = PK_CITIES.map(([lat, lng]) => ({ s: prayerTimes(day, lat, lng, { method: "karachi", asr: "hanafi" }), j: prayerTimes(day, lat, lng, { asr: "jafari" }) }));
    const labelW = 285, colW = (1020 - labelW - 24) / PK_CITIES.length, right = W - 30 - 18;
    const rh = Math.min(88, Math.floor((H - 166 - 130 - 282 - 66) / rows.length));
    const kids = [dateLine(A, new Date()),
      txt(new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }).format(new Date()), { x: W / 2, cy: 254, size: 25, color: "#222", align: "center", weight: 800 })];
    rows.forEach((fn, r) => {
      const cy = 282 + 66 + r * rh + rh / 2;
      times.forEach((t, i) => kids.push(txt(hm(fn(t.s, t.j)), { x: right - labelW - colW * i - colW / 2, cy, size: 25, color: dim.includes(r) ? "#7A6A55" : INK, align: "center" })));
    });
    return frame(A, bg, kids);
  };
}

// "Days in jail" card: the designed picture (public/cardkit/days_base.jpg, 1080×1005) + the live day number + the current footer band
const DAYS_H = 1093;
const daysTree = (id) => async (A) => {
  const p = PEOPLE.find((x) => x.id === id);
  if (!p) throw new Error("unknown person");
  const n = String(daysSince(p.start));
  const sx = Math.min(0.62, 442 / (n.length * 0.696 * 320));
  return h("div", { style: { display: "flex", position: "relative", width: W, height: DAYS_H, fontFamily: "Lat" } },
    h("img", { src: `${A.origin}/cardkit/days_base.jpg`, width: W, height: 1005, style: { position: "absolute", left: 0, top: 0 } }),
    h("img", { src: `${A.origin}/brand/card-foot.png`, width: W, height: 166, style: { position: "absolute", left: 0, top: DAYS_H - 166 } }),
    abs({ left: 774 - 500, top: 710 - 200, width: 1000, height: 400, justifyContent: "center", alignItems: "center" },
      h("div", { style: { display: "flex", fontFamily: "Serif", fontSize: 320, color: "#fff", transform: `scaleX(${sx})`, WebkitTextStroke: "9px #000", paintOrder: "stroke fill", textShadow: "0 10px 22px rgba(0,0,0,.85)" } }, n)));
};

export const CARD_KINDS = { days_imran: daysTree("imran"), currency: currencyTree, gold: goldTree, fuel: fuelTree, kse: kseTree, prayer: prayerTree("prayer", FARZ, FARZ_DIM), nawafil: prayerTree("nawafil", NAFL, NAFL_DIM) };

/** → { jpeg: Buffer|null, png: Buffer } for one card kind. */
export async function renderCard(kind, origin) {
  const build = CARD_KINDS[kind];
  if (!build) throw new Error("unknown card");
  const isDays = kind.startsWith("days_");
  const A = await loadAssets(origin, isDays);
  const tree = await build(A);
  const fonts = [{ name: "Lat", data: A.font, style: "normal" }];
  if (A.serif) fonts.push({ name: "Serif", data: A.serif, style: "normal" });
  const res = new ImageResponse(tree, { width: W, height: isDays ? DAYS_H : H, fonts });
  const png = Buffer.from(await res.arrayBuffer());
  let jpeg = null;
  try {
    const sharp = (await import("sharp")).default;
    jpeg = await sharp(png).flatten({ background: DEEP }).jpeg({ quality: 92 }).toBuffer();
  } catch { /* sharp unavailable: PNG still works for Facebook */ }
  return { jpeg, png };
}
