// Islamic prayer times from the sun's position (the standard astronomical method used by
// PrayTimes.org and most timetables). Pure maths, runs in the browser; times are returned
// as Date objects (UTC instants) and shown in the viewer's or city's time zone.

const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(rad(d)), cos = (d) => Math.cos(rad(d)), tan = (d) => Math.tan(rad(d));
const arcsin = (x) => deg(Math.asin(x)), arccos = (x) => deg(Math.acos(x)), arctan2 = (y, x) => deg(Math.atan2(y, x));
const arccot = (x) => deg(Math.atan(1 / x));
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
const fixHour = (h) => fix(h, 24), fixAngle = (a) => fix(a, 360);

// Calculation methods: Fajr angle, and Isha as an angle or as minutes after Maghrib
export const METHODS = {
  karachi: { name: "University of Islamic Sciences, Karachi", fajr: 18, isha: 18 },
  mwl: { name: "Muslim World League", fajr: 18, isha: 17 },
  isna: { name: "ISNA (North America)", fajr: 15, isha: 15 },
  makkah: { name: "Umm al-Qura, Makkah", fajr: 18.5, ishaMin: 90 },
  dubai: { name: "UAE (Dubai)", fajr: 18.2, isha: 18.2 },
  egypt: { name: "Egyptian General Authority", fajr: 19.5, isha: 17.5 },
  turkey: { name: "Diyanet, Turkey", fajr: 18, isha: 17 },
  // Fiqh-e-Jafaria (Shia Ithna Ashari), Leva Institute, Qum: Maghrib when the sun is 4° below the horizon
  jafari: { name: "Fiqh-e-Jafaria (Leva Institute, Qum)", fajr: 16, isha: 14, maghrib: 4 },
};

const BY_COUNTRY = {
  PK: "karachi", IN: "karachi", BD: "karachi", AF: "karachi", NP: "karachi", LK: "karachi",
  US: "isna", CA: "isna",
  SA: "makkah", YE: "makkah", BH: "makkah", KW: "makkah", QA: "makkah", OM: "makkah",
  AE: "dubai",
  EG: "egypt", SD: "egypt", LY: "egypt", SY: "egypt", LB: "egypt", JO: "egypt", IQ: "egypt",
  TR: "turkey", AZ: "turkey",
};
// Countries where most Muslims follow the Hanafi school (later Asr)
const HANAFI = new Set(["PK", "IN", "BD", "AF", "TR", "AZ", "UZ", "TJ", "KZ", "KG", "TM", "NP"]);

export const methodFor = (country) => BY_COUNTRY[country] || "mwl";
export const asrFor = (country) => (HANAFI.has(country) ? "hanafi" : "shafi");

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
  return { decl: arcsin(sin(e) * sin(L)), eqt: q / 15 - fixHour(RA) };
}

/**
 * date: { y, m, d } (the calendar day at the place), lat/lng in degrees.
 * Returns { fajr, sunrise, dhuhr, asr, maghrib, isha } as Date objects.
 */
