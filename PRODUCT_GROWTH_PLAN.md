# Daily Poster — Simple Sellable MVP

Updated: 2026-06-22

## 1. The product

Daily Poster should do one job:

> Create one branded poster for a small business every day and deliver it automatically.

The customer should not feel that they are operating an AI design tool. They should set up the business once and receive a poster every day.

Do not build a large social-media platform yet.

## 2. The promise

> Add your business details once. Get a ready-to-share branded poster every morning.

This is simple to understand, demonstrate, purchase, and use.

The product can serve clinics, restaurants, salons, gyms, real-estate agents, retailers, consultants, and other small businesses. The MVP does not need separate products for each industry.

During setup, the customer selects a business category. That category quietly controls the content generated for them.

## 3. The complete MVP

The MVP needs only:

1. A short setup flow
2. A simple dashboard
3. One scheduled daily generation job
4. Email delivery
5. Poster history

Everything else is secondary.

### Setup

Ask for:

- Business name
- Business category
- Country and timezone
- Phone number or contact detail
- Logo
- Brand color
- One or two example posters they like
- Gemini API key
- Delivery email
- Delivery time

Then generate one test poster.

If the customer approves it, activate the daily schedule.

### Daily automation

Every day, the scheduled job:

1. Checks the business category, country, and date.
2. Chooses one suitable topic.
3. Creates one branded poster.
4. Stores it.
5. Emails it to the customer.

The customer downloads and shares it.

That is the whole core product.

## 4. The dashboard

Use one page.

### Top section

- Business name
- “Daily posters are active” status
- Next poster time
- Pause/resume button

### Main section

Display today's poster prominently with three actions:

- Download
- Create another
- Edit today’s message

### Small upcoming section

Show:

- Tomorrow’s suggested topic
- Change topic

This is optional for the first release. It can be removed if it slows development.

### History section

Show the last 30 posters in a simple grid.

Each poster needs:

- Download
- Delete

### Settings

Put settings in one collapsed panel:

- Business details
- Logo and brand color
- Gemini key
- Delivery email and time
- Pause automation

Do not create multiple settings pages.

## 5. What to remove from the current customer experience

Hide or remove:

- Model selection
- Resolution selection
- Prompt editing
- Public context URLs
- Brand-board terminology
- Multiple reference libraries
- Token and technical usage metadata
- Google Sheets
- Advanced automation choices
- Multiple poster generations per day
- Resend and Cloudflare terminology
- Raw generation status and validation details
- Reference Remake from the primary navigation
- Separate workspaces for every poster type

These capabilities may remain internally available for administration, but customers should not see them in the MVP.

## 6. Poster logic

Do not ask the customer to choose a poster type every day.

The system should choose from a simple content mix:

- Business tip or educational content
- Product/service awareness
- Relevant festival or special day
- General promotional post

Default weekly mix:

- Monday: useful tip
- Tuesday: product or service
- Wednesday: educational post
- Thursday: useful tip
- Friday: promotion or call to action
- Saturday: trust-building or general post
- Sunday: local event, festival, or light engagement post

A relevant festival or important special day can replace the normal topic.

The business category changes the subject. A restaurant receives food-related content; a salon receives beauty content; a clinic receives health-awareness content.

For the MVP, do not automate customer reviews, custom offers, or factual business announcements unless the customer manually supplies the text.

## 7. Simplest onboarding flow

### Screen 1 — Business

- Business name
- Category
- Country
- Timezone detected automatically

Button: **Continue**

### Screen 2 — Brand

- Upload logo
- Choose one main color
- Upload up to two example posters, optional

Button: **Create my sample**

### Screen 3 — Sample

Show one generated poster.

Actions:

- I like it
- Try again
- Change color/logo

### Screen 4 — Activate

- Paste Gemini API key
- Delivery email
- Delivery time

Button: **Start my daily posters**

### Success

> Your daily posters are active. Your next poster will arrive tomorrow at 8:00 AM.

The full setup should take less than five minutes.

## 8. API-key experience

The Gemini key is the most difficult part for a non-technical customer.

Keep the explanation short:

> Daily Poster uses your Google Gemini key to create your posters. You pay Google directly for the small generation cost, so we do not charge a monthly AI fee.

