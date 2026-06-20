# Daily Poster Packet

## Awareness content and customer reviews

In the admin dashboard, awareness posters can use either **Google Sheet first, then AI fallback** or **AI only**. A shared sheet needs a `Date` column (`YYYY-MM-DD` or `DD/MM/YYYY`). When today's row exists, only that row is sent to Gemini for editing; the whole sheet is never included. When it does not, the normal AI brief is generated. Import [`sample-awareness-content.csv`](sample-awareness-content.csv) into Google Sheets to start.

For review posters, select `review` in the Generation Lab and either upload the customer's review screenshot or paste the review message. A screenshot is used to extract the testimonial and is carried into image generation as a factual reference.

## Admin content studio

Use the poster-type tabs at the top of the dashboard to switch between Awareness, Offer, Festival, Anniversary, Review, and General. Each type has its own reference-image library, generation prompt, generated gallery, and public context. The number on each tab shows how many references are saved for that type.

A production-oriented Cloudflare Worker that publishes stable brand/design context and can generate daily posters from Cloudflare Cron using Gemini.

The public context page is still useful for inspection and debugging, but the main automation path is now Worker-driven: Cron loads the brand context, asks Gemini for the day’s poster angle/brief, asks Gemini Flash Image for a 9:16 poster, stores the result in R2, and writes generation metadata to D1.

## What This App Does Now

The public page is intentionally stable. It contains:

- business name, phone, website
- logo image and direct logo URL
- brand colors, typography, visual style, do/don’t rules
- brand reference board
- one permanent poster-type reference image, such as `awareness`, `festival`, or `offer`
- a final ChatGPT task instruction

There is no need to upload a daily packet for normal poster generation. The automated path uses the stable brand system and poster-type reference.

Daily automation flow:

1. Cloudflare Cron invokes the Worker.
2. The orchestrator loads the business brand system and poster-type reference.
3. Gemini text generation creates a compact daily brief/angle for India/Kerala dental content.
4. Gemini Flash Image generates one 9:16 poster using the brief plus logo/brand/reference images.
5. The Worker stores the final poster in R2.
6. D1 stores status, prompt, brief, final image URL, model names, and validation notes.

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

The `dateOrToday` segment is kept for compatibility with existing Scheduled Task URLs. The page itself is stable and does not require a dated packet. The normal HTML page includes the logo, brand board, and poster reference image as readable base64 text blocks instead of `<img>` previews.

Admin UI:

- `GET /`
- `POST /admin/login`
- `GET /admin/:businessSlug`

Protected APIs:

- `PUT /api/business/:businessSlug/brand-system`
- `PUT /api/daily-poster/:businessSlug/:posterType/:date` — legacy/optional, not needed for the main stable-context workflow
- `POST /api/daily-brief/:businessSlug/:posterType/:dateOrToday` — manually generate only today’s speciality/brief
- `POST /api/orchestrate/:businessSlug/:posterType/:dateOrToday` — manually run the Gemini poster generator
- `GET /api/generated-poster/:businessSlug/:posterType/:dateOrToday` — inspect stored generation status/metadata

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
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
GEMINI_IMAGE_RESOLUTION=1K
PUBLIC_BASE_URL=https://poster.yourdomain.com
BUSINESS_TIMEZONE=Asia/Kolkata
DEFAULT_BUSINESS_SLUG=dr-poojas-smile-craft
DEFAULT_POSTER_TYPE=awareness
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

- `POSTER_ADMIN_TOKEN` is the admin password/token for the dashboard and every `/api/*` route.
- `GEMINI_API_KEY` is required for automated generation.
- `GEMINI_TEXT_MODEL` defaults to `gemini-3.5-flash`.
- `GEMINI_IMAGE_MODEL` defaults to `gemini-3.1-flash-image` and requests 1K output.
- `GEMINI_IMAGE_RESOLUTION` is the fallback for businesses without saved dashboard settings.
- `PUBLIC_BASE_URL` is used to build canonical public, JSON, and Markdown URLs.
- `BUSINESS_TIMEZONE` defaults to `Asia/Kolkata`.
- `DEFAULT_BUSINESS_SLUG` and `DEFAULT_POSTER_TYPE` control what the Cron trigger generates.
- `R2_PUBLIC_BASE_URL` is optional. Uploaded assets can also be served through this Worker at `/assets/...`.

Never commit `.dev.vars`.

## Database

The current migrations create:

- `business_brand_systems`
- `daily_poster_packets` — legacy/optional
- `poster_type_references`
- `generated_posters`

The automated workflow mainly uses `business_brand_systems`, `poster_type_references`, `generated_posters`, and R2 assets.

## Cloudflare deployment

Manual deployment:

