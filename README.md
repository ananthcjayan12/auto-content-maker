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
4. Add the admin secret when deploying manually:

   ```bash
   npx wrangler secret put POSTER_ADMIN_TOKEN
   ```

5. Set `PUBLIC_BASE_URL`, `BUSINESS_TIMEZONE`, and optional R2 values under Worker variables or in the production Wrangler environment.
6. Deploy:

   ```bash
   npm run deploy
   ```

For R2, create a bucket, expose assets through a public custom domain, and save direct image URLs in the API payloads. The Worker does not proxy or hide image assets, because ChatGPT Tasks must be able to fetch them directly.

### GitHub Actions deployment

The repository includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A push to `main` or `master` runs formatting, type checks, and tests; applies production D1 migrations; configures the Worker admin secret; and deploys the Worker. The Worker serves both the public HTML pages and protected APIs, so a separate Cloudflare Pages deployment is not required.

For GitHub Actions deployment, all deployment configuration is read from GitHub repository **secrets**:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers Scripts edit and D1 edit permissions
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `POSTER_ADMIN_TOKEN` — long random bearer token for protected update APIs
- `PUBLIC_BASE_URL` — production origin, for example `https://poster.yourdomain.com`
- `BUSINESS_TIMEZONE` — optional; defaults to `Asia/Kolkata`
- `CLOUDFLARE_D1_DATABASE_ID` — optional existing D1 ID; the workflow discovers or creates the database when omitted
- `CLOUDFLARE_D1_DATABASE_NAME` — optional; defaults to `daily-poster-packet-db`
- `R2_BUCKET_NAME` — optional; defaults to `daily-poster-packet-assets` and is created when missing
- `R2_PUBLIC_BASE_URL` — optional public R2/custom-domain origin

Add them under **GitHub repository → Settings → Secrets and variables → Actions → Secrets → New repository secret**. GitHub Variables are not required by this workflow.

The workflow runs `npm run cloudflare:ensure-resources`. It checks the Cloudflare account for the configured D1 database and R2 bucket, creates missing resources, discovers the D1 UUID, and updates `wrangler.jsonc` only inside the ephemeral GitHub runner. You may therefore keep `replace-with-your-d1-database-id` in source control.

Production seed data is deliberately not applied on every deployment because that could overwrite current poster content. To seed a new database, open **Actions → Deploy Daily Poster Packet → Run workflow**, enable **Seed the production D1 database**, and run it once.

The workflow deploys the Worker, applies D1 migrations, and writes `POSTER_ADMIN_TOKEN` into Cloudflare automatically. You do not need to run `wrangler secret put` or `npm run deploy` manually when using GitHub Actions.

The API token must include Workers Scripts edit, D1 edit, and Workers R2 Storage write permissions so the workflow can provision resources. Resource creation is idempotent by name: an existing database or bucket is reused.

Creating an R2 bucket does not automatically create a production public URL. Configure an R2 custom domain (recommended) or enable its `r2.dev` URL in Cloudflare, then store that origin in `R2_PUBLIC_BASE_URL`. Likewise, configure the Worker custom domain in Cloudflare and store it in `PUBLIC_BASE_URL`.

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

The admin dashboard lets you upload one permanent production reference image per poster type, such as one stable `awareness` reference and one stable `offer` reference. Daily packet updates then only need the date-specific copy, campaign goal, CTA, and notes.

The API still accepts `productionReferenceImageUrl` as an optional daily override for special cases. For normal daily automation, leave it out and let the public page use the poster-type reference image.

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
    "specialInstructions": [
      "Use the awareness poster type reference as main visual inspiration",
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
4. Call the protected daily packet update endpoint with today’s copy and instructions.
5. Verify the returned public page loads.
6. Verify the poster-type production reference image is visible as a normal `<img>`.
7. Report success or failure.

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
