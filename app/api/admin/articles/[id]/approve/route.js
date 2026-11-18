// POST /api/admin/articles/:id/approve — publish from the review queue
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { approveArticle } from "@/lib/review";
import { isAdmin } from "@/lib/util";

export async function POST(req, { params }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { reviewer = "admin", edits } = await req.json().catch(() => ({}));
  const article = await approveArticle(id, reviewer, edits);
  if (!article) return NextResponse.json({ error: "Not found or already published" }, { status: 404 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, slug: article.slug });
}
