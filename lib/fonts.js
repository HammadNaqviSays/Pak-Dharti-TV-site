import { Libre_Franklin, Source_Serif_4, Gulzar, Noto_Naskh_Arabic } from "next/font/google";

// Headlines and interface (Latin): a news gothic in the Franklin tradition
export const display = Libre_Franklin({ subsets: ["latin"], variable: "--f-display", display: "swap" });
// Article text (English, German): a sturdy, highly legible serif
export const serif = Source_Serif_4({ subsets: ["latin"], variable: "--f-serif", display: "swap" });
// Urdu: Gulzar, a compact newspaper-style Nastaliq in the tradition of Urdu dailies
// (much closer to the Jameel Noori look than Noto Nastaliq, and with tighter line spacing)
export const urdu = Gulzar({ subsets: ["arabic"], weight: "400", variable: "--f-urdu", display: "swap" });
// Arabic: Naskh, the standard for Arabic news
export const arabic = Noto_Naskh_Arabic({
  subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--f-arabic", display: "swap",
});

export const fontVars = `${display.variable} ${serif.variable} ${urdu.variable} ${arabic.variable}`;
