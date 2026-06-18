# Manual Workflow Check: Gemini Daily Poster Generation

Use this runbook to manually verify the new Cloudflare Worker orchestration flow end to end.

The goal is to confirm that:

1. GitHub Actions deploys the Worker correctly.
2. Cloudflare Worker secrets are configured.
3. D1 migrations are applied.
4. The public context page loads.
5. The protected manual trigger calls Gemini.
6. The generated poster is stored in R2.
7. Metadata is saved in D1.
8. The status endpoint returns the final poster URL.

## 1. Confirm Required GitHub Actions Secrets

Open:

```text
GitHub repo -> Settings -> Secrets and variables -> Actions -> Secrets
```

Confirm these secrets exist:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
POSTER_ADMIN_TOKEN
GEMINI_API_KEY
PUBLIC_BASE_URL
```

Optional secrets:

```text
BUSINESS_TIMEZONE
CLOUDFLARE_D1_DATABASE_ID
CLOUDFLARE_D1_DATABASE_NAME
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
DEFAULT_BUSINESS_SLUG
DEFAULT_POSTER_TYPE
```

Expected production values:

```text
PUBLIC_BASE_URL=https://posters.srshti.co.in
BUSINESS_TIMEZONE=Asia/Kolkata
DEFAULT_BUSINESS_SLUG=dr-poojas-smile-craft
DEFAULT_POSTER_TYPE=awareness
```

Important: `GEMINI_API_KEY` and `POSTER_ADMIN_TOKEN` are written to Cloudflare Worker secrets by `.github/workflows/deploy.yml`. You do not need to run `npx wrangler secret put GEMINI_API_KEY` locally for production if GitHub Actions deploy is used.

## 2. Deploy From GitHub Actions

Open:

```text
GitHub repo -> Actions -> Deploy Daily Poster Packet
```

Run the workflow manually with:

```text
workflow_dispatch
seed_database: false
```

Use `seed_database: true` only if you intentionally want to seed production again.

Expected successful steps:

```text
Validate project
- Check formatting
- Type check
- Run tests

Migrate D1 and deploy Worker
- Validate deployment configuration
- Ensure D1 database and R2 bucket exist
- Apply production D1 migrations
- Deploy Worker and public poster pages
- Configure Worker secrets
```

The `Configure Worker secrets` step should write:

```text
POSTER_ADMIN_TOKEN
GEMINI_API_KEY
```

## 3. Confirm Public Worker Health

Run:

```bash
curl -sS "https://posters.srshti.co.in/health" | jq
```

Expected:

```json
{
  "ok": true,
  "service": "daily-poster-packet",
  "openaiApiUsed": false
}
```

If this fails, the Worker is not deployed or the route/domain is not connected correctly.

## 4. Confirm Public Context Page Loads

Open in browser:

```text
https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today
```

Expected page content:

```text
Poster Design Context
Dr Pooja’s Smile Craft Dental Clinic
Logo image base64
Brand reference board image base64
awareness poster reference image base64
Hex palette for LLM
Final ChatGPT Task Instruction
```

Also check the JSON endpoint:

```bash
curl -sS "https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today.json" | jq
```

Expected important fields:

```json
{
  "businessBrandSystem": {
    "businessSlug": "dr-poojas-smile-craft",
    "businessName": "Dr Pooja’s Smile Craft Dental Clinic"
  },
  "posterType": "awareness",
  "resolvedDate": "YYYY-MM-DD",
  "posterTypeReference": {
    "productionReferenceImageUrl": "..."
  },
  "finalChatGPTInstruction": "..."
}
```

If `posterTypeReference.productionReferenceImageUrl` is `null`, upload the permanent awareness reference image from the admin dashboard before testing generation.

## 5. Manually Trigger Poster Generation

Set your admin token locally for convenience:

```bash
export POSTER_ADMIN_TOKEN="paste-your-production-admin-token"
```

First, manually generate only today’s speciality/brief:

```bash
curl -sS -X POST \
  "https://posters.srshti.co.in/api/daily-brief/dr-poojas-smile-craft/awareness/today" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" | jq
