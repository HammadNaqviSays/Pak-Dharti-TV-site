// Daily share cards (currency, gold, prayer times for each school, morning headlines, fuel),
// drawn on a canvas in the Pak Dharti frame. Designed at 1080×1350 and rendered at 1440×1800 for HD.
import { NOORI, MAROON, MAROON_DEEP, GOLD, loadImage, latinFont, cover, roundRect, gloss, fit, drawLines } from "./newsCard";
import { prayerTimes, todayIn } from "./prayTimes";
import { MANDI_CITIES, MANDI_ITEMS } from "./mandiItems";
import { drawFlag } from "./flags";
import { marketAsOf, tradingDay, urDate as urDay, fuelStatus } from "./asOf";

export const W = 1080, H = 1350, SCALE = 4 / 3;
const FOOT = 166;
const INK = "#151515", MUTED = "#6B6B6B", ROW_ALT = "rgba(122,0,0,.045)";

// Cities far enough apart that their prayer times differ by several minutes (Muzaffarabad, Faisalabad,
// D.I. Khan and others are within 2–4 minutes of a city listed here)
export const PK_CITIES = [
  { ur: "کراچی", lat: 24.8607, lng: 67.0011 },
  { ur: "کوئٹہ", lat: 30.1798, lng: 66.975 },
  { ur: "ملتان", lat: 30.1575, lng: 71.5249 },
  { ur: "لاہور", lat: 31.5204, lng: 74.3587 },
  { ur: "اسلام آباد", lat: 33.6844, lng: 73.0479 },
  { ur: "پشاور", lat: 34.0151, lng: 71.5249 },
  { ur: "گلگت", lat: 35.9208, lng: 74.308 },
];

const TZ = "Asia/Karachi";
export function urduDate(d = new Date()) {
  return new Intl.DateTimeFormat("ur-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);
}
const enDate = (d = new Date()) => new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }).format(d);
const hm = (d) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).format(d).replace(/\s?[AP]M$/, "");
const num = (n, digits = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

let assets = null;
async function getAssets() {
  if (!assets) {
    const [top, foot, logo] = await Promise.all([loadImage("/brand/card-top.jpg"), loadImage("/brand/card-foot.png"), loadImage("/brand/logo.png")]);
    try { await document.fonts.load(`60px ${NOORI}`, "نماز کے اوقات سونے کا نرخ کرنسی آج کی اہم خبریں ۰۱۲"); await document.fonts.ready; } catch {}
    assets = { top, foot, logo, latin: latinFont() };
  }
  return assets;
}

/** Frame + title ribbon. Returns the y where content can start. */
function frame(ctx, A, title, subtitle) {
  ctx.fillStyle = "#F7F7F7"; ctx.fillRect(0, 0, W, H);
  if (A.top) cover(ctx, A.top, 0, 0, W, H - FOOT + 30, 0.5);
  // title ribbon
  const ry = 34, rh = 128;
  ctx.save(); ctx.shadowColor = "rgba(76,0,0,.35)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  roundRect(ctx, 40, ry, W - 80, rh, 22); ctx.clip(); gloss(ctx, 40, ry, W - 80, rh); ctx.restore();
  ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 90, ry + rh - 10, 180, 5);
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff"; ctx.font = `68px ${NOORI}`;
  ctx.fillText(title, W / 2, ry + rh / 2 + 6);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.strokeText(title, W / 2, ry + rh / 2 + 6);
  // date line
  ctx.fillStyle = MAROON; ctx.font = `38px ${NOORI}`;
  ctx.fillText(subtitle || urduDate(), W / 2, ry + rh + 50);
  if (!subtitle) {
    ctx.direction = "ltr"; ctx.fillStyle = MUTED; ctx.font = `700 22px ${A.latin}`;
    ctx.fillText(enDate(), W / 2, ry + rh + 92);
  }
  return ry + rh + 120;
}

