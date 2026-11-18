// Cities and items shown on the mandi (wholesale market) card. Shared by the server fetcher and the card.
export const MANDI_CITIES = [
  { key: "Lahore", ur: "لاہور" },
  { key: "Faisalabad", ur: "فیصل آباد" },
  { key: "Rawalpindi", ur: "راولپنڈی" },
  { key: "Multan", ur: "ملتان" },
  { key: "Bhakhar", ur: "بھکر" },
];

// What we show, how to find it on the page, and the unit (price per 100 kg → per kg or per 40 kg)
export const MANDI_ITEMS = [
  { key: "wheat", range: [3000, 10000], ur: "گندم", unit: 40, re: /\bWheat\b(?!\s*Flour)/i },
  { key: "gramWhite", range: [100, 700], ur: "چنا سفید", unit: 1, re: /Gram White\s*\(\s*local\s*\)/i },
  { key: "gramBlack", range: [100, 600], ur: "کالا چنا", unit: 1, re: /Gram Black/i },
  { key: "gramPulse", range: [150, 700], ur: "دال چنا", unit: 1, re: /Gram Pulse/i },
  { key: "moongPulse", range: [150, 800], ur: "دال مونگ", unit: 1, re: /Moong Pulse/i },
  { key: "mashPulse", range: [200, 1100], ur: "دال ماش", unit: 1, re: /Mash Pulse[^\d]{0,30}/i },
  { key: "masoorPulse", range: [150, 700], ur: "دال مسور", unit: 1, re: /Masoor Pulse[^\d]{0,12}/i },
  { key: "potato", range: [20, 300], ur: "آلو", unit: 1, re: /Potato Fresh/i },
  { key: "onion", range: [20, 400], ur: "پیاز", unit: 1, re: /\bOnion\b/i },
  { key: "tomato", range: [20, 500], ur: "ٹماٹر", unit: 1, re: /\bTomato\b/i },
  { key: "garlic", range: [100, 1500], ur: "لہسن (دیسی)", unit: 1, re: /Garlic\s*\(\s*Local\s*\)/i },
  { key: "ginger", range: [200, 1500], ur: "ادرک", unit: 1, re: /Ginger\s*\(\s*(?:China|Thai)\s*\)/i },
  { key: "peas", range: [50, 900], ur: "مٹر", unit: 1, re: /\bPeas\b/i },
  { key: "cauliflower", range: [20, 400], ur: "گوبھی", unit: 1, re: /\bCauliflower\b/i },
  { key: "okra", range: [50, 900], ur: "بھنڈی", unit: 1, re: /Lady Finger/i },
  { key: "chilli", range: [50, 900], ur: "ہری مرچ", unit: 1, re: /Green Chilli/i },
];

/** Unit each item is shown in (wheat is quoted per 40 kg, everything else per kg). */
export const mandiUnit = (it) => (it.unit === 40 ? { en: "per 40 kg", ur: "فی 40 کلو" } : { en: "per kg", ur: "فی کلو" });
