import { connectDB } from "./db";
import { Article, Campaign, CATEGORIES, CONTENT_TYPES, SLOTS } from "@/models";
import { generateMultilingual, PROMPT_VERSION } from "./generate";
import { findImage } from "./images";
import { makeSlug } from "./util";

export class ValidationError extends Error {}

/** Used by both the admin panel (server action) and POST /api/admin/inject. */
export async function runInjection(input, createdBy = "admin") {
  const {
    brief = "", headline = "", sourceMaterial = "",
    category = "pakistan", contentType = "feature",
    slot = "breaking", publishMode = "review", pinHours = 6,
  } = input;

  if (brief.trim().length < 15) throw new ValidationError("Brief must be at least 15 characters.");
  if (brief.length > 2000) throw new ValidationError("Brief is too long (max 2000 characters).");
  if (sourceMaterial.length > 8000) throw new ValidationError("Source material is too long (max 8000 characters).");
  if (!CATEGORIES.includes(category)) throw new ValidationError("Unknown category.");
  if (!CONTENT_TYPES.includes(contentType)) throw new ValidationError("Unknown content type.");
  if (!SLOTS.includes(slot)) throw new ValidationError("Unknown slot.");

  await connectDB();
  const campaign = await Campaign.create({
    brief, headline, sourceMaterial, category, contentType,
    requestedSlot: slot, publishMode, status: "generating", createdBy,
  });

  try {
    const { master, translations, failedLangs, usage, model } =
      await generateMultilingual({ brief, headline, category, contentType, sourceMaterial });
    const image = await findImage(master.imageQuery, category, { person: master.person, context: `${master.title}. ${master.summary || ""}` });
    const publishNow = publishMode === "instant";

    const article = await Article.create({
      slug: makeSlug(master.title),
      origin: "manual", contentType, category, translations,
      tags: master.tags || [], image, campaign: campaign._id,
      status: publishNow ? "published" : "pending_review",
      placement: {
        slot,
        priority: slot === "breaking" ? 100 : slot === "featured" ? 80 : 50,
        pinnedUntil: new Date(Date.now() + Math.min(Number(pinHours) || 6, 72) * 3600e3),
      },
      disclosure: { aiGenerated: true, humanReviewed: false },
      ai: { model, promptVersion: PROMPT_VERSION, ...usage },
      publishedAt: publishNow ? new Date() : undefined,
    });

    campaign.status = publishNow ? "published" : "ready";
    campaign.article = article._id;
    campaign.failedLangs = failedLangs;
    await campaign.save();

    return {
      campaignId: String(campaign._id), articleId: String(article._id),
      slug: article.slug, status: article.status, failedLangs,
      titles: Object.fromEntries(Object.entries(translations).map(([l, t]) => [l, t.title])),
      image: { url: image.url, credit: image.credit || null },
    };
  } catch (err) {
    campaign.status = "failed";
    campaign.error = String(err?.message || err).slice(0, 500);
    await campaign.save();
    throw err;
  }
}
