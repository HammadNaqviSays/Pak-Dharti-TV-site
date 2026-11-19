import { SITE } from "@/lib/site";

// A plain-text guide for AI answer engines: who we are, what we publish and where the data pages are.
export const revalidate = 86400;

export function GET() {
  const u = SITE.url;
  const text = `# Pak Dharti TV

> Independent Pakistani digital news site publishing news from Pakistan and the world in English and Urdu, plus daily rates and prayer timings. Website: ${u}

## What we publish
- News from Pakistan and the world: politics, economy, sports, religion, entertainment, disaster alerts.
- Daily utility pages for Pakistan: gold rate, dollar rate, petrol and diesel price, KSE-100 index, mandi (wholesale market) rates, and prayer times (including Sehri, Iftar, Tahajjud, Ishraq, Chasht) for 40 cities.
- Urdu poetry, quotes and Pakistan history (Urdu).

## Key pages (English)
- [Latest news](${u}/en): front page
- [Gold rate today](${u}/en/gold-rate)
- [Dollar rate today](${u}/en/dollar-rate)
- [Petrol and diesel price](${u}/en/petrol-price)
- [PSX KSE-100 index](${u}/en/psx)
- [Bitcoin and crypto prices (information only)](${u}/en/crypto)
- [Mandi rates](${u}/en/mandi-rates)
- [Prayer times](${u}/en/prayer-times)
- [Currency rates and calculator](${u}/en/rates)

## Key pages (Urdu)
- [تازہ خبریں](${u}/ur)
- [سونے کا نرخ](${u}/ur/gold-rate)
- [ڈالر ریٹ](${u}/ur/dollar-rate)
- [پیٹرول کی قیمت](${u}/ur/petrol-price)
- [نماز کے اوقات](${u}/ur/prayer-times)

## Feeds and sitemaps
- RSS (English): ${u}/en/feed.xml
- RSS (Urdu): ${u}/ur/feed.xml
- Sitemap: ${u}/sitemap.xml
- Google News sitemap: ${u}/news-sitemap.xml

## Editorial standards
Stories are written in our own words from named, credible sources; direct quotes are short and credited; AI tools assist drafting and translation. Read our [editorial policy](${u}/en/editorial-policy) and [about page](${u}/en/about). Corrections: ${u}/en/contact

## Using our content
You may summarise and cite our pages with a link to the original story. Please attribute to "Pak Dharti TV" and link to the page you used.
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=86400" } });
}
