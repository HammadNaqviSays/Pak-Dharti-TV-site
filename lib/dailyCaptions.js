// Ready-to-post text for each daily card, per platform.
//   whatsapp  — WhatsApp channel/groups: *bold*, emojis
//   facebook  — Facebook page: plain text + hashtags
//   instagram — Instagram / TikTok: hashtags
// No links: the editor posts the image and text directly in the channel.
//   x         — X (Twitter): short, under 280 characters
import { prayerTimes, todayIn } from "./prayTimes";
import { urduDate } from "./dailyCards";
import { marketAsOf, tradingDay, urDate, fuelStatus } from "./asOf";

const TZ = "Asia/Karachi";
const n = (v, d = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
const hm = (d) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).format(d)
  .replace("AM", "صبح").replace("PM", "شام");

export const PLATFORMS = [
  { key: "whatsapp", name: "واٹس ایپ" },
  { key: "facebook", name: "فیس بک" },
  { key: "instagram", name: "انسٹاگرام / ٹک ٹاک" },
  { key: "x", name: "ایکس (ٹوئٹر)" },
];

const TAGS = {
  currency: "#DollarRate #CurrencyRate #Pakistan #ڈالر_ریٹ",
  gold: "#GoldRate #GoldPricePakistan #سونے_کا_نرخ",
  prayer: "#PrayerTimes #Namaz #SehriIftar #نماز",
  "news-pakistan": "#PakistanNews #Urdu #خبریں",
  "news-world": "#WorldNews #Urdu #عالمی_خبریں",
  mandi: "#MandiRates #Punjab #سبزی #گندم",
  fuel: "#PetrolPrice #Pakistan #پیٹرول",
  kse: "#PSX #KSE100 #StockMarket #اسٹاک_مارکیٹ",
  sports: "#Cricket #PakistanCricket #کھیل",
};

