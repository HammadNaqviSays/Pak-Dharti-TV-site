import { timingSafeEqual, randomBytes, createHash } from "crypto";

function safeEqual(a, b) {
  const A = Buffer.from(a || ""), B = Buffer.from(b || "");
  return A.length === B.length && A.length > 0 && timingSafeEqual(A, B);
}

// Server-to-server key. For the browser admin panel use NextAuth and check the
// session instead, so this key never ships to the client.
export const isAdmin = (req) => safeEqual(req.headers.get("x-admin-key"), process.env.ADMIN_API_KEY);
// The scheduler (GitHub Actions) sends x-cron-token; only its SHA-256 is stored here.
// The token is in the repository secret CRON_TOKEN (the old token's hash has been removed, so any older token is dead).
const SCHEDULER_TOKEN_HASHES = ["e57289e86cdac67278c67d73b83052ecd49c8f71d16eca2f0b3c6e24aca10961"];
const tokenOk = (t) => !!t && (() => { const x = createHash("sha256").update(t).digest("hex"); return SCHEDULER_TOKEN_HASHES.some((y) => safeEqual(x, y)); })();
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` itself; GitHub Actions sends x-cron-token.
// The token is no longer accepted in the URL (URLs end up in logs and in git).
export const isCron = (req) =>
  (process.env.CRON_SECRET && safeEqual(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) ||
  tokenOk(req.headers.get("x-cron-token"));

export function makeSlug(title) {
  const base = title.toLowerCase().normalize("NFKD")
    .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 70);
  return `${base || "story"}-${randomBytes(3).toString("hex")}`;
}

const STOP = new Set("about after amid against says said over with from into their there this that have will been were more than news".split(" "));

// Cheap de-dup: 4 most significant words of a headline. Upgrade later to embeddings.
export function clusterKey(title = "") {
  return title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .sort((a, b) => b.length - a.length).slice(0, 4).sort().join("|");
}

export const stripHtml = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
