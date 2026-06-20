# Daily Poster Automation and Delivery Guide

## Recommended production setup

Use this workflow:

1. Cloudflare Cron runs a lightweight five-minute heartbeat.
2. The Worker generates the Awareness poster and stores it in R2.
3. D1 records the final status, prompt, image URL, usage, and cost.
4. When the poster reaches `ready`, send an **email with the poster attached** to the clinic owner.
5. Optionally send the same image through **Telegram** for faster phone notifications.
6. Add WhatsApp later when its business-template and onboarding work is complete.

Email is the recommended first delivery channel because the clinic owner needs no new app, can download the original image, can search previous posters, and can forward it to staff. Telegram is technically simpler and more immediate than WhatsApp, but the owner must use Telegram and start the bot once.

## Part 1: Enable the Cloudflare Cron

### Current project state

The project contains a heartbeat Cron Trigger in `wrangler.jsonc`:

```jsonc
"triggers": {
  "crons": ["*/5 * * * *"]
}
```

Cloudflare Cron expressions run in UTC, but this trigger does not contain the clinic schedule. The admin dashboard stores the local time, poster types, force policy, email state, and recipients in D1. Each business/type/date is claimed only once.

### What the scheduled job currently generates

The scheduled handler uses:

```dotenv
DEFAULT_BUSINESS_SLUG=dr-poojas-smile-craft
DEFAULT_POSTER_TYPE=awareness
```

This means the automatic daily job generates one Awareness poster. Review posters should remain manual because they require a customer screenshot or supplied review message. Offers and anniversaries should also remain manual unless their facts come from a trusted structured source.

### Activate the Cron through GitHub Actions

1. Confirm the following GitHub Actions secrets exist:

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `POSTER_ADMIN_TOKEN`
   - `GEMINI_API_KEY`
   - `PUBLIC_BASE_URL`, for example `https://posters.srshti.co.in`
   - optional `BUSINESS_TIMEZONE=Asia/Kolkata`
   - optional D1 and R2 settings already described in `README.md`

2. Push the latest code to `main` or `master`, or run the deployment workflow manually from GitHub Actions.

3. The workflow will validate the project, apply D1 migrations, deploy the Worker, and upload Worker secrets.

4. Open Cloudflare Dashboard:

   ```text
   Workers & Pages → daily-poster-packet → Settings → Triggers → Cron Triggers
   ```

5. Confirm this trigger appears:

   ```text
   */5 * * * *
   ```

If the Worker is deployed through Wrangler, keep Cron configuration in `wrangler.jsonc` as the source of truth rather than manually maintaining a different dashboard schedule.

### Test locally

Start the Worker:

```bash
npm run dev
```

In another terminal, call the local scheduled endpoint shown by Wrangler, normally:

```bash
curl http://localhost:8787/cdn-cgi/handler/scheduled
```

The scheduled request runs in the background. Check the generated-poster status afterward:

```bash
curl \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" \
  http://localhost:8787/api/generated-poster/dr-poojas-smile-craft/awareness/today
```

Local generation needs valid `GEMINI_API_KEY`, D1, and R2 bindings.

### Test production without waiting for the Cron

Manually invoke the same orchestration path:

```bash
curl -X POST \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" \
  "https://posters.srshti.co.in/api/orchestrate/dr-poojas-smile-craft/awareness/today?force=true"
```

Then check status:

```bash
curl \
  -H "Authorization: Bearer $POSTER_ADMIN_TOKEN" \
  https://posters.srshti.co.in/api/generated-poster/dr-poojas-smile-craft/awareness/today
```

Use `force=true` only for intentional regeneration because it can create another Gemini image and additional API cost.

### Monitor scheduled runs

Useful checks:

```bash
npx wrangler tail
```

Also inspect:

- the admin Generated Poster Gallery;
- the protected generated-poster status API;
- Cloudflare Worker logs and errors;
- D1 rows in `generated_posters`;
- Gemini usage and estimated cost shown in the dashboard.

Create an alert when a scheduled result is `failed` or `needs_review`; do not silently treat it as delivered.

