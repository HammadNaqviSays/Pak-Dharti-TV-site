// Finds a photo that fits a story when the current one is unsuitable: the person the story is about (free Commons
// photo), or a place / building / object (Unsplash). Falls back to the section banner.
import { callAI, parseJSON } from "./ai";
import { findImage, categoryImage, unsafeQuery } from "./images";

export async function pickPhoto(a) {
  const en = a.translations?.en || {};
  let person = "", query = "";
  try {
    const { text } = await callAI({
      system: "You choose photos for a news site. Reply with JSON only.",
      prompt: `Headline: ${en.title}\nSummary: ${en.summary || ""}\n
Return {"person":"full English name of the one famous public figure this story is about or honours (e.g. an occasion named after someone, like Iqbal Day = Allama Muhammad Iqbal), or empty string","query":"2-4 English words naming the CONCRETE THING the story is about, so the photo really shows it: the kind of place or object first (e.g. 'hotel lobby', 'restaurant food court', 'hospital building', 'airport terminal', 'wheat field', 'petrol pump', 'cricket stadium', 'Mazar-e-Iqbal Lahore', 'Parliament building Islamabad'), not a generic city skyline unless the story is about the city itself; never people, children, families; empty if nothing fits"}`,
      maxTokens: 300, prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
    });
    const j = parseJSON(text) || {};
    person = String(j.person || "").slice(0, 60);
    query = String(j.query || "").slice(0, 60);
  } catch {}
  if (unsafeQuery(query)) query = "";
  if (!person && !query) return categoryImage(a.category);
  try { return await findImage(query, a.category, { person, context: `${en.title}. ${en.summary || ""}` }); } catch { return categoryImage(a.category); }
}