Show:

1. Open Google AI Studio
2. Create an API key
3. Copy and paste it here

Include:

- A direct button to Google AI Studio
- A 30–60 second video
- A Test key button
- A clear success message

Do not show models or technical configuration.

For early customers, offer free assisted setup over a short call.

## 9. Pricing

Use one plan. Multiple plans will make this simple product harder to understand.

### Founding price

- India: ₹2,999 one time
- UAE: AED 299 one time
- United States: $79 one time
- Europe: €79 one time
- United Kingdom: £69 one time

### Standard price after initial validation

- India: ₹5,999 one time
- UAE: AED 599 one time
- United States: $149 one time
- Europe: €149 one time
- United Kingdom: £129 one time

Include:

- One business
- One poster per day
- Daily scheduling
- Email delivery
- Poster history
- Bring-your-own Gemini key
- One year of hosting and updates

After one year, charge an optional small hosting and maintenance renewal:

- India: ₹999/year
- UAE: AED 149/year
- United States: $39/year
- Europe: €39/year
- United Kingdom: £35/year

Do not use “lifetime hosting” or “lifetime support.”

## 10. Sales page

### Headline

> Get a branded poster for your business every morning.

### Supporting text

> Set up your business once. Daily Poster automatically creates and emails a fresh poster that is ready to share on Instagram, Facebook, or WhatsApp.

### Three benefits

- No daily designing
- Always uses your logo and brand color
- One-time purchase instead of another monthly content subscription

### Main CTA

> See a sample for my business

For early sales, create the sample manually or through the current admin system. Do not delay launch while building a fully automated free-sample funnel.

## 11. How to sell the first customers

1. Select small businesses with inconsistent social posting.
2. Create one sample using their public logo.
3. Ask permission to send the sample.
4. Explain that a new poster can arrive automatically every morning.
5. Offer the founding one-time price.
6. Set up the first customers personally.

Suggested message:

> Hi {{Name}}, I created a sample social poster for {{Business}}. We built a simple tool that can create and email a fresh branded poster to you every morning. You only set it up once, and there is no monthly AI subscription. May I send you the sample?

The personalized sample will sell the product better than a long feature list.

## 12. Build priorities

### Build now

1. Customer login
2. Business setup form
3. Secure Gemini-key storage
4. One-page dashboard
5. One poster per day Cron
6. Email delivery
7. Download and regenerate
8. Last 30 posters
9. Pause/resume
10. Mobile usability

### Keep internal

- Detailed prompt controls
- Model controls
- Cost and validation logs
- Reference management
- Manual troubleshooting tools

### Do not build now

- Direct social publishing
- Analytics
- Teams and roles
- Agency dashboard
- Video
- WhatsApp API delivery
- Content calendar builder
- Multi-location support
- Multiple daily schedules
- Complex industry packs
- Ecommerce integrations
- Large template marketplace

## 13. MVP success metrics

Track only:

- Setup completion
- Test poster approved
- Schedule activated
- Daily generation success
- Email delivery success
- Poster downloads
- Regenerations
- Customers still active after 30 days

The primary product metric is:

> How many customers download or use their daily poster?

Do not treat generated images alone as success.

## 14. Four-week execution plan

### Week 1

- Simplify the dashboard design.
- Define the minimal business and user data model.
- Add customer login and business isolation.
- Design the four-screen onboarding flow.

### Week 2

- Add encrypted Gemini-key storage and key testing.
- Connect setup data to generation.
- Reduce automation to one poster per business per day.
- Add pause/resume and delivery time.

### Week 3

- Build the one-page dashboard.
- Add email delivery.
- Add download, regenerate, and 30-poster history.
- Test the complete mobile flow.

### Week 4

- Onboard five businesses personally.
- Watch how they use the setup and dashboard.
- Fix the biggest points of confusion.
- Collect testimonials and examples.
- Begin founding-price outreach.

## 15. Final product definition

Daily Poster is not a design suite or a social-media management platform.

It is:

> A simple service that sends one ready-to-share branded business poster every day.

If a feature does not improve setup, daily poster quality, delivery reliability, or downloading, it should wait.