## Part 2: Recommended delivery channel — email

### Why email first

- No new app or account is required for the clinic owner.
- The poster can be attached with a useful filename.
- The email can also show an inline preview and dashboard link.
- Delivery history is searchable.
- Multiple clinic staff members can receive the same message.
- It is considerably simpler to launch than WhatsApp Business messaging.

### Suggested provider

Use Resend or another transactional email provider with a Worker-compatible HTTP API. Resend can send an attachment from a remote image URL or Base64 content. The existing R2/Worker image URL can therefore be attached without loading a large SDK.

### Required configuration

Create and verify a sending domain, preferably a subdomain such as:

```text
mail.srshti.co.in
```

Add these Worker bindings:

```dotenv
RESEND_API_KEY=
POSTER_FROM_EMAIL=Posters <posters@mail.srshti.co.in>
POSTER_RECIPIENT_EMAIL=owner@clinic-domain.example
```

Store `RESEND_API_KEY` as a Cloudflare Worker secret and GitHub Actions secret. The sender and recipient can be normal Worker variables unless you prefer to keep the recipient private.

### Email content

Recommended subject:

```text
Today’s Smile Craft poster is ready — 20 Jun 2026
```

Recommended body:

- poster type and date;
- inline poster preview;
- attached original PNG/JPEG;
- button linking to the generated image;
- button linking to the admin dashboard;
- content source, such as `Google Sheet` or `AI fallback`;
- short warning when status is `needs_review`;
- generated cost estimate for internal/admin recipients only.

Recommended attachment filename:

```text
smile-craft-awareness-2026-06-20.jpg
```

### Worker implementation outline

Call delivery only after `runPosterOrchestrator()` returns `status === "ready"`.

