// The rate cards are drawn on the server (they need the image library, which cannot run on Cloudflare Workers) and are
// saved in the database; Facebook / Instagram then fetch them from /api/media/<id>, exactly like the news cards.
// If drawing is not possible here, the old address /api/card/<kind> is used as a fallback.
import { Media } from "@/models";
import { renderCard } from "./serverCards";

export async function cardImageUrl(kind, day, base) {
  try {
    const { jpeg, png } = await renderCard(kind, base);
    const data = jpeg || png, type = jpeg ? "image/jpeg" : "image/png";
    if (!data?.length) throw new Error("empty card");
    const m = await Media.create({ data, type, size: data.length, credit: `Auto rate card ${kind} ${day}` });
    return `${base}/api/media/${m._id}`;
  } catch (e) {
    console.log(`[rates] could not draw ${kind} here (${String(e.message).slice(0, 100)}): using ${base}/api/card/${kind}`);
    return `${base}/api/card/${kind}?d=${day}`;
  }
}
