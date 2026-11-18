# Pak Dharti TV

A multilingual news portal (English, اردو, العربية, Deutsch) with an AI content pipeline,
an editorial control panel, and a readership analytics layer.

**Live:** https://YOUR-DOMAIN  ·  **Stack:** Next.js 15, MongoDB Atlas, Vercel, Google Gemini API (Claude optional), Unsplash API

<!-- Add 2-3 screenshots here: homepage (Urdu), article page, Mission Control -->

## What it does

- **Automated pipeline** — pulls RSS feeds every 20 minutes, groups duplicate stories,
  writes one original article from multiple sources, and translates it into 3 languages.
- **Mission Control (`/admin`)** — an editor writes a topic or angle and gets a finished
  4-language article with an image, published to the breaking band or sent to a review queue.
- **Right-to-left support** — Urdu in Nastaliq, Arabic in Naskh, correct `dir`/`lang` and `hreflang` SEO.
- **Analytics** — per-language view tracking, daily stats, CSV export and a Python analysis notebook.

## Engineering decisions

| Problem | Decision |
|---|---|
| Serverless time limit (~60 s) vs. 4 AI calls per article | English master first, then 3 translations in parallel; cron processes one story per call |
| Two overlapping cron runs picking the same story | Atomic claim with `findOneAndUpdate({state: "new"})` |
| Same story from several outlets | Headline cluster key + 12-hour coverage check |
| AI inventing quotes or numbers | Prompt rule: only facts present in source material; sources stored and linked |
| Free 512 MB database | TTL index removes raw feed items after 7 days |
| A failed translation | Article still publishes; that language falls back to English with a notice |

## Data analysis

See [`analysis/pak_dharti_analysis.ipynb`](analysis/pak_dharti_analysis.ipynb):
readership by category and language, automated vs. editorial content performance,
AI cost per 1,000 views, and weekly patterns.

## Run locally

```bash
cp .env.example .env.local   # fill in the keys
npm install
npm run dev                  # http://localhost:3000
```

More detail: [ARCHITECTURE.md](ARCHITECTURE.md) · Deployment: [DEPLOY.md](DEPLOY.md)

## Author

Syed Hammad Hassan — [github.com/HammadNaqviSays](https://github.com/HammadNaqviSays)
