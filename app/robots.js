import { SITE } from "@/lib/site";

const allow = ["/", "/api/media/", "/api/people/cutout/"];
const disallow = ["/admin", "/api/"];
// Search engines and AI answer engines are welcome: being quoted and linked in AI answers brings readers.
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow, disallow },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow, disallow })),
    ],
    sitemap: [`${SITE.url}/sitemap.xml`, `${SITE.url}/news-sitemap.xml`],
  };
}