function footer(ctx, A) {
  if (A.foot) ctx.drawImage(A.foot, 0, H - FOOT, W, FOOT);
}

function panel(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.12)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  roundRect(ctx, x, y, w, h, 20); ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.fill(); ctx.restore();
  roundRect(ctx, x, y, w, h, 20); ctx.strokeStyle = "rgba(184,137,27,.55)"; ctx.lineWidth = 2; ctx.stroke();
}

function note(ctx, text, y) {
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = MUTED; ctx.font = `26px ${NOORI}`;
  ctx.fillText(text, W / 2, y);
}

// Green "as of" pill under the panel, e.g. "ہفتہ وار تعطیل — نئے ریٹ پیر کو آئیں گے"
function statusPill(ctx, text, y) {
  ctx.font = `28px ${NOORI}`; ctx.direction = "rtl";
  const w = ctx.measureText(text).width + 44, h = 46;
  roundRect(ctx, W / 2 - w / 2, y - h / 2, w, h, 23); ctx.fillStyle = "#1F5E3B"; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, y + 3);
}

/** Dates for each rates card. */
function fxAsOf(d) { return d.fxDate ? marketAsOf(tradingDay(d.fxDate)) : null; }
function goldAsOf(d) {
  if (d.gold?.source === "sarafa" && d.gold.at) return marketAsOf(d.gold.at);
  return d.fxDate ? marketAsOf(tradingDay(d.fxDate)) : null;
}

