import { connectDB } from "./db";
import { Article, Campaign } from "@/models";

export async function approveArticle(id, reviewer = "admin", edits) {
  await connectDB();
  const update = {
    status: "published", publishedAt: new Date(),
    "disclosure.humanReviewed": true, "disclosure.reviewedBy": reviewer,
  };
  if (edits && typeof edits === "object") {
    for (const [k, v] of Object.entries(edits)) if (k.startsWith("translations.")) update[k] = v;
  }
  const article = await Article.findOneAndUpdate(
    { _id: id, status: { $in: ["pending_review", "draft"] } }, update, { new: true }
  );
  if (article?.campaign) await Campaign.updateOne({ _id: article.campaign }, { status: "published" });
  return article;
}

export async function rejectArticle(id) {
  await connectDB();
  return Article.findOneAndUpdate({ _id: id, status: "pending_review" }, { status: "rejected" }, { new: true });
}

/** Takes a live article off the site and puts it back in the review queue. */
export async function unpublishArticle(id) {
  await connectDB();
  return Article.findOneAndUpdate({ _id: id, status: "published" }, { status: "pending_review" }, { new: true });
}