```

Expected success shape:

```json
{
  "success": true,
  "model": "gemini-3.5-flash",
  "businessSlug": "dr-poojas-smile-craft",
  "posterType": "awareness",
  "date": "YYYY-MM-DD",
  "contextJsonUrl": "https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today.json",
  "dailyBriefPrompt": "...",
  "dailyBrief": {
    "angle": "...",
    "headline": "...",
    "subheadline": "...",
    "requiredText": ["...", "..."],
    "visualDirection": "...",
    "safetyNotes": "..."
  },
  "rawText": "..."
}
```

This is the first Gemini call. It decides what is special, relevant, seasonal, or useful today in India/Kerala for the dental clinic poster.

After the brief looks correct, trigger today’s full awareness poster:

```bash
curl -sS -X POST \
  "https://posters.srshti.co.in/api/orchestrate/dr-poojas-smile-craft/awareness/today?force=true" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" | jq
```

Use `force=true` when you want to regenerate even if today already has a ready poster. Each generated image is saved with a unique run id in the filename, so forced regenerations produce a new URL instead of reusing a cached asset URL.

The full poster step makes the second Gemini call through the Interactions API using:

```text
model: gemini-3.1-flash-image
aspect_ratio: 9:16
image_size: 1K
```

Expected success shape:

```json
{
  "success": true,
  "generatedPoster": {
    "businessSlug": "dr-poojas-smile-craft",
    "posterType": "awareness",
    "date": "YYYY-MM-DD",
    "status": "ready",
    "contextUrl": "https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today",
    "contextJsonUrl": "https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today.json",
    "angle": "...",
    "briefJson": "{...}",
    "prompt": "...",
    "imageUrl": "https://posters.srshti.co.in/assets/businesses/dr-poojas-smile-craft/generated/awareness/YYYY-MM-DD-RUNID.jpg",
    "imageContentType": "image/jpeg",
    "r2Key": "businesses/dr-poojas-smile-craft/generated/awareness/YYYY-MM-DD-RUNID.jpg",
    "geminiTextModel": "gemini-3.5-flash",
    "geminiImageModel": "gemini-3.1-flash-image",
    "validationErrors": [],
    "failureReason": null
  }
}
```

Possible non-ready statuses:

```text
failed
needs_review
processing
```

For `failed`, check `generatedPoster.failureReason`.

For `needs_review`, check `generatedPoster.validationErrors`.

## 6. Check Stored Poster Status

Run:

```bash
curl -sS \
  "https://posters.srshti.co.in/api/generated-poster/dr-poojas-smile-craft/awareness/today" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" | jq
```

Expected:

```json
{
  "success": true,
  "generatedPoster": {
    "status": "ready",
    "imageUrl": "https://posters.srshti.co.in/assets/businesses/dr-poojas-smile-craft/generated/awareness/YYYY-MM-DD-RUNID.jpg"
  }
}
```

Copy `generatedPoster.imageUrl` and open it in the browser.

Expected visual result:

```text
One vertical 9:16 poster image
Clinic name visible exactly
Phone number visible exactly
Modern dental clinic design
No invented replacement logo
Readable on mobile
```

## 7. Confirm R2 Asset Exists

From the status response, copy:

```text
generatedPoster.r2Key
```

Expected key pattern:

```text
businesses/dr-poojas-smile-craft/generated/awareness/YYYY-MM-DD-RUNID.jpg
```

Check in Cloudflare:

```text
Cloudflare Dashboard -> R2 -> daily-poster-packet-assets -> Objects
```

Confirm that object exists.

If using the Worker asset route, this URL should load:

```text
https://posters.srshti.co.in/assets/businesses/dr-poojas-smile-craft/generated/awareness/YYYY-MM-DD-RUNID.jpg
```

## 8. Confirm D1 Metadata Exists

Use Cloudflare dashboard D1 query console, or Wrangler:

```bash
npx wrangler d1 execute daily-poster-packet-db --remote --command \
"SELECT business_slug, poster_type, poster_date, status, image_url, failure_reason, updated_at
 FROM generated_posters
 WHERE business_slug = 'dr-poojas-smile-craft'
   AND poster_type = 'awareness'
 ORDER BY poster_date DESC
 LIMIT 5;"
