# Deployment checklist

Code lives on the personal GitHub account (**HammadNaqviSays**). Every service account
(MongoDB, Vercel, Unsplash, AI API, cron-job.org) is created with the **Pak Dharti TV email**,
so this project stays separate from other client projects.

## 1. Push to GitHub

Set the commit identity for this repo only (no `--global`, so other projects are unaffected):

```bash
cd pakdharti
git init
git config user.name "Syed Hammad Hassan"
git config user.email "YOUR_GITHUB_ID+YOURNAME@users.noreply.github.com"
git add .
git status            # make sure no .env file is listed!
git commit -m "Initial commit: Pak Dharti TV news engine"
git branch -M main
```
Create an empty repo named `pak-dharti-tv` on github.com (no README), then:
```bash
git remote add origin https://github.com/HammadNaqviSays/pak-dharti-tv.git
git push -u origin main
```

## 2. MongoDB Atlas (Pak Dharti email)
1. Create a free **M0** cluster.
2. Database Access → add a user with a strong password.
3. Network Access → allow `0.0.0.0/0` (Vercel has no fixed IP).
4. Connect → Drivers → copy the URI, add `/pakdharti` before the `?`.

## 3. API keys (Pak Dharti email)
- Unsplash: unsplash.com/developers → New Application → Access Key
- AI: aistudio.google.com → Get API key (Gemini free tier, no card needed). Free-tier inputs may be used by Google to improve its models — fine for public news, not for private data.

## 4. Vercel (Pak Dharti email)
1. Sign up, then **Add New → Project → Import Git Repository** and connect the HammadNaqviSays GitHub account.
2. Before the first deploy, add every variable from `.env.example` under Environment Variables.
   Generate random secrets with: `openssl rand -hex 32`
3. Deploy. Check `/en`, `/ur`, then log in at `/admin`.

## 5. Scheduler — cron-job.org (Pak Dharti email)
Each job: method GET, header `Authorization: Bearer <CRON_SECRET>`
- `https://YOUR-DOMAIN/api/cron/ingest` — every 20 min
- `https://YOUR-DOMAIN/api/cron/process` — every 60 min (≈24 articles/day × 4 AI calls, inside the free daily quota)
- `https://YOUR-DOMAIN/api/cron/process?mode=folklore` — daily

Keep `AUTO_PUBLISH=false` for the first week and approve from `/admin`.

## Notes
- Vercel's Hobby plan is for non-commercial use. Once the site runs ads, move to Pro.
- Rotate any key that is ever committed by mistake — deleting the file is not enough.
