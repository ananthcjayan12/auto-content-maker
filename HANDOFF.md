# Handoff: Daily Poster Packet

Last updated: 2026-06-18  
Project path: `/Users/ananthu/Desktop/new_repos/auto-content-maker`  
Project name: `daily-poster-packet`

## 2026-06-18 update: new Gemini orchestrator flow

The direction changed from “ChatGPT Scheduled Task opens the public page and generates the poster inside ChatGPT” to the Worker-driven flow in `new_flow.md`.

What is now implemented:

1. Cloudflare Cron runs daily.
2. The Worker loads the stable brand/poster context.
3. Gemini text generation creates a structured daily brief/angle for India/Kerala dental content.
4. Gemini Flash Image generates a 9:16 poster using the prompt plus logo, brand board, and poster-type reference images.
5. The Worker stores the generated image in R2.
6. D1 stores status, brief, prompt, final image URL, model names, and validation notes.

The public HTML page at `/daily-poster/.../today` still exists and still shows images as base64 text blocks. It is now mainly a context/debug page and a manual fallback.

New protected routes:

```text
POST /api/daily-brief/:businessSlug/:posterType/:dateOrToday
POST /api/orchestrate/:businessSlug/:posterType/:dateOrToday
GET /api/generated-poster/:businessSlug/:posterType/:dateOrToday
```

Manual daily speciality/brief trigger:

```text
POST https://posters.srshti.co.in/api/daily-brief/dr-poojas-smile-craft/awareness/today
Authorization: Bearer <POSTER_ADMIN_TOKEN>
```

Manual production trigger:

```text
POST https://posters.srshti.co.in/api/orchestrate/dr-poojas-smile-craft/awareness/today
Authorization: Bearer <POSTER_ADMIN_TOKEN>
```

Status:

```text
GET https://posters.srshti.co.in/api/generated-poster/dr-poojas-smile-craft/awareness/today
Authorization: Bearer <POSTER_ADMIN_TOKEN>
```

New files/changes:

- `src/orchestrator.ts` — Gemini text + Gemini image pipeline, R2 storage, generation validation.
- `migrations/0004_generated_posters.sql` — generated poster metadata table.
- `src/types.ts` — `GeneratedPoster` types and Gemini/default bindings.
- `src/store.ts` — D1 persistence for `generated_posters`.
- `src/index.ts` — manual orchestration/status APIs plus Worker `scheduled` handler.
- `wrangler.jsonc` — daily Cron trigger at `0 3 * * *` UTC, which is 08:30 Asia/Kolkata.
- `test/app.test.ts` — mocked Gemini/R2 orchestration tests.

Required new secret:

```dotenv
GEMINI_API_KEY=
```

Optional generation variables:

```dotenv
GEMINI_TEXT_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
DEFAULT_BUSINESS_SLUG=dr-poojas-smile-craft
DEFAULT_POSTER_TYPE=awareness
```

Latest successful verification:

```text
npm run typecheck
npm test
18 tests passed
```

## Current objective

This project publishes a public, read-only context page that ChatGPT Scheduled Tasks can open every day to generate a business poster.

The current desired workflow is intentionally simple:

1. ChatGPT opens one public HTML URL.
2. The page contains all stable brand/design context.
3. The page does **not** require daily packet updates.
4. The page does **not** show images with `<img>` tags.
5. Instead, the page shows image files as readable base64 text blocks:
   - logo
   - brand reference board
   - poster-type reference image
6. ChatGPT reads the brand rules, exact hex colors, and base64 image text, then decides what is special today and generates the poster inside ChatGPT.

Important: the user changed direction several times. The final accepted direction is:

> Keep the normal HTML page at `/daily-poster/.../today`, but instead of showing image previews, show images as base64 text blocks on the page.

## Production URL to use

```text
https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today
```

Do **not** use the older experimental URLs:

- `.md`
- `.txt`
- `.inline.html`
- `.images.json`

Those experimental public route behaviors were removed from the active route logic. The only public routes that matter now are:

```text
GET /daily-poster/:businessSlug/:posterType/:dateOrToday
GET /daily-poster/:businessSlug/:posterType/:dateOrToday.json
GET /robots.txt
GET /health
```

## Current ChatGPT Scheduled Task prompt

Use this prompt after deploying the current code:

