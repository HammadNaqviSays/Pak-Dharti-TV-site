// The team of Pak Dharti TV (Setting "team:members"): management, newsroom, contributors. Edited in Mission Control > Team.
import { connectDB } from "./db";
import { Setting } from "@/models";

export const TEAM_GROUPS = { management: { en: "Management", ur: "انتظامیہ" }, newsroom: { en: "Newsroom", ur: "نیوز روم" }, contributors: { en: "Contributors", ur: "معاونین" } };
const S = (x, n = 600) => String(x || "").trim().slice(0, n);
const URLOK = (x) => (/^https?:\/\//i.test(String(x || "").trim()) ? String(x).trim().slice(0, 300) : "");
const PHOTO = (x) => { const v = String(x || "").trim(); return /^https?:\/\//i.test(v) || v.startsWith("/") ? v.slice(0, 400) : ""; };
export const slugOf = (name) => String(name || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `m${Date.now().toString(36)}`;

export function cleanMember(m) {
  return {
    id: S(m.id, 60) || slugOf(m.name), name: S(m.name, 80), nameUr: S(m.nameUr, 80), role: S(m.role, 100), roleUr: S(m.roleUr, 100),
    bio: S(m.bio, 700), bioUr: S(m.bioUr, 700), photo: PHOTO(m.photo), group: TEAM_GROUPS[m.group] ? m.group : "newsroom",
    order: Math.max(0, Math.min(999, Math.round(Number(m.order)) || 100)), active: m.active !== false,
    fb: URLOK(m.fb), x: URLOK(m.x), ig: URLOK(m.ig), web: URLOK(m.web),
  };
}
export async function getTeam({ all = false } = {}) {
  await connectDB();
  const v = (await Setting.findOne({ key: "team:members" }).lean())?.value;
  const list = (Array.isArray(v) ? v : []).map(cleanMember).filter((m) => m.name && (all || m.active));
  return list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
export async function saveTeam(list) {
  await connectDB();
  await Setting.findOneAndUpdate({ key: "team:members" }, { key: "team:members", value: list.map(cleanMember).filter((m) => m.name) }, { upsert: true });
}
