import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

export const COOKIE = "pd_admin";

export function sessionToken() {
  return createHash("sha256")
    .update(`${process.env.ADMIN_PASSWORD}:${process.env.SESSION_SECRET}`).digest("hex");
}

export async function isLoggedIn() {
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return false;
  const v = (await cookies()).get(COOKIE)?.value || "";
  const t = sessionToken();
  return v.length === t.length && timingSafeEqual(Buffer.from(v), Buffer.from(t));
}