```text
Every day at 9 AM, open this URL:

https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today

Read the full poster design context page.

The page contains:
- brand system
- exact hex colors
- logo image as base64 text
- brand reference board image as base64 text
- poster reference image as base64 text
- final design instruction

Use the base64 image text blocks as the image references. Do not require separate image URL fetching.

Check what is special or relevant today in India/Kerala for a dental clinic poster.

Create one 9:16 Instagram story poster for Dr Pooja’s Smile Craft Dental Clinic.

Include exactly:
Dr Pooja’s Smile Craft Dental Clinic
7907006842

Keep the design modern, clean, premium, readable on mobile, and suitable for a dental clinic. Do not create a crowded flyer or invent a new logo.

If the context page itself cannot be accessed, tell me instead of generating.
```

## Stack

- TypeScript
- Hono on Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- Server-rendered HTML
- No OpenAI API usage in this project

## Important files

### `src/index.ts`

Main Worker app.

Key responsibilities:

- Hono app setup and security headers
- admin login/dashboard routes
- protected API routes
- public poster context route
- asset serving from R2
- image-to-base64 conversion for the public HTML page

Important functions/sections:

- `storeFor(env)` — picks `TEST_STORE` in tests or `D1PosterStore` in production.
- `baseUrl(requestUrl, configured)` — uses `PUBLIC_BASE_URL` if configured.
- `arrayBufferToBase64(buffer)` — converts image bytes to base64.
- `imageUrlToBase64({ url, env, publicBaseUrl })` — converts either Worker-served R2 asset URLs or external public image URLs to base64 metadata:

  ```ts
  {
    url: string;
    contentType: string;
    byteLength: number;
    base64: string;
  }
  ```

- `loadPublicContext(...)` — validates slug/poster type/date and loads:
  - brand system
  - poster type reference
  - resolved date

- Public route:

  ```ts
  app.get("/daily-poster/:businessSlug/:posterType/:dateOrToday", ...)
  ```

  Behavior:

  - `/today` resolves date using configured business timezone.
  - `.json` returns lightweight structured JSON.
  - normal HTML fetches logo/board/reference image bytes and renders them as base64 text blocks.

Current public HTML render call:

```ts
renderPosterPage({
  brand: result.brand,
  posterType: result.posterType,
  typeReference: result.typeReference,
  publicPageUrl,
  jsonUrl,
  imageBase64: {
    logo: logoBase64,
    brandReferenceBoard: brandReferenceBoardBase64,
    posterReference: posterReferenceBase64,
  },
});
```

### `src/render.ts`

Server-rendered public HTML page.

Key responsibilities:

- `buildFinalInstruction(...)`
- `renderPosterPage(...)`
- `renderErrorPage(...)`

The public page currently:

- uses semantic HTML
- includes `noindex`
- shows business info
- shows direct source URLs for images
- shows base64 image text blocks inside readonly `<textarea>` elements
- shows brand hex palette and design rules
- shows final ChatGPT instruction
- does **not** render public image previews with `<img>`

Important helper:

```ts
function imageBase64Block(label: string, image: ImageBase64Reference): string;
```

It renders:

- source URL
- content type
- byte length
- readonly textarea with base64

### `src/admin-render.ts`

Admin dashboard HTML.

Current dashboard lets the user:

- choose poster type
- upload/update permanent poster-type reference image
- edit brand system
- upload logo
- upload brand reference board
- apply Dr Pooja Smile Craft preset

This dashboard can still show image previews because it is admin-only. The user’s “no images, base64 text” requirement applies to the public ChatGPT context page.

### `src/store.ts`

D1-backed storage.

Tables used:

- `business_brand_systems`
- `daily_poster_packets` — legacy/optional
- `poster_type_references`

Daily packet support still exists for compatibility, but the current workflow does not require daily packet updates.

### `src/types.ts`

Core types:

- `BusinessBrandSystem`
- `DailyPosterPacket`
- `PosterTypeReference`
- `PosterStore`
- `Bindings`

Supported poster types:

```ts
awareness;
offer;
festival;
anniversary;
review;
general;
```

### `src/brand-presets.ts`

Contains the Dr Pooja Smile Craft design preset:

- deep teal `#008E8C`
- pale aqua `#DFF7F7`
- white `#FFFFFF`
- deep navy `#071529`
- muted text `#5F7478`
- bold geometric premium style

### `test/app.test.ts`

Vitest tests with in-memory `PosterStore`.

Current relevant public page tests:

