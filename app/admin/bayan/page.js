import { redirect } from "next/navigation";
import AdminInstall from "../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import StatementCardMaker from "../StatementCardMaker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// /admin/bayan?text=...&who=Imran Khan  (opened from a story with the text and speaker filled in)
export default async function BayanPage({ searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin");
  const sp = (await searchParams) || {};
  const initial = { text: String(sp.text || "") };
  if (sp.who) {
    try {
      const { findPeople } = await import("@/lib/people");
      const [p] = await findPeople([String(sp.who)]);
      if (p) {
        const ph = (p.photos || []).find((x) => x.cutout) || (p.photos || [])[0];
        initial.name = p.nameUr || p.name;
        if (ph) Object.assign(initial, { src: ph.cutout ? `/api/people/cutout/${ph.cutout}` : ph.url, cut: !!ph.cutout, credit: ph.credit || "" });
      }
    } catch {}
  }
  return (
    <>
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall />
        <a className="btn secondary" href="/admin">Back</a>
      </div></div>
      <div className="wrap">
        <StatementCardMaker initial={initial} />
      </div>
    </>
  );
}
