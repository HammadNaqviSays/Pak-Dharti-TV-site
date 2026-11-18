// "Rates as of" wording for the daily cards. Interbank and international gold markets close on
// Saturday and Sunday, so weekend cards say they show Friday's rates and when new ones come.
const TZ = "Asia/Karachi";
const fmt = new Intl.DateTimeFormat("ur-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
export const urDate = (d) => fmt.format(new Date(d));
const ymd = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));
const weekday = (d) => new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(new Date(d));

/** API dates fall on weekends too (with Friday's values): step back to the last trading day. */
export function tradingDay(apiDate) {
  const d = new Date(`${apiDate}T12:00:00Z`);
  const wd = d.getUTCDay();
  if (wd === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (wd === 0) d.setUTCDate(d.getUTCDate() - 2);
  return d;
}

const hourPk = (now) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }).format(now)) % 24;

/** The day the rates really belong to: before the market opens (10:00 PKT) and at weekends, the last session's day. */
export function lastTradingDay(asOfDate, now = new Date()) {
  const d = new Date(asOfDate);
  if (ymd(d) === ymd(now) && hourPk(now) < 10) d.setUTCDate(d.getUTCDate() - 1);
  for (let i = 0; i < 3 && ["Sat", "Sun"].includes(weekday(d)); i++) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/** { line, status, day } — line: "ریٹ بمطابق: …", status: a short note on freshness, day: the date shown */
export function marketAsOf(asOfDate, { weekendClosed = true } = {}) {
  const now = new Date();
  const wd = weekday(now);
  const day = weekendClosed ? lastTradingDay(asOfDate, now) : new Date(asOfDate);
  const sameDay = ymd(day) === ymd(now);
  let status;
  if (weekendClosed && (wd === "Sat" || wd === "Sun")) status = "ہفتہ وار تعطیل — نئے ریٹ پیر کو آئیں گے";
  else if (sameDay) status = "آج کے تازہ ریٹ";
  else status = "نئے ریٹ آنے تک یہی ریٹ نافذ ہیں";
  return { line: `ریٹ بمطابق: ${urDate(day)}`, status, day };
}

/** Pakistan reviews fuel prices twice a month: from the 1st and from the 16th. */
// OGRA now announces petrol and diesel prices every working day (7-day average of world prices);
// Friday's prices stay in force on Saturday and Sunday.
export function fuelStatus(effective, now = new Date()) {
  const today = ymd(now);
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ }).format(now);
  if (effective === today) return "آج کی سرکاری قیمت — اوگرا روزانہ قیمت جاری کرتا ہے";
  if (wd === "Sat" || wd === "Sun") return "ہفتہ وار تعطیل — جمعہ کی قیمتیں پیر تک برقرار";
  return "نئی قیمت کا اعلان متوقع — اوگرا روزانہ قیمت جاری کرتا ہے";
}
