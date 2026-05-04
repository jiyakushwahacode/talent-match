# TalentMatch — Complete Deploy Guide

## Overview
TalentMatch is a full-stack AI-powered job portal with:
- **Backend**: Node.js + Express + Prisma + PostgreSQL
- **Frontend**: Next.js 14 + Tailwind CSS
- **AI**: Anthropic Claude (resume parsing + job matching)
- **Payments**: Stripe Checkout
- **Storage**: Cloudinary (PDF resumes)
- **Email**: SendGrid
- **Deploy**: Render.com

---

## STEP 1 — Prerequisites

Make sure you have accounts at:
- [Render.com](https://render.com) (hosting)
- [Anthropic Console](https://console.anthropic.com) (Claude API key)
- [Stripe Dashboard](https://dashboard.stripe.com) (payments)
- [Cloudinary](https://cloudinary.com) (file storage)
- [SendGrid](https://sendgrid.com) (email)

---

## STEP 2 — Stripe Setup

1. Go to **Stripe Dashboard → Products**
2. Create two products:

   **Standard Job Posting**
   - Price: $29.00 USD, one-time
   - Copy the Price ID → `STRIPE_PRICE_STANDARD`

   **Premium Job Posting**
   - Price: $79.00 USD, one-time
   - Copy the Price ID → `STRIPE_PRICE_PREMIUM`

3. Go to **Developers → API Keys**
   - Copy Publishable key → `STRIPE_PUBLISHABLE_KEY`
   - Copy Secret key → `STRIPE_SECRET_KEY`

4. After deploying, set up webhook:
   - Go to **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR-API.onrender.com/api/payments/webhook`
   - Events to listen: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`
   - Copy Signing Secret → `STRIPE_WEBHOOK_SECRET`

---

## STEP 3 — Cloudinary Setup

1. Create a free account at cloudinary.com
2. Go to **Dashboard**
3. Copy:
   - Cloud Name → `CLOUDINARY_CLOUD_NAME`
   - API Key → `CLOUDINARY_API_KEY`
   - API Secret → `CLOUDINARY_API_SECRET`
4. Go to **Settings → Upload → Upload presets** → enable unsigned uploads (optional)

---

## STEP 4 — SendGrid Setup

1. Create account and verify sender identity
2. Go to **Settings → API Keys → Create API Key** (Full Access)
   - Copy → `SENDGRID_API_KEY`
3. Use a verified sender email → `SENDGRID_FROM_EMAIL`

---

## STEP 5 — Deploy to Render.com

### Option A: Using render.yaml (Recommended)

1. Push your code to a GitHub repository
2. Go to Render Dashboard → **New → Blueprint**
3. Connect your GitHub repo
4. Render detects `render.yaml` and creates both services + database
5. Set all `sync: false` env vars manually in the Render dashboard

### Option B: Manual Deploy

#### Deploy PostgreSQL Database
1. Render Dashboard → **New → PostgreSQL**
2. Name: `talentmatch-db`, Plan: Starter
3. Copy the **Internal Database URL** for the API service

#### Deploy Backend API
1. Render Dashboard → **New → Web Service**
2. Connect GitHub repo, set **Root Directory**: `backend`
3. Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
4. Start Command: `npm start`
5. Add all environment variables from `.env.example`

#### Deploy Frontend
1. Render Dashboard → **New → Web Service**
2. Connect GitHub repo, set **Root Directory**: `frontend`
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Add:
   - `NEXT_PUBLIC_API_URL` = your backend API URL + `/api`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = your Stripe publishable key

---

## STEP 6 — Seed the Database

After first deploy, run the seed script via Render Shell:

```bash
# In Render dashboard → your API service → Shell tab
cd /opt/render/project/src
node prisma/seed.js
```

This creates:
- Admin account: `admin@talentmatch.io` / `Admin@123456`
- Sample employer: `employer@acmecorp.com` / `Employer@123`
- Sample seeker: `seeker@example.com` / `Seeker@123`
- 3 sample job listings

---

## STEP 7 — Create Admin Account

After deploy and seed, log in with the admin credentials above.
**Change the admin password immediately** via the profile settings.

To promote an existing user to admin, use Prisma Studio:
```bash
npx prisma studio
# Go to User table → find user → change role to ADMIN
```

---

## STEP 8 — Update CORS & URLs

1. In your **backend** env vars on Render:
   - `FRONTEND_URL` = your frontend Render URL (e.g. `https://talentmatch.onrender.com`)

2. In your **frontend** env vars on Render:
   - `NEXT_PUBLIC_API_URL` = your API Render URL + `/api`

3. In Stripe webhook, update URL to your production API URL.

---

## STEP 9 — Local Development

```bash
# Clone and install
git clone <your-repo>

# Backend
cd backend
cp ../.env.example .env
# Fill in all .env values
npm install
npx prisma migrate dev --name init
npx prisma generate
node prisma/seed.js
npm run dev   # Runs on http://localhost:4000

# Frontend (new terminal)
cd frontend
cp ../.env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm install
npm run dev   # Runs on http://localhost:3000

# Stripe webhooks locally (install Stripe CLI)
stripe listen --forward-to localhost:4000/api/payments/webhook
```

---

## STEP 10 — Post-Deploy Checklist

- [ ] Database migrated and seeded
- [ ] Admin password changed
- [ ] Stripe webhook endpoint configured with correct URL
- [ ] `FRONTEND_URL` in backend points to live frontend
- [ ] `NEXT_PUBLIC_API_URL` in frontend points to live API
- [ ] Cloudinary folder `talentmatch/resumes` exists (auto-created on first upload)
- [ ] SendGrid sender identity verified
- [ ] Test registration (seeker + employer)
- [ ] Test resume upload
- [ ] Test job posting (free tier)
- [ ] Test Stripe checkout with test card `4242 4242 4242 4242`
- [ ] Verify AI scoring works on test application
- [ ] Admin dashboard loads correctly

---

## Architecture Notes

### AI Scoring Flow
```
Seeker applies → Application created → aiScorer.scoreApplication() called async
→ Claude reads job + resume → Returns 0-100 score + 5-dimension breakdown
→ Application updated with score → Email alert sent if score >= 70
```

### Payment Flow
```
Employer selects tier → POST /payments/create-checkout
→ Stripe Checkout session created → Employer redirected to Stripe
→ Payment completed → Stripe sends webhook to /payments/webhook
→ Webhook verified with signature → Job status set to ACTIVE
```

### Resume Parsing Flow
```
Seeker uploads PDF → pdf-parse extracts text
→ Claude parses into structured JSON (skills, experience, education)
→ Cloudinary stores original PDF
→ Parsed data stored in Resume table
→ Any pending applications re-scored automatically
```

---

## Troubleshooting

**"Cannot connect to database"**
→ Check `DATABASE_URL` format: `postgresql://user:pass@host:5432/dbname`

**"AI scoring returning 50 for all applications"**
→ Check `ANTHROPIC_API_KEY` is set. Fallback score is 50 when Claude fails.

**"Stripe webhook not firing"**
→ Verify webhook URL is correct and `STRIPE_WEBHOOK_SECRET` matches dashboard value.

**"Resume upload fails"**
→ Check Cloudinary credentials. Ensure file is PDF and under 5MB.

**"CORS errors in browser"**
→ Set `FRONTEND_URL` in backend env to exact frontend origin (no trailing slash).
# talent - match