function ur(ctx, text, x, y, size, color = INK, align = "right", stroke = 0) {
  ctx.direction = "rtl"; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.font = `${size}px ${NOORI}`; ctx.fillStyle = color;
  ctx.fillText(text, x, y + size * 0.08);
  if (stroke) { ctx.strokeStyle = color; ctx.lineWidth = stroke; ctx.strokeText(text, x, y + size * 0.08); }
}
function la(ctx, A, text, x, y, size, color = INK, align = "left", weight = 800) {
  ctx.direction = "ltr"; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.font = `${weight} ${size}px ${A.latin}`; ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// ------------------------------------------------------------------ cards

function currencyCard(ctx, A, d) {
  const { fx } = d;
  const as = fxAsOf(d);
  let y = frame(ctx, A, "آج کے کرنسی ریٹ", as?.line);
  const want = ["USD", "EUR", "GBP", "SAR", "AED", "QAR", "KWD", "OMR", "BHD", "CAD", "AUD", "CNY"];
  const rows = want.map((c) => fx.find((f) => f.code === c)).filter(Boolean);
  const px = 60, pw = W - 120, rh = 58, ph = rows.length * rh + 84;
  panel(ctx, px, y, pw, ph);
  ur(ctx, "کرنسی", W - px - 36, y + 42, 32, MAROON);
  ur(ctx, "روپے (انٹربینک اوسط)", px + 36, y + 42, 30, MAROON, "left");
  y += 84;
  rows.forEach((c, i) => {
    const cy = y + i * rh + rh / 2;
    if (i % 2 === 0) { ctx.fillStyle = ROW_ALT; ctx.fillRect(px + 12, cy - rh / 2, pw - 24, rh); }
    // flag, then the name, then the code in small grey letters
    drawFlag(ctx, c.code, W - px - 104, cy - 22, 66, 44);
    ur(ctx, c.ur, W - px - 124, cy, 38, INK);
    ctx.font = `38px ${NOORI}`;
    const nw = ctx.measureText(c.ur).width;
    la(ctx, A, c.code, W - px - 136 - nw, cy + 2, 20, "#8A8A8A", "right", 700);
    la(ctx, A, num(c.pkr, 2), px + 40, cy, 38, INK, "left");
    if (c.prev) {
      const d = c.pkr - c.prev;
      if (Math.abs(d / c.prev) >= 0.0005) {
        ctx.fillStyle = d > 0 ? "#138A3E" : "#C21B1B";
        ctx.beginPath();
        const ax = px + 250, ay = cy;
        if (d > 0) { ctx.moveTo(ax, ay - 11); ctx.lineTo(ax + 11, ay + 8); ctx.lineTo(ax - 11, ay + 8); }
        else { ctx.moveTo(ax, ay + 11); ctx.lineTo(ax + 11, ay - 8); ctx.lineTo(ax - 11, ay - 8); }
        ctx.fill();
      }
    }
  });
  if (as) statusPill(ctx, as.status, y + rows.length * rh + 38);
  footer(ctx, A);
}

function goldCard(ctx, A, d) {
  const { gold, silver } = d;
  const as = goldAsOf(d);
  let y = frame(ctx, A, "آج کا سونے کا نرخ", as?.line);
  // hero: 24K per tola
  const hx = 60, hw = W - 120, hh = 250;
  ctx.save(); ctx.shadowColor = "rgba(185,134,10,.45)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  roundRect(ctx, hx, y, hw, hh, 26); ctx.clip();
  const g = ctx.createLinearGradient(hx, y, hx + hw, y + hh);
  g.addColorStop(0, "#FBEDB8"); g.addColorStop(0.55, "#E2B007"); g.addColorStop(1, "#A9780A");
  ctx.fillStyle = g; ctx.fillRect(hx, y, hw, hh);
  const shine = ctx.createLinearGradient(0, y, 0, y + hh / 2);
  shine.addColorStop(0, "rgba(255,255,255,.45)"); shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine; ctx.fillRect(hx, y, hw, hh / 2);
  ctx.restore();
  ur(ctx, "24 قیراط — فی تولہ", W / 2, y + 58, 44, "#3A2A00", "center", 0.8);
  la(ctx, A, `Rs ${num(gold.tola24)}`, W / 2, y + 140, 92, "#2B1F00", "center", 900);
  la(ctx, A, `Rs ${num(gold.tenGram24)}  / 10 gram`, W / 2, y + 210, 30, "#3A2A00", "center", 700);
  y += hh + 30;

  const rows = [
    ["22 قیراط", gold.tola22, (gold.tola22 / 11.6638) * 10],
    ["21 قیراط", gold.tola21, (gold.tola21 / 11.6638) * 10],
    ["18 قیراط", gold.tola18, (gold.tola18 / 11.6638) * 10],
  ];
  if (silver) rows.push(["چاندی", silver.tola, silver.gram * 10]);
  const px = 60, pw = W - 120, rh = 82, ph = rows.length * rh + 84;
  panel(ctx, px, y, pw, ph);
  ur(ctx, "فی تولہ", W / 2 + 40, y + 40, 30, MAROON, "center");
  ur(ctx, "فی 10 گرام", px + 150, y + 40, 30, MAROON, "center");
  y += 80;
  rows.forEach(([name, tola, ten], i) => {
    const cy = y + i * rh + rh / 2;
    if (i % 2 === 0) { ctx.fillStyle = ROW_ALT; ctx.fillRect(px + 12, cy - rh / 2, pw - 24, rh); }
    ur(ctx, name, W - px - 36, cy, 42, INK, "right", 0.6);
    la(ctx, A, `Rs ${num(tola)}`, W / 2 + 40, cy, 40, INK, "center");
    la(ctx, A, `Rs ${num(ten)}`, px + 150, cy, 34, "#333", "center", 700);
  });
  const ny = y + rows.length * rh + 40;
  note(ctx, gold.source === "sarafa" ? "صرافہ مارکیٹ کا نرخ" : "عالمی منڈی کی قیمت کے مطابق؛ مقامی صرافہ نرخ میں فرق ہو سکتا ہے", ny);
  if (gold.ounceUsd) la(ctx, A, `International: $${num(gold.ounceUsd, 2)} / ounce`, W / 2, ny + 40, 24, MUTED, "center", 700);
  if (as) statusPill(ctx, as.status, ny + 98);
  footer(ctx, A);
}

// Two prayer cards: the obligatory (farz) prayers on one, the voluntary (nafl) prayers and fasting times on the other.
// "who": all | hanafi | jafari  (colour bar on the right of the row)
const FARZ_ROWS = [
  { label: "فجر", tag: "حنفی", who: "hanafi", t: (s) => s.fajr },
  { label: "فجر", tag: "جعفری", who: "jafari", t: (s, j) => j.fajr },
  { label: "طلوعِ آفتاب", who: "all", t: (s) => s.sunrise, dim: true },
  { label: "ظہر", who: "all", t: (s) => s.dhuhr },
  { label: "عصر", tag: "حنفی", who: "hanafi", t: (s) => s.asr },
  { label: "عصر", tag: "جعفری", who: "jafari", t: (s, j) => j.asr },
  { label: "مغرب", tag: "حنفی", who: "hanafi", t: (s) => s.maghrib },
  { label: "مغرب", tag: "جعفری", who: "jafari", t: (s, j) => j.maghrib },
  { label: "عشاء", tag: "حنفی", who: "hanafi", t: (s) => s.isha },
  { label: "عشاء", tag: "جعفری", who: "jafari", t: (s, j) => j.isha },
];
const NAFL_ROWS = [
  { label: "تہجد (رات کا آخری تہائی)", who: "all", t: (s) => s.tahajjud },
  { label: "اشراق", who: "all", t: (s) => s.ishraq },
  { label: "چاشت (بہترین وقت)", who: "all", t: (s) => s.chasht },
  { label: "زوال شروع (نماز مکروہ)", who: "all", t: (s) => s.zawal, dim: true },
  { label: "سحری ختم", tag: "حنفی", who: "hanafi", t: (s) => s.fajr },
  { label: "سحری ختم", tag: "جعفری", who: "jafari", t: (s, j) => j.imsak },
  { label: "افطار", tag: "حنفی", who: "hanafi", t: (s) => s.maghrib },
  { label: "افطار", tag: "جعفری", who: "jafari", t: (s, j) => j.maghrib },
];
const WHO_COLOR = { all: "#B8891B", sunni: "#7A0000", hanafi: "#7A0000", shafi: "#9C4A00", jafari: "#1F5E3B" };

function prayerTable(ctx, A, title, rows, noteText) {
  let y = frame(ctx, A, title);
  const day = todayIn(TZ);
  const times = PK_CITIES.map((c) => ({
    s: prayerTimes(day, c.lat, c.lng, { method: "karachi", asr: "hanafi" }),
    j: prayerTimes(day, c.lat, c.lng, { asr: "jafari" }),
  }));
  const px = 30, pw = W - 60, labelW = 330;
  const colW = (pw - labelW - 24) / PK_CITIES.length;
  const right = W - px - 18;
  // as tall as fits above the footer, never taller than 88px per row
  const rh = Math.min(88, Math.floor((H - FOOT - 130 - y - 66) / rows.length));
  const ph = rows.length * rh + 70;
  panel(ctx, px, y, pw, ph);
  ur(ctx, "فقہ حنفی و فقہ جعفریہ", right, y + 36, 27, "#555");
  PK_CITIES.forEach((c, i) => ur(ctx, c.ur, right - labelW - colW * i - colW / 2, y + 36, c.ur.length > 6 ? 27 : 31, MAROON, "center", 0.5));
  y += 66;
  rows.forEach((row, r) => {
    const cy = y + r * rh + rh / 2;
    if (r % 2 === 0) { ctx.fillStyle = ROW_ALT; ctx.fillRect(px + 8, cy - rh / 2, pw - 16, rh); }
    ctx.fillStyle = WHO_COLOR[row.who]; ctx.fillRect(right + 6, cy - rh / 2 + 8, 6, rh - 16);
    ctx.direction = "rtl"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.font = `38px ${NOORI}`; ctx.fillStyle = INK;
    ctx.fillText(row.label, right - 6, cy + 3);
    if (row.tag) {
      // clear coloured tag right after the prayer name: حنفی / جعفری
      const lw = ctx.measureText(row.label).width;
      ctx.font = `27px ${NOORI}`;
      const tw = ctx.measureText(row.tag).width + 20;
      const tx = right - 14 - lw - tw;
      roundRect(ctx, tx, cy - 18, tw, 38, 8); ctx.fillStyle = WHO_COLOR[row.who]; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.fillText(row.tag, tx + tw / 2, cy + 3);
      ctx.textAlign = "right";
    }
    times.forEach((t, i) => la(ctx, A, hm(row.t(t.s, t.j)), right - labelW - colW * i - colW / 2, cy, 30, row.dim ? "#7A6A55" : INK, "center", 800));
  });
  note(ctx, noteText, y + rows.length * rh + 36);
  footer(ctx, A);
}

const prayerCard = (ctx, A) => prayerTable(ctx, A, "فرض نمازوں کے اوقات", FARZ_ROWS,
  "حسابی اوقات؛ مقامی مسجد یا جنتری سے چند منٹ کا فرق ممکن ہے۔");
const naflCard = (ctx, A) => prayerTable(ctx, A, "نوافل، سحری اور افطار", NAFL_ROWS,
  "اشراق: طلوع کے 20 منٹ بعد؛ چاشت: دن چڑھے کا بہترین وقت؛ تہجد: رات کے آخری تہائی کا آغاز۔ اوقات حسابی ہیں۔");

function headlinesCard(ctx, A, { list, title }) {
  let y = frame(ctx, A, title);
  const px = 50, pw = W - 100;
  const items = list.slice(0, 7);
  const avail = H - FOOT - 40 - y;
  panel(ctx, px, y, pw, avail);
  const maxW = pw - 150;
  let cy = y + 30;
  const each = (avail - 50) / items.length;
  items.forEach((h, i) => {
    const r = fit(ctx, h.title, NOORI, { maxW, maxLines: 2, max: items.length > 5 ? 42 : 48, min: 30 });
    const font = ctx.font;
    const lh = r.fs * 1.55;
    const blockH = r.lines.length * lh;
    const top = cy + (each - blockH) / 2;
    const bx = W - px - 52, by = cy + each / 2;
    ctx.beginPath(); ctx.arc(bx, by, 26, 0, Math.PI * 2); ctx.fillStyle = MAROON; ctx.fill();
    la(ctx, A, String(i + 1), bx, by + 1, 28, "#fff", "center");
    drawLines(ctx, r.lines, { x: W - px - 96, y: top + lh / 2 + 4, lh, rtl: true, align: "start", color: INK, hiColor: MAROON, stroke: r.fs / 60, font });
    if (i < items.length - 1) { ctx.fillStyle = "rgba(184,137,27,.35)"; ctx.fillRect(px + 40, cy + each, pw - 80, 1.5); }
    cy += each;
  });
  footer(ctx, A);
}

function mandiCard(ctx, A, { mandi }) {
  const cities = MANDI_CITIES.filter((c) => mandi.prices[c.key] && Object.keys(mandi.prices[c.key]).length);
  const rows = MANDI_ITEMS.filter((it) => cities.some((c) => mandi.prices[c.key][it.key]));
  const as = mandi.asOf ? marketAsOf(mandi.asOf, { weekendClosed: false }) : null;
  let y = frame(ctx, A, "منڈی کے تھوک نرخ — پنجاب", as?.line);
  const px = 34, pw = W - 68, rh = Math.min(52, Math.floor((H - FOOT - 120 - y) / (rows.length + 1.3))), labelW = 210;
  const colW = (pw - labelW - 20) / cities.length;
  const right = W - px - 16;
  panel(ctx, px, y, pw, rows.length * rh + 70);
  ur(ctx, "روپے فی کلو", right, y + 36, 24, MUTED);
  cities.forEach((c, i) => ur(ctx, c.ur, right - labelW - colW * i - colW / 2, y + 36, 31, MAROON, "center", 0.5));
  y += 66;
  rows.forEach((it, r) => {
    const cy = y + r * rh + rh / 2;
    if (r % 2 === 0) { ctx.fillStyle = ROW_ALT; ctx.fillRect(px + 8, cy - rh / 2, pw - 16, rh); }
    ur(ctx, it.unit === 40 ? `${it.ur} (فی من)` : it.ur, right, cy, 32, INK, "right", 0.4);
    cities.forEach((c, i) => {
      const v = mandi.prices[c.key][it.key];
      la(ctx, A, v ? num(v, Number.isInteger(v) || v >= 100 ? 0 : 1) : "—", right - labelW - colW * i - colW / 2, cy, 27, v ? INK : MUTED, "center", 800);
    });
  });
  const ny = y + rows.length * rh + 34;
  note(ctx, "اوسط تھوک نرخ (پرچون نرخ زیادہ ہوتے ہیں)۔ ماخذ: محکمہ زراعت پنجاب (AMIS)", ny);
  if (as) statusPill(ctx, as.status, ny + 52);
  footer(ctx, A);
}

function fuelCard(ctx, A, { fuel }) {
  const since = fuel.effective ? urDay(`${fuel.effective}T12:00:00Z`) : fuel.sourceAt ? urDay(fuel.sourceAt) : null;
  let y = frame(ctx, A, "پیٹرولیم مصنوعات کی قیمتیں", since ? `نافذ: ${since}` : undefined);
  const items = [["پیٹرول", fuel.petrol], ["ہائی اسپیڈ ڈیزل", fuel.diesel]].filter(([, v]) => v);
  const px = 80, pw = W - 160, bh = 230;
  y += 20;
  items.forEach(([name, v]) => {
    ctx.save(); ctx.shadowColor = "rgba(76,0,0,.3)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    roundRect(ctx, px, y, pw, bh, 24); ctx.clip(); gloss(ctx, px, y, pw, bh); ctx.restore();
    ur(ctx, `${name} — فی لیٹر`, W / 2, y + 58, 46, "#fff", "center", 0.8);
    la(ctx, A, `Rs ${num(v, 2)}`, W / 2, y + 150, 88, "#fff", "center", 900);
    y += bh + 40;
  });
  statusPill(ctx, fuelStatus(fuel.effective), y + 10);
  note(ctx, `ماخذ: ${fuel.source || "خبری رپورٹس"} — حکومتی اعلان کے مطابق`, y + 64);
  footer(ctx, A);
}

// KSE-100: today's value, up/down against the previous close, open/high/low
function kseCard(ctx, A, { kse }) {
  const up = (kse.change ?? 0) >= 0;
  const dayTxt = urDay(`${kse.day}T12:00:00Z`);
  const isToday = kse.day === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
  let y = frame(ctx, A, "پاکستان اسٹاک ایکسچینج", `کے ایس ای 100 انڈیکس — ${dayTxt}`);
  const hx = 60, hw = W - 120, hh = 300;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  roundRect(ctx, hx, y, hw, hh, 26); ctx.clip();
  const g = ctx.createLinearGradient(hx, y, hx + hw, y + hh);
  if (up) { g.addColorStop(0, "#1F7A45"); g.addColorStop(1, "#0E4A28"); } else { g.addColorStop(0, "#B3261E"); g.addColorStop(1, "#6E0F0A"); }
  ctx.fillStyle = g; ctx.fillRect(hx, y, hw, hh); ctx.restore();
  ur(ctx, kse.live ? "اس وقت (کاروبار جاری)" : "بند ہوا", W / 2, y + 52, 40, "#fff", "center", 0.6);
  la(ctx, A, num(kse.close, 2), W / 2, y + 140, 100, "#fff", "center", 900);
  if (kse.change != null) {
    const sign = up ? "+" : "−";
    la(ctx, A, `${up ? "▲" : "▼"} ${sign}${num(Math.abs(kse.change), 2)}  (${sign}${num(Math.abs(kse.pct), 2)}%)`, W / 2, y + 222, 44, "#fff", "center", 800);
    ur(ctx, up ? (isToday ? "آج مارکیٹ مثبت رہی" : "مارکیٹ مثبت رہی") : (isToday ? "آج مارکیٹ منفی رہی" : "مارکیٹ منفی رہی"), W / 2, y + 272, 34, "rgba(255,255,255,.9)", "center");
  }
  y += hh + 34;
  const rows = [
    ["آغاز (اوپن)", kse.open],
    ["دن کی بلند ترین سطح", kse.high],
    ["دن کی کم ترین سطح", kse.low],
    [kse.open ? "گزشتہ روز کی بندش" : "آغاز (گزشتہ روز کی بندش)", kse.prevClose],
  ].filter(([, v]) => v);
  const px = 60, pw = W - 120, rh = 84, ph = rows.length * rh + 30;
  panel(ctx, px, y, pw, ph);
  y += 15;
  rows.forEach(([name, v], i) => {
    const cy = y + i * rh + rh / 2;
    if (i % 2 === 0) { ctx.fillStyle = ROW_ALT; ctx.fillRect(px + 12, cy - rh / 2, pw - 24, rh); }
    ur(ctx, name, W - px - 36, cy, 40, INK, "right", 0.5);
    la(ctx, A, num(v, 2), px + 60, cy, 42, INK, "left");
  });
  const ny = y + rows.length * rh + 50;
  statusPill(ctx, isToday ? (kse.live ? "کاروبار جاری ہے — اعداد بدل سکتے ہیں" : "آج کا کاروبار مکمل") : "مارکیٹ بند — آخری کاروباری دن کے اعداد", ny);
  note(ctx, "ماخذ: پاکستان اسٹاک ایکسچینج (PSX)", ny + 56);
  footer(ctx, A);
}

export const CARD_DEFS = [
  // Pakistan only (world news stays on the website)
  { key: "currency", name: "کرنسی ریٹ", draw: currencyCard, needs: (d) => d.fx?.length },
  { key: "gold", name: "سونے کا نرخ", draw: goldCard, needs: (d) => d.gold },
  { key: "kse", name: "اسٹاک مارکیٹ (KSE-100)", draw: kseCard, needs: (d) => d.kse?.close },
  { key: "prayer", name: "فرض نمازوں کے اوقات", draw: prayerCard, needs: () => true },
  { key: "nawafil", name: "نوافل، سحری اور افطار", draw: naflCard, needs: () => true },
  { key: "news-pakistan", name: "پاکستان کی اہم خبریں", draw: (c, A, d) => headlinesCard(c, A, { list: d.pakistan, title: "پاکستان کی اہم خبریں" }), needs: (d) => d.pakistan?.length >= 3 },
  { key: "sports", name: "کھیلوں کی خبریں", draw: (c, A, d) => headlinesCard(c, A, { list: d.sports, title: "کھیلوں کی اہم خبریں" }), needs: (d) => d.sports?.length >= 3 },
  { key: "mandi", name: "منڈی کے نرخ", draw: mandiCard, needs: (d) => d.mandi?.prices && Object.keys(d.mandi.prices).length },
  { key: "fuel", name: "پیٹرول / ڈیزل", draw: fuelCard, needs: (d) => d.fuel?.petrol },
];

/** Draws one card at HD size. */
export async function drawDailyCard(canvas, def, data) {
  const A = await getAssets();
  canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingQuality = "high";
  def.draw(ctx, A, data);
  return canvas;
}
