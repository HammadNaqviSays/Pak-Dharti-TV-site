// Branded share image for WhatsApp / Facebook / X: the article photo with the
// Pak Dharti TV logo and a maroon brand bar. Generated on demand and cached.
import { ImageResponse } from "next/og";
import { getArticle } from "@/lib/queries";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pak Dharti TV";

async function asDataUri(url, type) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type || res.headers.get("content-type") || "image/png"};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }) {
  const { slug } = await params;
  const a = await getArticle(slug).catch(() => null);
  const raw = a?.image?.url;
  // Stock photos only; the local category banners are SVG and look better as a plain brand card
  const abs = raw?.startsWith("/api/media/") ? `${SITE.url}${raw}` : raw;
  const photo = abs && abs.startsWith("http") ? await asDataUri(abs) : null;
  const logo = await asDataUri(`${SITE.url}/brand/logo.png`, "image/png");

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: "linear-gradient(135deg, #7A0000, #2A0000)" }}>
        {photo && (
          <img src={photo} width={1200} height={630}
            style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />
        )}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: 96, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 44px", color: "#fff",
          background: "linear-gradient(180deg, #A30606 0%, #7A0000 55%, #560000 100%)",
          borderTop: "4px solid #E8B23A",
        }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 2 }}>PAK DHARTI TV</div>
          <div style={{ display: "flex", fontSize: 26, opacity: 0.9 }}>{SITE.url.replace(/^https?:\/\//, "")}</div>
        </div>
        {logo && (
          <img src={logo} width={150} height={150}
            style={{ position: "absolute", top: 28, right: 28, width: 150, height: 150 }} />
        )}
      </div>
    ),
    size
  );
}