```bash
npx wrangler d1 create daily-poster-packet-db
npm run db:migrate:remote
npx wrangler secret put POSTER_ADMIN_TOKEN
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Set `PUBLIC_BASE_URL`, `BUSINESS_TIMEZONE`, and optional R2 values under Worker variables or in the production Wrangler environment.

### GitHub Actions deployment

The repository includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A push to `main` or `master` runs formatting, type checks, tests, D1 migrations, secret setup, and Worker deployment.

Add these under **GitHub repository → Settings → Secrets and variables → Actions → Secrets**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `POSTER_ADMIN_TOKEN`
- `GEMINI_API_KEY`
- `PUBLIC_BASE_URL`
- `BUSINESS_TIMEZONE`
- `DEFAULT_BUSINESS_SLUG` — optional; defaults to `dr-poojas-smile-craft`
- `DEFAULT_POSTER_TYPE` — optional; defaults to `awareness`
- `CLOUDFLARE_D1_DATABASE_ID` — optional if the workflow should discover/create it
- `CLOUDFLARE_D1_DATABASE_NAME` — optional; defaults to `daily-poster-packet-db`
- `R2_BUCKET_NAME` — optional; defaults to `daily-poster-packet-assets`
- `R2_PUBLIC_BASE_URL` — optional public R2/custom-domain origin

The workflow can create missing D1/R2 resources by name. Your Cloudflare API token must include Workers Scripts edit, D1 edit, and Workers R2 Storage write permissions.

`POSTER_ADMIN_TOKEN` and `GEMINI_API_KEY` are written to Cloudflare Worker secrets by the deploy workflow from GitHub Actions secrets, so production deploys do not require running `wrangler secret put` locally.

## Admin dashboard workflow

1. Open `/`.
2. Select the business.
3. Enter `POSTER_ADMIN_TOKEN`.
4. Choose the content model, image model, and supported image resolution.
5. Upload or update the logo, brand reference board, brand rules, and multiple stable reference images per poster type.
6. Uncheck an existing reference and save to remove it from the active reference set.
7. Open the public context URL and confirm the images render.

Supported image settings:

| Image model              | Dashboard resolutions    | Poster style references used       |
| ------------------------ | ------------------------ | ---------------------------------- |
| `gemini-3.1-flash-image` | `512`, `1K`, `2K`, `4K`  | Up to available model input limit  |
| `gemini-3-pro-image`     | `1K`, `2K`, `4K`         | Up to 3 style references           |
| `gemini-2.5-flash-image` | Fixed approximately `1K` | 1 style reference in this workflow |

The dashboard filters resolution choices when the image model changes. The Worker validates and normalizes the saved settings again before calling Gemini.

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

ChatGPT Tasks are no longer required for the main automation. You can still use the public page as a manual fallback/debugging prompt:

> Every day at 9 AM, open this URL:  
> https://poster.yourdomain.com/daily-poster/dr-poojas-smile-craft/awareness/today
>
> Read the full poster design context page. The page includes the logo, brand reference board, and poster-type reference image as base64 text blocks, so do not require separate image URL fetching. Use the written hex palette and image color guidance as the exact color system. Check what is special or relevant today — festival, awareness day, clinic milestone, seasonal context, offer angle, review/social-proof idea, or local topic. Generate one 9:16 Instagram story poster using the brand system and today’s best content angle. Include the clinic name and phone number exactly. Keep the design modern, clean, premium, readable on mobile, and suitable for a dental clinic. If the context page itself cannot be accessed, tell me instead of generating.

## Automated Poster Generation

Manual first-step brief run:

```bash
curl -X POST "https://poster.yourdomain.com/api/daily-brief/dr-poojas-smile-craft/awareness/today" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN"
```

Manual full poster run:

```bash
curl -X POST "https://poster.yourdomain.com/api/orchestrate/dr-poojas-smile-craft/awareness/today" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN"
```

Check status:

```bash
curl "https://poster.yourdomain.com/api/generated-poster/dr-poojas-smile-craft/awareness/today" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN"
```

The configured Cron trigger runs daily at `03:00 UTC`, which is `08:30` in Asia/Kolkata.

## Privacy and indexing

Public context pages are intentionally unauthenticated so ChatGPT Tasks can read them. They include:

```html
<meta name="robots" content="noindex" />
```

`robots.txt` allows user/search fetchers such as ChatGPT-User and OAI-SearchBot so Scheduled Tasks can read the page, while blocking GPTBot. The page still sends `noindex` directives. This discourages indexing but is not security. Do not store private or sensitive information on public pages.

## API errors and validation

APIs return JSON with a useful `error` and, for validation failures, a `details` array.

Write routes require:

```http
Authorization: Bearer <POSTER_ADMIN_TOKEN>
```

Query-string tokens are not supported.
