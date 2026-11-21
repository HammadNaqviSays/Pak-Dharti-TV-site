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

// width and height of a JPEG (read from its header)
function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

export default async function Image({ params }) {
  const { slug, lang } = await params;
  // The same news card that was posted on Facebook / Instagram (saved when it was drawn): shown whole (height 630) on a brand background,
  // so X, WhatsApp and Facebook link previews carry it. Stories without a saved card keep the plain share image below.
  try {
    const art = await getArticle(slug).catch(() => null);
    const cid = art?.social?.[lang === "en" ? "en" : "ur"]?.ogCard || art?.social?.[lang === "en" ? "en" : "ur"]?.card;
    const r = cid ? await fetch(`${SITE.url}/api/media/${cid}`) : null;
    if (r && r.ok && /jpeg/.test(r.headers.get("content-type") || "")) {
      const buf = Buffer.from(await r.arrayBuffer());
      const d = jpegSize(buf);
      if (d && d.w > 100 && d.h > 100) {
        const w = Math.round((630 * d.w) / d.h);
        return new ImageResponse(
          (
            <div style={{ width: 1200, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #8A0000, #2A0000)" }}>
              <img src={`data:image/jpeg;base64,${buf.toString("base64")}`} width={w} height={630} style={{ width: w, height: 630 }} />
            </div>
          ),
          size
        );
      }
    }
  } catch { /* fall back to the plain share image below */ }
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