export function prayerTimes({ y, m, d }, lat, lng, { method = "karachi", asr = "hanafi" } = {}) {
  // The Jafari school has its own angles as well as its own Asr
  if (asr === "jafari") method = "jafari";
  const M = METHODS[method] || METHODS.mwl;
  const jd = julian(y, m, d) - lng / (15 * 24);
  const midDay = (t) => fixHour(12 - sunPosition(jd + t).eqt);
  const sunAngleTime = (angle, t, ccw) => {
    const decl = sunPosition(jd + t).decl;
    const noon = midDay(t);
    const T = arccos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return noon + (ccw ? -T : T);
  };
  const asrTime = (factor, t) => {
    const decl = sunPosition(jd + t).decl;
    return sunAngleTime(-arccot(factor + tan(Math.abs(lat - decl))), t);
  };

  // Hours (local solar, measured from midnight UTC + longitude offset)
  let fajr = sunAngleTime(M.fajr, 5 / 24, true);
  const sunrise = sunAngleTime(0.833, 6 / 24, true);
  const dhuhr = midDay(12 / 24);
  const asrH = asrTime(asr === "hanafi" ? 2 : 1, 13 / 24);
  const sunset = sunAngleTime(0.833, 18 / 24);
  const maghribH = M.maghrib ? sunAngleTime(M.maghrib, 18 / 24) : sunset + 1 / 60;
  let isha = M.ishaMin ? sunset + M.ishaMin / 60 : sunAngleTime(M.isha, 18 / 24);

  // High latitudes (e.g. Europe in summer): the sun may never reach the angle; use the angle-based rule
  const night = 24 - (sunset - sunrise);
  const fajrMax = (M.fajr / 60) * night;
  if (!Number.isFinite(fajr) || sunrise - fajr > fajrMax) fajr = sunrise - fajrMax;
  if (!M.ishaMin) {
    const ishaMax = (M.isha / 60) * night;
    if (!Number.isFinite(isha) || isha - sunset > ishaMax) isha = sunset + ishaMax;
  }

  const base = Date.UTC(y, m - 1, d);
  const toDate = (h) => new Date(base + (h - lng / 15) * 3600e3);
  // Voluntary (nafl) prayers. Tahajjud: the last third of the night, from sunset to Fajr.
  // Ishraq: about 20 minutes after sunrise. Chasht (Duha): from Ishraq until shortly before noon; the best time is
  // mid-morning, halfway between sunrise and Dhuhr. Zawal (no prayer) is the few minutes before Dhuhr.
  const nightToFajr = 24 - (sunset - fajr);
  return {
    tahajjud: toDate(fajr - nightToFajr / 3),
    ishraq: toDate(sunrise + 20 / 60),
    chasht: toDate((sunrise + dhuhr) / 2),
    zawal: toDate(dhuhr - 10 / 60),
    imsak: toDate(fajr - 10 / 60),
    fajr: toDate(fajr), sunrise: toDate(sunrise),
    // a minute's caution after the zenith, as most timetables do
    dhuhr: toDate(dhuhr + 1 / 60), asr: toDate(asrH), sunset: toDate(sunset), maghrib: toDate(maghribH), isha: toDate(isha),
    // Jafari midnight: halfway between sunset and the next Fajr
    midnight: toDate(sunset + (24 - sunset + fajr) / 2),
  };
}

/** The calendar day (y, m, d) right now in a time zone. */
export function todayIn(tz, offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400e3);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now).map((p) => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day };
}

