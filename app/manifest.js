// Web app manifest (served at /manifest.webmanifest): makes the site installable as an app (PWA).
export default function manifest() {
  return {
    id: "/",
    name: "Pak Dharti TV — پاک دھرتی ٹی وی",
    short_name: "Pak Dharti",
    description: "پاکستان اور دنیا کی تازہ خبریں، روزانہ ریٹ، نماز کے اوقات اور روزانہ کارڈز — Pakistan and world news in Urdu and English.",
    start_url: "/ur?source=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#7A0000",
    lang: "ur",
    dir: "auto",
    categories: ["news"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "تازہ خبریں", short_name: "خبریں", url: "/ur?source=app-shortcut", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
      { name: "روزانہ کارڈز", short_name: "کارڈز", url: "/ur/daily?source=app-shortcut", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
      { name: "سونا، کرنسی ریٹ", short_name: "ریٹ", url: "/ur/rates?source=app-shortcut", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
      { name: "نماز کے اوقات", short_name: "نماز", url: "/ur/prayer-times?source=app-shortcut", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
      { name: "English news", short_name: "English", url: "/en?source=app-shortcut", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
