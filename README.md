# Daily Poster Packet

A production-oriented Cloudflare Worker that publishes a simple, stable brand/design context page for ChatGPT Scheduled Tasks.

This project does **not** use the OpenAI API. ChatGPT Tasks open the public page, inspect the logo/reference images/design system, decide what is special today, and generate the poster inside ChatGPT.

## What this app does now

The public page is intentionally stable. It contains:

- business name, phone, website
- logo image and direct logo URL
- brand colors, typography, visual style, do/don’t rules
- brand reference board
- one permanent poster-type reference image, such as `awareness`, `festival`, or `offer`
- a final ChatGPT task instruction

There is no need to upload a daily packet for normal poster generation.

## Stack

- TypeScript
- Hono on Cloudflare Workers
- Cloudflare D1
- Cloudflare R2 for uploaded assets
- Server-rendered HTML with optional JavaScript copy buttons

## Routes

Public:

- `GET /daily-poster/:businessSlug/:posterType/:dateOrToday`
- `GET /daily-poster/:businessSlug/:posterType/:dateOrToday.json`
- `GET /robots.txt`
- `GET /health`

The `dateOrToday` segment is kept for compatibility with existing Scheduled Task URLs. The page itself is stable and does not require a dated packet.

Admin UI:

- `GET /`
- `POST /admin/login`
- `GET /admin/:businessSlug`

Protected APIs:

- `PUT /api/business/:businessSlug/brand-system`
- `PUT /api/daily-poster/:businessSlug/:posterType/:date` — legacy/optional, not needed for the main stable-context workflow

Supported poster types: `awareness`, `offer`, `festival`, `anniversary`, `review`, and `general`.

## Local setup

Requirements: Node.js 22+ and a Cloudflare account for deployment.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run db:seed
npm run dev
```

Then open:

```text
http://localhost:8787/daily-poster/dr-poojas-smile-craft/awareness/today
```

Useful checks:

```bash
npm run format
npm run typecheck
npm test
```

## Environment variables

Create `.dev.vars` for local secrets. Configure production variables and secrets in Cloudflare or GitHub Actions.

```dotenv
POSTER_ADMIN_TOKEN=use-a-long-random-secret
PUBLIC_BASE_URL=https://poster.yourdomain.com
BUSINESS_TIMEZONE=Asia/Kolkata
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

- `POSTER_ADMIN_TOKEN` is the admin password/token for the dashboard and every `/api/*` route.
- `PUBLIC_BASE_URL` is used to build canonical public and JSON URLs.
- `BUSINESS_TIMEZONE` defaults to `Asia/Kolkata`.
- `R2_PUBLIC_BASE_URL` is optional. Uploaded assets can also be served through this Worker at `/assets/...`.

Never commit `.dev.vars`.

## Database

The current migrations create:

- `business_brand_systems`
- `daily_poster_packets` — legacy/optional
- `poster_type_references`

The stable workflow mainly uses `business_brand_systems` and `poster_type_references`.

## Cloudflare deployment

Manual deployment:

```bash
npx wrangler d1 create daily-poster-packet-db
npm run db:migrate:remote
npx wrangler secret put POSTER_ADMIN_TOKEN
npm run deploy
```

Set `PUBLIC_BASE_URL`, `BUSINESS_TIMEZONE`, and optional R2 values under Worker variables or in the production Wrangler environment.

### GitHub Actions deployment

The repository includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A push to `main` or `master` runs formatting, type checks, tests, D1 migrations, secret setup, and Worker deployment.

Add these under **GitHub repository → Settings → Secrets and variables → Actions → Secrets**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `POSTER_ADMIN_TOKEN`
- `PUBLIC_BASE_URL`
- `BUSINESS_TIMEZONE`
- `CLOUDFLARE_D1_DATABASE_ID` — optional if the workflow should discover/create it
- `CLOUDFLARE_D1_DATABASE_NAME` — optional; defaults to `daily-poster-packet-db`
- `R2_BUCKET_NAME` — optional; defaults to `daily-poster-packet-assets`
- `R2_PUBLIC_BASE_URL` — optional public R2/custom-domain origin

