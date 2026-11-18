// Urdu fonts the reel editor can choose from (files are in /public/fonts).
export const REEL_FONTS = [
  { key: "jameel", label: "Jameel Noori Nastaleeq", file: "jameel-noori-nastaleeq.woff2" },
  { key: "alvi", label: "Alvi Lahori Nastaleeq", file: "urdu/AlviLahoriNastaleeq.woff2" },
  { key: "nafees", label: "Nafees Nastaleeq", file: "urdu/Nafees-Nastaleeq.woff" },
  { key: "hussaini", label: "Hussaini Nastaleeq", file: "urdu/HussainiNastaleeq.woff2" },
  { key: "pak", label: "Pak Nastaleeq", file: "urdu/PakNastaleeq.woff2" },
  { key: "khushkhati", label: "Jameel Khushkhati", file: "urdu/jameel-khushkhati.woff2" },
];
export const REEL_COLORS = { k: "#111111", r: "#7a0000", b: "#0b57d0", g: "#0a7a3b" };
export const REEL_ANIMS = { right: "Right se", left: "Left se", bottom: "Neeche se", fade: "Fade" };
export const fontOf = (key) => REEL_FONTS.find((f) => f.key === key) || REEL_FONTS[0];
export const REEL_STROKES = { r: "Maroon", k: "Black" };
