/** URL slug for a writer, from the Latin name ("Moazzma Hunain" -> "moazzma-hunain"). */
export const writerSlug = (name) => String(name || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