// A few cities to choose from, Pakistan first
export const CITIES = [
  { n: "Islamabad", ur: "اسلام آباد", lat: 33.6844, lng: 73.0479, tz: "Asia/Karachi", c: "PK" },
  { n: "Karachi", ur: "کراچی", lat: 24.8607, lng: 67.0011, tz: "Asia/Karachi", c: "PK" },
  { n: "Lahore", ur: "لاہور", lat: 31.5204, lng: 74.3587, tz: "Asia/Karachi", c: "PK" },
  { n: "Rawalpindi", ur: "راولپنڈی", lat: 33.5651, lng: 73.0169, tz: "Asia/Karachi", c: "PK" },
  { n: "Peshawar", ur: "پشاور", lat: 34.0151, lng: 71.5249, tz: "Asia/Karachi", c: "PK" },
  { n: "Quetta", ur: "کوئٹہ", lat: 30.1798, lng: 66.975, tz: "Asia/Karachi", c: "PK" },
  { n: "Multan", ur: "ملتان", lat: 30.1575, lng: 71.5249, tz: "Asia/Karachi", c: "PK" },
  { n: "Faisalabad", ur: "فیصل آباد", lat: 31.4504, lng: 73.135, tz: "Asia/Karachi", c: "PK" },
  { n: "Hyderabad", ur: "حیدرآباد", lat: 25.396, lng: 68.3578, tz: "Asia/Karachi", c: "PK" },
  { n: "Gujranwala", ur: "گوجرانوالہ", lat: 32.1877, lng: 74.1945, tz: "Asia/Karachi", c: "PK" },
  { n: "Sialkot", ur: "سیالکوٹ", lat: 32.4945, lng: 74.5229, tz: "Asia/Karachi", c: "PK" },
  { n: "Bahawalpur", ur: "بہاولپور", lat: 29.3956, lng: 71.6836, tz: "Asia/Karachi", c: "PK" },
  { n: "Sargodha", ur: "سرگودھا", lat: 32.074, lng: 72.6861, tz: "Asia/Karachi", c: "PK" },
  { n: "Bhakkar", ur: "بھکر", lat: 31.6332, lng: 71.0654, tz: "Asia/Karachi", c: "PK" },
  { n: "Dera Ismail Khan", ur: "ڈیرہ اسماعیل خان", lat: 31.8314, lng: 70.9019, tz: "Asia/Karachi", c: "PK" },
  { n: "Muzaffarabad", ur: "مظفرآباد", lat: 34.37, lng: 73.4711, tz: "Asia/Karachi", c: "PK" },
  { n: "Gilgit", ur: "گلگت", lat: 35.9208, lng: 74.308, tz: "Asia/Karachi", c: "PK" },
  { n: "Makkah", ur: "مکہ مکرمہ", lat: 21.4225, lng: 39.8262, tz: "Asia/Riyadh", c: "SA" },
  { n: "Madinah", ur: "مدینہ منورہ", lat: 24.4672, lng: 39.6111, tz: "Asia/Riyadh", c: "SA" },
  { n: "Riyadh", ur: "ریاض", lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh", c: "SA" },
  { n: "Jeddah", ur: "جدہ", lat: 21.5433, lng: 39.1728, tz: "Asia/Riyadh", c: "SA" },
  { n: "Dubai", ur: "دبئی", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai", c: "AE" },
  { n: "Abu Dhabi", ur: "ابوظہبی", lat: 24.4539, lng: 54.3773, tz: "Asia/Dubai", c: "AE" },
  { n: "Doha", ur: "دوحہ", lat: 25.2854, lng: 51.531, tz: "Asia/Qatar", c: "QA" },
  { n: "Kuwait City", ur: "کویت", lat: 29.3759, lng: 47.9774, tz: "Asia/Kuwait", c: "KW" },
  { n: "Muscat", ur: "مسقط", lat: 23.588, lng: 58.3829, tz: "Asia/Muscat", c: "OM" },
  { n: "London", ur: "لندن", lat: 51.5074, lng: -0.1278, tz: "Europe/London", c: "GB" },
  { n: "Manchester", ur: "مانچسٹر", lat: 53.4808, lng: -2.2426, tz: "Europe/London", c: "GB" },
  { n: "Birmingham", ur: "برمنگھم", lat: 52.4862, lng: -1.8904, tz: "Europe/London", c: "GB" },
  { n: "Berlin", ur: "برلن", lat: 52.52, lng: 13.405, tz: "Europe/Berlin", c: "DE" },
  { n: "Paris", ur: "پیرس", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris", c: "FR" },
  { n: "Istanbul", ur: "استنبول", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul", c: "TR" },
  { n: "Tbilisi", ur: "تبلیسی", lat: 41.7151, lng: 44.8271, tz: "Asia/Tbilisi", c: "GE" },
  { n: "New York", ur: "نیویارک", lat: 40.7128, lng: -74.006, tz: "America/New_York", c: "US" },
  { n: "Chicago", ur: "شکاگو", lat: 41.8781, lng: -87.6298, tz: "America/Chicago", c: "US" },
  { n: "Houston", ur: "ہیوسٹن", lat: 29.7604, lng: -95.3698, tz: "America/Chicago", c: "US" },
  { n: "Los Angeles", ur: "لاس اینجلس", lat: 34.0522, lng: -118.2437, tz: "America/Los_Angeles", c: "US" },
  { n: "Toronto", ur: "ٹورنٹو", lat: 43.6532, lng: -79.3832, tz: "America/Toronto", c: "CA" },
  { n: "Sydney", ur: "سڈنی", lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney", c: "AU" },
  { n: "Kuala Lumpur", ur: "کوالالمپور", lat: 3.139, lng: 101.6869, tz: "Asia/Kuala_Lumpur", c: "MY" },
];

/** URL slug for a city: "Dera Ismail Khan" -> "dera-ismail-khan". */
export const citySlug = (c) => c.n.toLowerCase().replace(/\s+/g, "-");
export const cityBySlug = (slug) => CITIES.find((c) => citySlug(c) === slug) || null;
