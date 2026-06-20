# Resend Domain, Email Delivery, and Dashboard Automation Setup

This guide configures the production email domain, Resend, Cloudflare Worker secrets, deployment, dashboard schedule, poster types, force behavior, recipients, and end-to-end testing.

## 1. What is implemented

The application now includes:

- a Cloudflare Cron heartbeat every five minutes;
- D1-backed automation settings per business;
- a clinic-local schedule editable in the admin dashboard;
- multi-select poster types;
- a force-regeneration option;
- automatic Resend delivery for `ready` posters;
- inline email preview and full-resolution image attachment;
- recipient management in the dashboard;
- a test-email button for the selected ready poster;
- one daily automation claim per business, poster type, and date;
- separate generation and email-delivery status;
- automatic exclusion of Review from unattended scheduling.

The heartbeat does not generate every five minutes. It checks the saved settings and claims each selected poster type only once for the local calendar date.

## 2. Choose the sending domain

Use a dedicated sending subdomain rather than the root domain. Recommended:

```text
mail.srshti.co.in
```

Recommended sender:

```text
Posters <posters@mail.srshti.co.in>
```

A subdomain isolates transactional-email reputation from the main website and any normal staff inboxes. It also makes the purpose of the sender clear.

You only need Resend's **sending** capability. Do not enable inbound/receiving unless there is a separate product requirement for processing replies.

## 3. Add the domain in Resend