```ts
async function sendPosterEmail(env: Bindings, poster: GeneratedPoster) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `poster-${poster.businessSlug}-${poster.posterType}-${poster.date}`,
    },
    body: JSON.stringify({
      from: env.POSTER_FROM_EMAIL,
      to: [env.POSTER_RECIPIENT_EMAIL],
      subject: `Today’s poster is ready — ${poster.date}`,
      html: `
        <h1>Your poster is ready</h1>
        <p>${poster.posterType} · ${poster.date}</p>
        <img src="${poster.imageUrl}" style="max-width:360px;width:100%" alt="Generated poster">
        <p><a href="${poster.imageUrl}">Open full-size poster</a></p>
      `,
      attachments: [
        {
          path: poster.imageUrl,
          filename: `smile-craft-${poster.posterType}-${poster.date}.jpg`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Email delivery failed with HTTP ${response.status}`);
  }
}
```

The actual filename extension should follow `poster.imageContentType` rather than always using `.jpg`.

### Prevent duplicate emails

Do not rely only on the Cron running once. Retries and manual runs can happen.

Recommended robust design:

1. Add a `poster_deliveries` D1 table with:

   - business slug;
   - poster type;
   - poster date;
   - channel;
   - status (`pending`, `sent`, `failed`);
   - provider message ID;
   - attempt count;
   - last error;
   - sent timestamp.

2. Use a unique key across business, type, date, and channel.

3. Check the table before sending.

4. Send an idempotency header to the email provider.

5. Record the provider response after success.

6. Retry failed delivery separately without regenerating the poster.

Generation and delivery must be independent: an email failure should not mark a valid poster as generation-failed.

### Failure notifications

Send a small text-only admin email when:

- poster generation fails;
- Gemini returns no image;
- the poster becomes `needs_review`;
- the Google Sheet cannot be read;
- email attachment delivery fails.

Do not send a questionable poster to the clinic owner as if it were approved.

## Part 3: Optional instant delivery — Telegram

Telegram is the easiest mobile-image alternative to WhatsApp.

### Setup

1. Create a bot using `@BotFather` in Telegram.
2. Copy the bot token.
3. Ask the clinic owner to open the bot and press **Start**.
4. Use the Bot API `getUpdates` response to identify the owner's `chat_id`.
5. Add:

   ```dotenv
   TELEGRAM_BOT_TOKEN=
   TELEGRAM_CHAT_ID=
   ```

6. Store both as Worker secrets.

### Send the poster

Telegram `sendPhoto` accepts a publicly reachable HTTP image URL:

```ts
await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: env.TELEGRAM_CHAT_ID,
    photo: poster.imageUrl,
    caption: `Today’s ${poster.posterType} poster is ready.`,
  }),
});
```

Telegram currently accepts photo URLs and documents photo limits in its Bot API. If the generated image exceeds photo constraints or must retain original quality, use `sendDocument` instead of `sendPhoto`.

### Telegram trade-offs

Advantages:

- fast mobile notification;
- image appears directly in chat;
- simple API and no message-template approval;
- inexpensive to operate.

Disadvantages:

- the owner must use Telegram;
- bot and chat ID setup is unfamiliar to some users;
- email remains better for searchable archival and staff distribution.

## Part 4: Other alternatives

### Shared Google Drive folder

Useful when the clinic needs an organized archive, but it adds OAuth and Drive API complexity. Prefer storing in R2 and emailing a link unless the clinic already works from Drive every day.

### Slack or Microsoft Teams

Good for clinics already using an internal team workspace. Poor as the default for a small clinic owner who does not already use it.

### Push notifications or a PWA

Good later, after the admin dashboard becomes a frequently used installed app. It requires notification permission, subscription storage, and expiry handling. It is unnecessary for the first production release.

### SMS

Send only a link, not the image. It costs per message and produces a weaker image-review experience.

## Part 5: Privacy and operational safeguards

- Send patient-review screenshots only when the clinic has permission to reuse the review publicly.
- Avoid exposing private phone numbers, email addresses, appointment data, or non-public patient information.
- The current Worker-served R2 asset URLs are publicly reachable. If review screenshots can contain private data, introduce signed/private delivery URLs before using them.
- Limit delivery recipients to authorized clinic staff.
- Keep provider API keys in Worker secrets, never in `wrangler.jsonc` or Git.
- Log delivery status and provider IDs, but do not log API keys or full private review content.
- Keep a manual “Resend delivery” action separate from “Regenerate poster” to avoid unnecessary Gemini charges.

## Production rollout checklist

### Cron

- [ ] `wrangler.jsonc` contains `*/5 * * * *`.
- [ ] Latest code and migrations are deployed.
- [ ] Cloudflare dashboard shows the Cron Trigger.
- [ ] `PUBLIC_BASE_URL` is the production HTTPS domain.
- [ ] `DEFAULT_BUSINESS_SLUG` is correct.
- [ ] `DEFAULT_POSTER_TYPE=awareness` is correct.
- [ ] Manual production orchestration reaches `ready`.
- [ ] Scheduled logs show a successful run.

### Email

- [ ] Sending domain is verified.
- [ ] `RESEND_API_KEY` is stored as a Worker secret.
- [ ] Sender and recipient addresses are configured.
- [ ] Test email reaches inbox and does not land in spam.
- [ ] Full-resolution attachment opens correctly.
- [ ] Idempotency prevents duplicate delivery.
- [ ] Failed delivery is stored and retryable.
- [ ] Admin receives generation/delivery failure alerts.

### Optional Telegram

- [ ] Bot is created.
- [ ] Owner has pressed Start.
- [ ] Chat ID is confirmed.
- [ ] Test image arrives at full usable quality.
- [ ] Telegram failure does not affect email delivery.

## Recommended implementation order

1. Deploy and verify the five-minute heartbeat Cron.
2. Add email delivery with a verified sender domain.
3. Add `poster_deliveries` tracking and a manual resend button.
4. Add failure-alert emails.
5. Add Telegram only if the owner wants instant chat delivery.
6. Add WhatsApp later without changing the generation pipeline.

## Official references

- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Wrangler trigger configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend remote and Base64 attachments](https://resend.com/docs/dashboard/emails/attachments)
- [Resend with Cloudflare Workers](https://resend.com/cloudflare)
- [Telegram Bot API `sendPhoto`](https://core.telegram.org/bots/api#sendphoto)
