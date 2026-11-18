// A story is "economy" only if it is about business, prices, markets, trade or jobs. The Business Recorder / Dawn-business feeds are
// labelled economy as a whole, and the AI tends to follow that label, so a story about a president or a war ends up under economy.
// This is the safety net: an economy story with no business word in it moves to world (or pakistan if it is about Pakistan).
const ECON = /\b(econom\w*|business\w*|market\w*|stock\w*|shares?|psx|kse|rupee\w*|dollars?|currency|inflation|budget\w*|tax\w*|tariff\w*|trade\w*|export\w*|import\w*|invest\w*|bank\w*|gdp|imf|loans?|prices?|petrol|diesel|revenue|profits?|sales|industr\w*|jobs?|employment|wheat|sugar|cotton|auto|cars?|vehicles?|expo|exhibition|finance|financial|salary|salaries|wage\w*|pension|startup\w*|ecommerce|e-commerce|airline\w*|cement|steel|textile\w*|real estate|property|sukuk|bitcoin|crypto\w*)\b/i;
const PK = /\b(pakistan\w*|islamabad|karachi|lahore|peshawar|quetta|rawalpindi|multan|punjab|sindh|balochistan|khyber|kp|gilgit|azad kashmir|ispr|nab|fbr|sbp|pti|pml-?n|ppp)\b/i;

/** The section a story really belongs to: its own, unless it says economy without any business in it. */
export function saneCategory(category, title = "", summary = "") {
  if (category !== "economy") return category;
  // Economy needs a business word in the HEADLINE, or at least three of them in headline + summary
  // (one stray "shares of the vote" or "market" in the text of an election story is not enough).
  if (ECON.test(title)) return category;
  const text = `${title} ${summary}`;
  const hits = (text.match(new RegExp(ECON.source, "gi")) || []).length;
  if (hits >= 3) return category;
  return PK.test(text) ? "pakistan" : "world";
}

/** One-off clean-up that keeps running harmlessly: recent "economy" stories that are not about business move to their real section. */
export async function fixRecentCategories(limit = 80) {
  const { connectDB } = await import("./db");
  const { Article } = await import("@/models");
  await connectDB();
  const list = await Article.find({ category: "economy", status: "published", contentType: "news" })
    .sort({ publishedAt: -1 }).limit(limit).select("category translations.en.title translations.en.summary").lean();
  let moved = 0;
  for (const a of list) {
    const c = saneCategory(a.category, a.translations?.en?.title, a.translations?.en?.summary);
    if (c !== a.category) { await Article.updateOne({ _id: a._id }, { $set: { category: c } }); moved++; }
  }
  return { checked: list.length, moved };
}
