import { connectDB } from "@/lib/db";
import { Job } from "@/models";

export const fmtDate = (d, lang) => d ? new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(d)) : "";
export const pkStartOfToday = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }).split(",")[0] + " 00:00:00 GMT+0500");
export const daysLeft = (d) => Math.round((new Date(d) - pkStartOfToday()) / 864e5);
export const pick = (o, lang) => (o?.[lang] || o?.en || "");

export async function openJobs(limit = 150) {
  await connectDB();
  return Job.find({ status: "published", lastDate: { $gte: pkStartOfToday() } }).sort({ lastDate: 1 }).limit(limit).lean();
}
export async function jobBySlug(slug) {
  await connectDB();
  return Job.findOne({ slug, status: "published" }).lean();
}
