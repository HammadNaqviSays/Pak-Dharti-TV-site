import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE = "pd_admin";
export const SESSION_MS = 12 * 60 * 60 * 1000;

const sign = (exp) => createHmac("sha256", `${process.env.ADMIN_PASSWORD}:${process.env.SESSION_SECRET}`).update(`pd-admin:${exp}`).digest("hex");

/** A login token that stops working on its own after 12 hours (the server checks the time, not only the browser). */
export function sessionToken() {
  const exp = Date.now() + SESSION_MS;
  return `${exp}.${sign(exp)}`;
}

export async function isLoggedIn() {
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return false;
  const v = (await cookies()).get(COOKIE)?.value || "";
  const [exp, mac] = v.split(".");
  if (!/^\d{13}$/.test(exp || "") || !mac || Number(exp) < Date.now()) return false;
  const want = sign(exp);
  return mac.length === want.length && timingSafeEqual(Buffer.from(mac), Buffer.from(want));
}
