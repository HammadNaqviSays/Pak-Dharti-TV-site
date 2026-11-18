/** @type {import('next').NextConfig} */
module.exports = {
  // Photos are shrunk in the browser first; this leaves headroom for the upload
  experimental: { serverActions: { bodySizeLimit: "5mb", allowedOrigins: ["www.pakdhartitv.com", "pakdhartitv.com"] } },
  // Fonts and brand images never change at the same URL: let browsers and the CDN cache them for a year
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ] },
      // share pictures and build files are not pages: keep them out of Google's page index (social sites still read them)
      { source: "/:lang/news/:slug/opengraph-image", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/_next/static/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
      // the service worker must always be checked for updates
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
  async redirects() {
    return [
      { source: "/", destination: "/en", permanent: true },
      // Arabic and German were switched off: send old links to Urdu / English
      { source: "/ar", destination: "/ur", permanent: false },
      { source: "/ar/:path*", destination: "/ur/:path*", permanent: false },
      { source: "/de", destination: "/en", permanent: false },
      { source: "/de/:path*", destination: "/en/:path*", permanent: false },
    ];
  },
};
