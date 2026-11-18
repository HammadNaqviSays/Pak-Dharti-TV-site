import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import GuestArticleForm from "./GuestArticleForm";

export const dynamic = "force-dynamic";

export default async function GuestArticlePage() {
  if (!(await isLoggedIn())) redirect("/admin");
  return (
    <main className="admin"><div className="wrap">
      <p><a href="/admin">← Mission Control</a></p>
      <h1>Guest article — writer’s own text</h1>
      <p className="hint">Paste the writer’s own Urdu and English texts. They are published as written (no AI rewriting). The page shows the writer’s name, photo and a short bio, the picture with its credit, and a note that the views are the writer’s own.</p>
      <GuestArticleForm />
    </div></main>
  );
}