```

Expected:

```text
business_slug: dr-poojas-smile-craft
poster_type: awareness
poster_date: today’s date in Asia/Kolkata
status: ready
image_url: non-empty
failure_reason: null
```

## 9. Confirm Cron Is Configured

Open:

```text
Cloudflare Dashboard -> Workers & Pages -> daily-poster-packet -> Triggers
```

Expected Cron:

```text
0 3 * * *
```

This runs at:

```text
03:00 UTC
08:30 Asia/Kolkata
```

The Cron target uses:

```text
DEFAULT_BUSINESS_SLUG=dr-poojas-smile-craft
DEFAULT_POSTER_TYPE=awareness
```

If those variables are not configured in Cloudflare, the code falls back to the same default values.

## 10. Common Failures And Fixes

### 401 Unauthorized

Cause:

```text
Missing or wrong Authorization: Bearer token
```

Fix:

```bash
export POSTER_ADMIN_TOKEN="correct-production-token"
```

Then retry the request.

### GEMINI_API_KEY is not configured

Cause:

```text
GitHub Actions did not write the Worker secret, or the GitHub secret is missing.
```

Fix:

1. Add `GEMINI_API_KEY` to GitHub Actions secrets.
2. Re-run the deploy workflow.
3. Confirm the `Configure Worker secrets` step passed.

### R2 asset storage is not configured

Cause:

```text
The Worker does not have the `ASSETS` R2 binding.
```

Fix:

Check `wrangler.jsonc` and Cloudflare Worker bindings.

Expected binding:

```text
ASSETS -> daily-poster-packet-assets
```

### Poster context unavailable

Cause:

```text
Business slug, poster type, or brand system is missing.
```

Fix:

Check:

```text
business_brand_systems
poster_type_references
```

Also verify:

```text
https://posters.srshti.co.in/daily-poster/dr-poojas-smile-craft/awareness/today.json
```

### No poster-type reference image

Cause:

```text
The awareness reference image has not been uploaded.
```

Fix:

Open admin dashboard and upload a permanent `awareness` poster reference.

### needs_review

Cause:

```text
Gemini returned something unexpected, usually no inline image.
```

Check:

```text
generatedPoster.validationErrors
generatedPoster.failureReason
```

Retry once:

```bash
curl -sS -X POST \
  "https://posters.srshti.co.in/api/orchestrate/dr-poojas-smile-craft/awareness/today?force=true" \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" | jq
```

### Generated image URL does not load

Cause:

```text
R2 object was not saved, R2 binding is wrong, or /assets route cannot read the object.
```

Check:

1. `generatedPoster.r2Key`
2. R2 bucket object list
3. Worker logs
4. `/assets/...` URL

## 11. Final Acceptance Checklist

Use this checklist after a manual run:

```text
[ ] GitHub deploy workflow passed.
[ ] /health returns ok.
[ ] Public context HTML page loads.
[ ] Public context JSON endpoint loads.
[ ] Logo base64 appears on public page.
[ ] Brand board base64 appears on public page.
[ ] Awareness poster reference base64 appears on public page.
[ ] Manual POST /api/daily-brief returns today’s speciality/brief.
[ ] Manual POST /api/orchestrate returns success true.
[ ] generatedPoster.status is ready.
[ ] generatedPoster.imageUrl is non-empty.
[ ] generatedPoster.validationErrors is empty.
[ ] generatedPoster.failureReason is null.
[ ] Image URL opens in browser.
[ ] R2 object exists.
[ ] D1 generated_posters row exists.
[ ] Poster includes clinic name exactly.
[ ] Poster includes phone number exactly.
[ ] Poster is vertical 9:16 and readable on mobile.
```

When every item is checked, the manual end-to-end workflow is working correctly.
