import { fontVars } from "@/lib/fonts";
import { ICONS } from "@/lib/site";
import "../globals.css";
import "./admin.css";

export const metadata = {
  title: "Mission Control | Pak Dharti TV",
  robots: { index: false, follow: false },
  icons: { ...ICONS, apple: "/brand/admin-192.png" },
  manifest: "/admin/manifest.webmanifest",   // its own app, separate from the news site app
  appleWebApp: { capable: true, title: "Mission Control", statusBarStyle: "black" },
};

export const viewport = { themeColor: "#1C1C1C" };

export default function AdminLayout({ children }) {
  return (
    <html lang="en" className={`${fontVars} lang-en`}>
      <body className="admin">{children}</body>
    </html>
  );
}