1. Sign in to [Resend](https://resend.com/).
2. Open **Domains**.
3. Select **Add Domain**.
4. Enter:

   ```text
   mail.srshti.co.in
   ```

5. Enable sending. Receiving is optional and unnecessary for poster delivery.
6. Choose a region. Tokyo is geographically close to India; use another region if your data-residency or account policy requires it.
7. Save the domain.

Resend will display the exact DNS records required for that domain. Use the values shown in your own Resend account; do not copy record values from screenshots or another project.

## 4. Configure DNS in Cloudflare

### Recommended: Domain Connect

If Resend shows **Sign in to Cloudflare**:

1. Select it.
2. Sign in to the Cloudflare account that owns `srshti.co.in`.
3. Review the requested DNS changes.
4. Authorize the records.
5. Return to Resend.
6. Select **Verify DNS Records**.

### Manual setup

If automatic setup is unavailable:

1. Open Cloudflare Dashboard.
2. Select `srshti.co.in`.
3. Open **DNS → Records**.
4. Copy every sending record from Resend exactly:

   - DKIM TXT record;
   - SPF TXT record;
   - sending/feedback MX record;
   - any additional record explicitly shown by Resend.

5. Keep TTL on **Auto** unless your DNS policy says otherwise.
6. Do not add quotation marks around TXT values unless Cloudflare adds them automatically.
7. Confirm Cloudflare has not appended the domain twice.
8. Return to Resend and select **Verify DNS Records**.

Resend requires SPF and DKIM for domain verification. It may also display an MX record for sending feedback/return-path handling. DMARC is recommended after SPF and DKIM are working.

### Verify from a terminal

Replace names with the exact hosts shown in Resend:

```bash
nslookup -type=TXT resend._domainkey.mail.srshti.co.in
nslookup -type=TXT send.mail.srshti.co.in
nslookup -type=MX send.mail.srshti.co.in
```

DNS commonly verifies within minutes but can take longer to propagate. Use Resend's **Restart verification** action after correcting records.

## 5. Create the Resend API key

1. In Resend, open **API Keys**.
2. Select **Create API Key**.
3. Name it:

   ```text
   daily-poster-production
   ```

4. Grant sending access only.
5. Scope it to `mail.srshti.co.in` if domain-scoped keys are available in the account.
6. Copy the key immediately. Resend only displays the token once.
7. Store it in a password manager until it is added to Cloudflare/GitHub.

Never put the API key in source code, D1, dashboard form fields, `wrangler.jsonc`, screenshots, or support messages.

## 6. Configure GitHub Actions

Open:

```text
GitHub repository → Settings → Secrets and variables → Actions → Secrets
```

Add:

```text
RESEND_API_KEY = re_...
POSTER_FROM_EMAIL = Posters <posters@mail.srshti.co.in>
```

The deployment workflow now:

- uploads `RESEND_API_KEY` as a Cloudflare Worker secret when present;
- injects `POSTER_FROM_EMAIL` as a Worker variable;
- deploys the five-minute Cron heartbeat;
- applies the automation D1 migration.

The `POSTER_FROM_EMAIL` domain must exactly match the domain/subdomain verified in Resend. Verifying `mail.srshti.co.in` and sending from `posters@srshti.co.in` can cause a domain-mismatch error.

## 7. Configure manually without GitHub Actions

Add the secret:

```bash
npx wrangler secret put RESEND_API_KEY
```

Enter the Resend API key when prompted.

Set the non-secret Worker variable in the Cloudflare dashboard:

```text
Workers & Pages
→ daily-poster-packet
→ Settings
→ Variables and Secrets
→ Add variable
```

Use:

```text
Name: POSTER_FROM_EMAIL
Value: Posters <posters@mail.srshti.co.in>
```

Apply remote migrations and deploy:

```bash
npm run db:migrate:remote
npm run deploy
```

## 8. Configure local development

Add to `.dev.vars`:

```dotenv
RESEND_API_KEY=re_...
POSTER_FROM_EMAIL=Posters <posters@mail.srshti.co.in>
```

Never commit `.dev.vars`.

For safe local testing, use a recipient email you control. The test-email action performs a real external send when a valid Resend key is configured.

## 9. Deploy the new application integration

The required migration is:

```text
migrations/0011_automation_and_delivery_settings.sql
```

It creates:

- `poster_automation_settings`;
- `poster_automation_runs`.

Deploy through GitHub Actions by pushing to `main`/`master`, or run the manual migration and deployment commands above.

After deployment, confirm Cloudflare shows:

```text
*/5 * * * *
```

under:

```text
Workers & Pages → daily-poster-packet → Settings → Triggers
```

Cloudflare evaluates Cron in UTC, but this expression is only a heartbeat. The actual local time comes from D1/dashboard settings and uses `BUSINESS_TIMEZONE`, currently `Asia/Kolkata`.

## 10. Configure automation in the admin dashboard

1. Sign in to the poster admin dashboard.
2. Open **Automation → Schedule and email delivery**.
3. Confirm the badge says **Resend configured**.
4. Enable **Daily automation**.
5. Choose the clinic-local time, for example:

   ```text
   08:30
   ```

6. Select poster types:

   - Awareness: safe default; supports Google Sheet-first content.
   - Festival: can be scheduled when date relevance is acceptable.
   - General: can be scheduled for general clinic communication.
   - Offer: schedule only when confirmed offer facts are supplied.
   - Anniversary: schedule only when verified milestone facts are supplied.
   - Review: intentionally disabled because it requires a screenshot or message.

7. Leave **Force regeneration** off for normal production.
8. Enable **Email ready posters automatically**.
9. Enter one or more recipients, separated by commas, spaces, semicolons, or lines.
10. Save settings.

### Force-regeneration behavior

When force is off:

- an existing `ready` poster for the selected date is reused;
- the scheduled email can send that ready image;
- unnecessary Gemini cost is avoided.

When force is on:

- the scheduled run creates a new image even if a ready poster already exists;
- D1 still claims that business/type/date only once;
- the five-minute heartbeat will not repeatedly regenerate it;
- additional Gemini cost is expected.

Use force for intentional daily replacement, not as a permanent default.

### Schedule behavior

The scheduler runs once per selected type per local calendar date, at or after the configured time. This means:

- a delayed Cloudflare invocation can still run the job;
- enabling automation after today's time can trigger it on the next heartbeat;
- saving a new time does not create duplicate runs for a date already claimed;
- the next local date receives a fresh claim.

## 11. Send a test email

1. Select a poster type in the workspace.
2. Select the desired date.
3. Generate a poster until its status is `ready`.
4. Save at least one recipient in Automation settings.
5. Select **Send current poster as test email**.
6. Confirm the dashboard shows:

   ```text
   Test poster email sent successfully.
   ```

7. In the inbox, verify:

   - sender name and domain;
   - subject and poster date;
   - inline image preview;
   - full-resolution attachment;
   - full-size image link;
   - spam/junk placement.

8. Open Resend Dashboard → Emails and confirm the message status.

The test action uses a unique idempotency key and does not consume the daily scheduled-run claim.

## 12. Scheduled delivery behavior

For each selected type:

1. The heartbeat checks whether the saved local time has arrived.
2. D1 claims the business/type/date.
3. The Worker generates or reuses the poster according to the force setting.
4. Only a `ready` poster is delivered.
5. Resend receives:

   - an HTML email with inline preview;
   - the public poster URL;
   - the same image as a remote attachment;
   - an idempotency key based on business/type/date.

6. D1 records delivery as:

   - `sent`;
   - `failed`;
   - `skipped`.

Generation and email delivery are separate. An email failure does not erase or mark a valid poster image as generation-failed.

## 13. Troubleshooting

### Dashboard says “Resend setup required”

One or both bindings are missing:

```text
RESEND_API_KEY
POSTER_FROM_EMAIL
```

Redeploy after adding them.

### Resend returns 401

- API key is missing, invalid, revoked, or copied incorrectly.
- Confirm the secret is present on the deployed Worker.
- Rotate the key if it may have been exposed.

### Resend returns 403/domain mismatch

- The From address does not use the exact verified domain/subdomain.
- Example: if `mail.srshti.co.in` is verified, use `posters@mail.srshti.co.in`.
- Confirm the API key is permitted to send from that domain.

### Domain remains pending

- Compare every Resend DNS record against Cloudflare.
- Check for truncated DKIM values.
- Check for doubled domain names.
- Confirm the sending MX record uses the correct region.
- Use Resend's verification diagnostics and restart verification.

### Email arrives without the attachment

- Open `poster.imageUrl` in a private browser window.
- The Resend remote-attachment fetch requires a publicly reachable HTTPS URL.
- Confirm `PUBLIC_BASE_URL` or `R2_PUBLIC_BASE_URL` points to production, not localhost.
- Confirm the object content type is an image.

### Email lands in spam

- Confirm SPF and DKIM are verified.
- Add a DMARC policy after monitoring.
- Use a recognizable sender name.
- Keep recipients limited to clinic staff who expect the messages.
- Avoid repeatedly sending forced test generations.

### Schedule does not run

- Confirm the Cloudflare trigger is `*/5 * * * *`.
- Confirm Daily automation is enabled.
- Confirm at least one poster type is selected.
- Confirm `BUSINESS_TIMEZONE=Asia/Kolkata`.
- Check whether today's business/type/date already exists in `poster_automation_runs`.
- Inspect Worker logs with `npx wrangler tail`.

### Poster generated but email was skipped

- Only `ready` posters are sent.
- `needs_review` and `failed` posters are intentionally not delivered.
- Confirm email delivery is enabled and recipients are saved.

## 14. Security and privacy

- Keep `RESEND_API_KEY` only in Worker/GitHub secrets.
- Never expose the API key in the dashboard.
- Restrict recipients to authorized clinic staff.
- Patient-review screenshots must be approved for public reuse before delivery.
- The current image URL must be publicly reachable for remote attachments; introduce signed URLs before sending private material.
- Rotate the Resend key immediately if it is leaked.
- Keep test recipients under your control until production verification is complete.

## 15. Production checklist

- [ ] `mail.srshti.co.in` is verified in Resend.
- [ ] SPF and DKIM show verified.
- [ ] Optional DMARC is configured.
- [ ] A sending-only, preferably domain-scoped API key exists.
- [ ] `RESEND_API_KEY` is stored in GitHub and Cloudflare secrets.
- [ ] `POSTER_FROM_EMAIL` exactly matches the verified domain.
- [ ] Migration `0011` is applied remotely.
- [ ] Worker is deployed.
- [ ] Cloudflare trigger shows `*/5 * * * *`.
- [ ] Dashboard badge shows **Resend configured**.
- [ ] Local schedule is correct.
- [ ] Poster types are intentional.
- [ ] Force is off unless specifically needed.
- [ ] Recipient addresses are correct.
- [ ] Test email arrives with inline preview and attachment.
- [ ] Scheduled run is claimed once.
- [ ] Scheduled delivery status is `sent`.
- [ ] Worker and Resend logs are reviewed after the first live run.

## Official documentation

- [Resend domain management](https://resend.com/docs/dashboard/domains/introduction)
- [Resend Cloudflare DNS setup](https://resend.com/docs/dashboard/domains/cloudflare)
- [Resend subdomain recommendation](https://resend.com/docs/knowledge-base/is-it-better-to-send-emails-from-a-subdomain-or-the-root-domain)
- [Resend domain verification troubleshooting](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend attachments](https://resend.com/docs/dashboard/emails/attachments)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
