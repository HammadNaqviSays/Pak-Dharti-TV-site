"use server";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { getTeam, saveTeam, cleanMember, slugOf } from "@/lib/team";

const done = () => { revalidatePath("/admin/team"); revalidatePath("/ur/team"); revalidatePath("/en/team"); };
export async function saveMemberAction(fd) {
  if (!(await isLoggedIn())) return;
  const g = (k) => String(fd.get(k) || "");
  const id = g("id") || slugOf(g("name"));
  const m = cleanMember({ id, name: g("name"), nameUr: g("nameUr"), role: g("role"), roleUr: g("roleUr"), bio: g("bio"), bioUr: g("bioUr"), photo: g("photo"),
    group: g("group"), order: g("order"), active: fd.get("active") === "on", fb: g("fb"), x: g("x"), ig: g("ig"), web: g("web") });
  if (!m.name) return;
  const list = await getTeam({ all: true });
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list[i] = m; else list.push(m);
  await saveTeam(list); done();
}
export async function deleteMemberAction(fd) {
  if (!(await isLoggedIn())) return;
  const id = String(fd.get("id") || "");
  await saveTeam((await getTeam({ all: true })).filter((x) => x.id !== id)); done();
}
