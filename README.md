# Daily Poster Packet

A production-oriented Cloudflare Worker that combines a business’s long-lived brand system with a date-specific poster packet. It serves semantic, server-rendered HTML and public JSON for ChatGPT Scheduled Tasks, plus bearer-protected APIs for Codex automation.

This project does **not** use the OpenAI API. It only publishes the context that a ChatGPT Task can inspect before generating an image inside ChatGPT.

## Stack

- TypeScript
- Hono on Cloudflare Workers
- Cloudflare D1
- R2-compatible public asset URLs (R2 is optional; images can live anywhere publicly readable)
- Server-rendered HTML with optional JavaScript copy-button enhancement

## Routes

Public:

- `GET /daily-poster/:businessSlug/:posterType/:dateOrToday`
- `GET /daily-poster/:businessSlug/:posterType/:dateOrToday.json`
- `GET /robots.txt`
- `GET /health`

Protected:

- `PUT /api/business/:businessSlug/brand-system`
- `PUT /api/daily-poster/:businessSlug/:posterType/:date`

Supported poster types: `awareness`, `offer`, `festival`, `anniversary`, `review`, and `general`.

The `today` alias resolves using `BUSINESS_TIMEZONE`, which defaults to `Asia/Kolkata`.

## Local setup

Requirements: Node.js 20+ and a Cloudflare account for deployment.

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

The included seed is dated `2026-06-18`. If running on another date, open the explicit seeded URL or update today’s packet:

```text
http://localhost:8787/daily-poster/dr-poojas-smile-craft/awareness/2026-06-18
```

Useful checks:

```bash
npm run format
npm run typecheck
npm test
```

## Environment variables

Create `.dev.vars` for local secrets. Configure production variables and secrets in Cloudflare.

```dotenv
POSTER_ADMIN_TOKEN=use-a-long-random-secret
PUBLIC_BASE_URL=https://poster.yourdomain.com
BUSINESS_TIMEZONE=Asia/Kolkata
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

- `POSTER_ADMIN_TOKEN` is required by every `/api/*` route.
- `PUBLIC_BASE_URL` is used to build canonical public and JSON URLs.
- `BUSINESS_TIMEZONE` controls `/today`.
- R2 variables are optional metadata for your automation. Store direct public R2 URLs in the brand or packet records.

Never commit `.dev.vars`.

## Database

The migration creates:

- `business_brand_systems`
- `daily_poster_packets`

Brand data remains separate from daily content. Daily packets have a unique constraint across `business_slug`, `poster_type`, and `poster_date`.

For production:

```bash
npx wrangler d1 create daily-poster-packet-db
```

Copy the returned database ID into `wrangler.jsonc`, then run:

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

## Cloudflare deployment

1. Create the D1 database with `npx wrangler d1 create daily-poster-packet-db`.
2. Replace the placeholder `database_id` in `wrangler.jsonc`.
3. Apply remote migrations and optionally seed.
4. Add the admin secret:

   ```bash
   npx wrangler secret put POSTER_ADMIN_TOKEN
   ```

5. Set `PUBLIC_BASE_URL` and `BUSINESS_TIMEZONE` under Worker variables or in the production Wrangler environment.
6. Deploy:

   ```bash
   npm run deploy
   ```

For R2, create a bucket, expose assets through a public custom domain, and save direct image URLs in the API payloads. The Worker does not proxy or hide image assets, because ChatGPT Tasks must be able to fetch them directly.

## Updating the brand system

Brand updates are upserts. The request body can contain the complete `BusinessBrandSystem`; the path owns `businessSlug`.

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
      "primary": "#0EA5A4",
      "secondary": "#F7E7CE",
      "accent": "#FFFFFF",
      "darkText": "#123333",
      "mutedText": "#5F6F6F"
    },
    "typography": {
      "headingStyle": "modern premium sans-serif",
      "bodyStyle": "clean readable sans-serif",
      "fontMood": "premium, soft, clinical, friendly"
    },
    "visualStyle": {
      "mood": "modern, clean, premium, warm dental clinic aesthetic",
      "layout": "minimal, high whitespace, elegant curved shapes",
      "photoStyle": "bright dental clinic photography and soft lighting",
      "avoid": ["crowded flyer look", "too many colors"]
    },
    "defaultPosterRules": [
      "Always keep the design clean and premium",
      "Use clinic name and phone number exactly"
    ]
  }'
```

## Updating a daily packet

The daily endpoint requires an existing business brand system. Identity comes from the URL, so concise automation payloads do not need to repeat slug, poster type, or date. If `status` is omitted it defaults to `ready`; ready packets require a production reference image.

```bash
curl -X PUT "https://poster.yourdomain.com/api/daily-poster/dr-poojas-smile-craft/awareness/2026-06-18" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "headline": "A Cleaner Smile Starts Here",
    "subheadline": "Gentle dental cleaning for a healthier smile",
    "cta": "Book your appointment today",
    "campaignGoal": "Create awareness and encourage appointment booking",
    "targetAudience": "Local families and adults looking for dental care",
    "productionReferenceImageUrl": "https://poster.yourdomain.com/assets/daily/2026-06-18-cleaning-reference.jpg",
    "specialInstructions": [
      "Use the reference image as main visual inspiration",
      "Keep the design premium and minimal"
    ]
  }'
```

If `chatgptImagePrompt` is omitted, the API generates one from the business name and required text. If `requiredText` is omitted, it defaults to the exact business name and phone number.

## Codex Daily Automation

Suggested workflow:

1. Run daily at a fixed time.
2. Call the business content API.
3. Fetch today’s campaign details.
4. Fetch or upload today’s production reference image to a publicly readable URL.
5. Call the protected daily packet update endpoint.
6. Verify the returned public page loads.
7. Verify the production reference image is visible as a normal `<img>`.
8. Report success or failure.

Treat a `200` API response as the start of verification, not the end: fetch both returned URLs and confirm the resolved date, headline, and image URL.

## ChatGPT Task Setup

Suggested scheduled task prompt:

> Every day at 9 AM, open this URL:  
> https://poster.yourdomain.com/daily-poster/dr-poojas-smile-craft/awareness/today
>
> Read the full poster packet page. Inspect the logo, brand reference board, and production reference image. Generate one 9:16 Instagram story poster using the brand system and today’s content. Include the clinic name and phone number exactly. Keep the design modern, clean, premium, and suitable for a dental clinic. If the reference image or logo cannot be accessed, tell me instead of generating.

The page is intentionally public, read-only, `noindex`, and fully rendered on the server. Do not store private or sensitive information in a poster packet. `robots.txt` discourages indexing but is not authentication.

## API errors and validation

APIs return JSON with a useful `error` and, for validation failures, a `details` array. Common responses:

- `400`: malformed JSON, conflicting identity fields, invalid slug/type/date, or missing required content
- `401`: missing/invalid bearer token or missing configured server token
- `404`: missing business for daily updates, missing brand, or missing packet
- `500`: unexpected database/runtime failure

Write routes only accept bearer authentication:

```http
Authorization: Bearer <POSTER_ADMIN_TOKEN>
```

Query-string tokens are not supported.
