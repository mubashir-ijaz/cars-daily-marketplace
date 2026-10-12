# Cars Daily Marketplace

A mobile-friendly dashboard for private-seller cars priced against Manheim MMR.

- **One tab per marketplace.** Facebook Marketplace is the first; more can be added later.
- **Deals:** cars with a VIN where **MMR − asking price ≥ $1,000** (change it with `MIN_PROFIT`).
- **No VIN:** listings whose ad has no VIN, so MMR couldn't be checked.
- Optional password, optional email alerts, and an **×** button on each card to hide a car.

The **Marketplace Scanner** Chrome extension finds the cars and posts them to `/api/ingest`. The server applies the $1,000 rule, so cars below it are never stored.

## Deploy on Vercel
1. In Vercel, go to **Add New → Project** and import this GitHub repo. Keep the default settings (Next.js).
2. Go to **Storage → Create / Connect → Upstash Redis** (free tier), and connect it to this project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. Under **Settings → Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `INGEST_KEY` | **Required.** A long random secret. Paste the same value into the scanner extension. |
   | `DASHBOARD_PASSWORD` | Optional. Turns on the login screen. |
   | `MIN_PROFIT` | Optional. Default `1000`. |
   | `RESEND_API_KEY`, `ALERT_EMAIL_TO` | Optional. Sends an email when new deals or no-VIN cars arrive (resend.com). |
   | `ALERT_EMAIL_FROM` | Optional. Needs a domain verified in Resend. Default `onboarding@resend.dev`. |

4. Go to **Deployments → Redeploy** so the new variables take effect.
5. In the scanner extension's settings, paste your site URL (for example `https://cars-daily-marketplace.vercel.app`) and the `INGEST_KEY`. Then click **Send all now**.

## Adding another marketplace later
1. Add it to `lib/sources.ts`, for example `{ id: 'craigslist', name: 'Craigslist', short: 'Craigslist' }`. It gets its own tab with Deals and No VIN.
2. Have its scanner POST with `"source": "craigslist"`.

## Ingest API
```
POST /api/ingest
Authorization: Bearer <INGEST_KEY>
Content-Type: application/json

{ "source": "facebook",
  "listings": [ { "id": "123", "url": "https://…", "title": "2018 Toyota Camry SE",
                  "price": 14500, "mileage": 68000, "vin": "4T1B…", "location": "Dallas, TX",
                  "search": "Dallas", "img": "https://…", "mmrName": "…",
                  "mmrBase": 17200, "mmrGrade": 16900, "firstSeen": 1760000000000 } ] }
```
- Up to 500 listings per request.
- A car with a VIN is kept only if `(mmrGrade ?? mmrBase) − price ≥ MIN_PROFIT`. If a car that's already stored drops below that, it is removed.
- A car without a VIN goes to the No VIN tab.

## Local development
```
npm install
cp .env.example .env.local   # set INGEST_KEY
npm run dev
```
Without Upstash variables, cars are kept in memory, which is enough for testing.