- homepage/admin login renders
- admin auth works
- poster type reference upload works
- Smile Craft preset applies
- public page renders stable brand context
- public page includes base64 text blocks
- `.json` endpoint works without requiring a daily packet
- protected API auth and update validation
- missing reference warning

Latest successful test count: 16 passing.

### `README.md`

Updated to describe the simplified current model:

- normal public HTML page
- images as base64 text blocks
- no daily packet requirement
- ChatGPT Task setup prompt

### `.github/workflows/deploy.yml`

GitHub Actions deployment workflow.

It:

- runs format check, typecheck, tests
- ensures Cloudflare resources
- applies D1 migrations
- deploys Worker
- writes `POSTER_ADMIN_TOKEN` and `GEMINI_API_KEY` Worker secrets using Wrangler from GitHub Actions secrets

Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `POSTER_ADMIN_TOKEN`
- `GEMINI_API_KEY`
- `PUBLIC_BASE_URL`
- optional `BUSINESS_TIMEZONE`
- optional `CLOUDFLARE_D1_DATABASE_ID`
- optional `CLOUDFLARE_D1_DATABASE_NAME`
- optional `R2_BUCKET_NAME`
- optional `R2_PUBLIC_BASE_URL`

## Environment variables

```dotenv
POSTER_ADMIN_TOKEN=
PUBLIC_BASE_URL=
BUSINESS_TIMEZONE=Asia/Kolkata
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

Notes:

- `POSTER_ADMIN_TOKEN` is used for admin login and `/api/*` bearer auth.
- `PUBLIC_BASE_URL` should be `https://posters.srshti.co.in` in production.
- Default business timezone is `Asia/Kolkata`.

## Cloudflare resources

Configured in `wrangler.jsonc`:

- D1 binding: `DB`
- D1 database name: `daily-poster-packet-db`
- R2 binding: `ASSETS`
- R2 bucket name: `daily-poster-packet-assets`

The app serves R2 assets at:

```text
/assets/:key
```

The public HTML page may fetch source image bytes server-side from:

- Worker-served `/assets/...`
- external public image URLs

Then converts to base64 and renders as text.

## Robots / indexing

`robots.txt` currently:

- allows `ChatGPT-User`
- allows `OAI-SearchBot`
- blocks `GPTBot`
- allows `*`

The public page sends:

```html
<meta name="robots" content="noindex" />
```

and header:

```http
X-Robots-Tag: noindex
```

Reason: ChatGPT Scheduled Tasks must be able to fetch the page, but we do not want casual indexing.

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:8787/daily-poster/dr-poojas-smile-craft/awareness/today
```

## Verification commands

Latest successful commands:

```bash
npm run format
npm run typecheck
npm test
npm run format:check
```

Latest result:

```text
16 tests passed
```

## Current git state at handoff

Expected modified files:

```text
README.md
src/index.ts
src/render.ts
test/app.test.ts
```

These modifications represent the final simplification to one normal public HTML page with base64 text blocks.

## Important design decisions and why

### Why no OpenAI API?

The project’s job is only to publish context. ChatGPT Scheduled Tasks will generate the actual image inside ChatGPT.

### Why not daily packets?

The user decided daily packet updates are unnecessary. The scheduled GPT should visit the stable context page and independently decide what is special today.

### Why base64 text instead of `<img>`?

ChatGPT had trouble fetching image URLs from the public page. The final chosen solution is to render the image payloads as base64 text blocks directly in the HTML page. This keeps the page as a single fetch target.

### Why not separate `.md`, `.txt`, `.inline.html`, or `.images.json`?

Those were explored temporarily but removed from active behavior after the user clarified they want a normal HTML page at the original URL.

## Known caveats

1. Large images can create very large HTML responses because base64 expands binary by about 33%.
2. If images are too large, ChatGPT may truncate context or fail to process the full page.
3. Consider adding image compression/resizing later if the base64 payload becomes too big.
4. External image URLs must be reachable by the Worker at render time; otherwise the page shows a warning for that image’s base64 block.
5. Admin dashboard still shows normal image previews; public page does not.

## Recommended next work

1. Deploy current changes.
2. Open production URL:

   ```text
   https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today
   ```

3. Confirm page contains:

   - `Logo image base64`
   - `Brand reference board image base64`
   - `awareness poster reference image base64`
   - exact hex palette
   - final ChatGPT instruction

4. Run the ChatGPT Scheduled Task with the prompt above.
5. If ChatGPT still has trouble, reduce base64 size by compressing uploaded source images or implement server-side resizing before base64 conversion.
