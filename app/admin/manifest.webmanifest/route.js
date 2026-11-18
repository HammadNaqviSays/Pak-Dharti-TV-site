// Separate installable app for Mission Control (the newsroom admin): opens straight into /admin.
export const dynamic = "force-static";

export function GET() {
  const body = {
    id: "/admin",
    name: "Pak Dharti — Mission Control",
    short_name: "Mission Control",
    description: "Pak Dharti TV newsroom admin",
    start_url: "/admin?source=app",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1C1C1C",
    theme_color: "#1C1C1C",
    lang: "en",
    icons: [
      { src: "/brand/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/admin-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tweet cards", url: "/admin/tweets", icons: [{ src: "/brand/admin-192.png", sizes: "192x192" }] },
      { name: "People library", url: "/admin/people", icons: [{ src: "/brand/admin-192.png", sizes: "192x192" }] },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } });
}