/** Short, to-the-point text: title, date line, the key figures. b = bold marker ("*" on WhatsApp). */
function body(key, d, b) {
  const B = (t) => `${b}${t}${b}`;
  const fxAs = d.fxDate ? marketAsOf(tradingDay(d.fxDate)) : null;
  switch (key) {
    case "currency": {
      const flag = { USD: "🇺🇸", SAR: "🇸🇦", AED: "🇦🇪", GBP: "🇬🇧" };
      const pick = ["USD", "SAR", "AED", "GBP"].map((c) => d.fx.find((f) => f.code === c)).filter(Boolean);
      return [`💱 ${B("کرنسی ریٹ")}`, `📅 ${fxAs ? fxAs.line : urduDate()}`, "",
        ...pick.map((c) => `${flag[c.code]} ${c.ur}: ${B(n(c.pkr, 2))}`),
        ...(fxAs && fxAs.status !== "آج کے تازہ ریٹ" ? ["", `⏳ ${fxAs.status}`] : [])];
    }
    case "gold": {
      const g = d.gold;
      const as = g.source === "sarafa" && g.at ? marketAsOf(g.at) : fxAs;
      return [`🪙 ${B("سونے کا نرخ")}`, `📅 ${as ? as.line : urduDate()}`, "",
        `24 قیراط فی تولہ: ${B(n(g.tola24))} روپے`,
        `22 قیراط فی تولہ: ${n(g.tola22)} روپے`,
        `24 قیراط فی 10 گرام: ${n(g.tenGram24)} روپے`,
        ...(as && as.status !== "آج کے تازہ ریٹ" ? ["", `⏳ ${as.status}`] : [])];
    }
    case "prayer": {
      const day = todayIn(TZ);
      const city = (name, lat, lng) => {
        const s = prayerTimes(day, lat, lng, { method: "karachi", asr: "hanafi" });
        return `📍 ${name}: فجر ${hm(s.fajr)}، ظہر ${hm(s.dhuhr)}، عصر ${hm(s.asr)}، مغرب ${hm(s.maghrib)}، عشاء ${hm(s.isha)}`;
      };
      return [`🕌 ${B("فرض نمازوں کے اوقات")}`, `📅 ${urduDate()}`, "",
        city("کراچی", 24.8607, 67.0011), city("لاہور", 31.5204, 74.3587), city("اسلام آباد", 33.6844, 73.0479), "", "جعفری اوقات اور باقی شہر کارڈ پر۔"];
    }
    case "nawafil": {
      const day = todayIn(TZ);
      const city = (name, lat, lng) => {
        const s = prayerTimes(day, lat, lng, { method: "karachi", asr: "hanafi" });
        const j = prayerTimes(day, lat, lng, { asr: "jafari" });
        return `📍 ${name}: تہجد ${hm(s.tahajjud)}، اشراق ${hm(s.ishraq)}، چاشت ${hm(s.chasht)}، سحری ${hm(s.fajr)}، افطار ${hm(s.maghrib)} (جعفری افطار ${hm(j.maghrib)})`;
      };
      return [`🌙 ${B("نوافل، سحری اور افطار کے اوقات")}`, `📅 ${urduDate()}`, "",
        city("کراچی", 24.8607, 67.0011), city("لاہور", 31.5204, 74.3587), city("اسلام آباد", 33.6844, 73.0479)];
    }
    case "news-pakistan":
    case "news-world": {
      const head = key === "news-pakistan" ? "🇵🇰 پاکستان کی اہم خبریں" : "🌍 دنیا کی اہم خبریں";
      const list = (key === "news-pakistan" ? d.pakistan : d.world).slice(0, 5);
      return [B(head), `📅 ${urduDate()}`, "", ...list.map((h, i) => `${i + 1}. ${h.title}`)];
    }
    case "mandi": {
      const as = d.mandi.asOf ? marketAsOf(d.mandi.asOf, { weekendClosed: false }) : null;
      const L = d.mandi.prices.Lahore || Object.values(d.mandi.prices)[0] || {};
      const items = [["potato", "آلو"], ["onion", "پیاز"], ["tomato", "ٹماٹر"]].filter(([k]) => L[k]);
      return [`🧺 ${B("منڈی کے تھوک نرخ")}`, `📅 ${as ? as.line : urduDate()}`, "",
        `لاہور (فی کلو): ${items.map(([k, u]) => `${u} ${n(L[k], Number.isInteger(L[k]) ? 0 : 1)}`).join("، ")}`,
        ...(as && as.status !== "آج کے تازہ ریٹ" ? ["", `⏳ ${as.status}`] : [])];
    }
    case "fuel": {
      const since = d.fuel.effective ? urDate(`${d.fuel.effective}T12:00:00Z`) : null;
      return [`⛽ ${B("پیٹرول اور ڈیزل کی قیمتیں")}`, ...(since ? [`📅 نافذ: ${since}`] : []), "",
        ...(d.fuel.petrol ? [`پیٹرول: ${B(n(d.fuel.petrol, 2))} روپے فی لیٹر`] : []),
        ...(d.fuel.diesel ? [`ڈیزل: ${n(d.fuel.diesel, 2)} روپے فی لیٹر`] : []),
        "", `⏳ ${fuelStatus(d.fuel.effective)}`];
    }
    case "kse": {
      const k = d.kse, up = (k.change ?? 0) >= 0, sign = up ? "+" : "−";
      return [`📈 ${B("اسٹاک مارکیٹ — کے ایس ای 100")}`, `📅 ${urDate(`${k.day}T12:00:00Z`)}`, "",
        `${k.live ? "اس وقت" : "بندش"}: ${B(n(k.close, 2))} پوائنٹس`,
        ...(k.change != null ? [`${up ? "🟢" : "🔴"} ${sign}${n(Math.abs(k.change), 2)} پوائنٹس (${sign}${n(Math.abs(k.pct), 2)}%) — ${up ? "مارکیٹ مثبت" : "مارکیٹ منفی"}`] : []),
        ...(k.open || k.prevClose ? [`آغاز: ${n(k.open || k.prevClose, 2)}`] : [])];
    }
    case "sports":
      return [`🏏 ${B("کھیلوں کی اہم خبریں")}`, `📅 ${urduDate()}`, "", ...d.sports.slice(0, 5).map((h, i) => `${i + 1}. ${h.title}`)];
    default: return [];
  }
}

export function caption(key, platform, d) {
  const b = platform === "whatsapp" ? "*" : "";
  const lines = body(key, d, b);
  if (platform === "x") return [...lines.filter(Boolean), "#پاک_دھرتی_ٹی_وی"].join("\n").slice(0, 275);
  lines.push("", "— پاک دھرتی ٹی وی");
  if (platform !== "whatsapp") lines.push(TAGS[key]);
  return lines.join("\n");
}

/** One text for "share all cards". */
export function allCaption(platform, d) {
  const b = platform === "whatsapp" ? "*" : "";
  return [`📰 ${b}آج کی ضروری معلومات${b}`, `📅 ${urduDate()}`, "",
    "💱 کرنسی ریٹ", "🪙 سونے کا نرخ", "🕌 نماز، سحر و افطار کے اوقات", "📈 اسٹاک مارکیٹ", "🇵🇰 پاکستان کی اہم خبریں", "🏏 کھیلوں کی خبریں", "🧺 منڈی کے نرخ", "⛽ پیٹرول / ڈیزل", "",
    "— پاک دھرتی ٹی وی"].join("\n");
}