The workflow can create missing D1/R2 resources by name. Your Cloudflare API token must include Workers Scripts edit, D1 edit, and Workers R2 Storage write permissions.

## Admin dashboard workflow

1. Open `/`.
2. Select the business.
3. Enter `POSTER_ADMIN_TOKEN`.
4. Upload or update the logo, brand reference board, brand rules, and stable reference image per poster type.
5. Open the public context URL and confirm the images render.

For Dr Pooja’s Smile Craft:

```text
https://poster.yourdomain.com/daily-poster/dr-poojas-smile-craft/awareness/today
```

## Updating the brand system by API

```bash
curl -X PUT "https://poster.yourdomain.com/api/business/dr-poojas-smile-craft/brand-system" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Dr Pooja’s Smile Craft Dental Clinic",
    "phone": "7907006842",
    "websiteUrl": "https://drpoojassmilecraftdental.com/",
    "logoUrl": "https://poster.yourdomain.com/assets/dr-pooja/logo.png",
    "brandReferenceBoardUrl": "https://poster.yourdomain.com/assets/dr-pooja/brand-reference-board.png",
    "colors": {
      "primary": "#008E8C",
      "secondary": "#EAF9F8",
      "accent": "#FFFFFF",
      "darkText": "#071529",
      "mutedText": "#5F6F6F"
    },
    "typography": {
      "headingStyle": "bold geometric sans-serif with premium medical clarity",
      "bodyStyle": "clean readable sans-serif",
      "fontMood": "modern, premium, confident, warm clinical"
    },
    "visualStyle": {
      "mood": "modern, clean, premium, warm dental clinic aesthetic",
      "layout": "minimal, high whitespace, strong hierarchy, elegant curves",
      "photoStyle": "bright dental clinic photography and soft lighting",
      "avoid": ["crowded flyer look", "too many colors", "cheap stock poster style"]
    },
    "defaultPosterRules": [
      "Always keep the design clean and premium",
      "Use clinic name and phone number exactly",
      "Prefer 9:16 Instagram story aspect ratio"
    ]
  }'
```

## ChatGPT Task Setup

Suggested scheduled task prompt:

> Every day at 9 AM, open this URL:  
> https://poster.yourdomain.com/daily-poster/dr-poojas-smile-craft/awareness/today
>
> Read the full poster design context page. Inspect the logo, brand reference board, brand colors, typography, and poster-type reference image. Check what is special or relevant today — festival, awareness day, clinic milestone, seasonal context, offer angle, review/social-proof idea, or local topic. Generate one 9:16 Instagram story poster using the brand system and today’s best content angle. Include the clinic name and phone number exactly. Keep the design modern, clean, premium, readable on mobile, and suitable for a dental clinic. If the reference image, brand board, or logo cannot be accessed, tell me instead of generating.

## Codex automation

Codex daily automation no longer needs to update content every day.

Recommended workflow:

- Periodically verify the stable public URL loads.
- Verify the logo, brand board, and poster-type reference image are visible.
- Only update the dashboard/API when the brand system or reference images change.
- Let ChatGPT Scheduled Tasks decide the day’s poster content from the current date and context.

## Privacy and indexing

Public context pages are intentionally unauthenticated so ChatGPT Tasks can read them. They include:

```html
<meta name="robots" content="noindex, nofollow" />
```

and `robots.txt` disallows all crawlers. This discourages indexing but is not security. Do not store private or sensitive information on public pages.

## API errors and validation

APIs return JSON with a useful `error` and, for validation failures, a `details` array.

Write routes require:

```http
Authorization: Bearer <POSTER_ADMIN_TOKEN>
```

Query-string tokens are not supported.
