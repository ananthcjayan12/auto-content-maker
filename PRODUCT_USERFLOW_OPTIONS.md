# Daily Poster Product — User Flow Options

Updated: 2026-06-24

## Product direction

The product should feel like a simple poster assistant for small businesses.

The core workflow:

1. User sets up their business brand once.
2. User creates or generates a monthly content calendar.
3. The system creates posters from that calendar.
4. The user can also create a poster inspired by an existing poster.
5. Cron automatically generates and delivers the daily poster.

The UI should not feel like an advanced AI design tool. It should feel like a clean monthly planner with one-click poster creation.

## Main product promise

> Plan your month once. Get a branded poster every day.

Alternative promise:

> Create a monthly content calendar and turn every idea into a ready-to-share poster.

## The simplest customer mental model

The customer should only understand three things:

- Calendar: what to post each day
- Poster: what got created
- Brand: how the poster should look

Everything technical should be hidden.

## Recommended information architecture

Use only four main areas:

1. Dashboard
2. Calendar
3. Create Poster
4. Settings

Avoid showing poster-type tabs, model settings, prompt settings, reference libraries, public context links, Cloudflare, Resend, or raw generation details to normal customers.

## Flow option A — Calendar-first product

This is the strongest option if the product is sold as a planning tool plus automation.

### Navigation

- Dashboard
- Calendar
- Inspiration Poster
- Settings

### User flow

1. User opens Dashboard.
2. Dashboard shows today’s scheduled post and generated poster.
3. User opens Calendar.
4. User sees the month in a simple calendar/grid.
5. Each date has one content idea.
6. Empty dates show “Generate idea” or “Add manually.”
7. User can click “Generate full month.”
8. AI fills the calendar with post ideas.
9. User edits any day if needed.
10. Cron picks today’s calendar item and creates the poster.

### Why this is good

- Easy to explain and sell.
- Customers feel in control.
- Supports manual and AI-generated content.
- Works for all small businesses.
- Makes daily automation more reliable because the content is already planned.

### Risk

- Slightly more UI work than pure daily automation.
- Calendar editing must be very simple or users may feel overwhelmed.

## Flow option B — Dashboard-first product

This is the simplest operational flow.

### Navigation

- Dashboard
- Monthly Plan
- Settings

### User flow

1. User opens Dashboard.
2. Top card says: “Today’s poster is ready” or “Today’s poster will be created at 8 AM.”
3. User sees today’s poster.
4. User sees the next 7 days of planned content below it.
5. User can click “Plan this month.”
6. Calendar opens as a secondary screen.
7. User can generate or edit the monthly content plan.
8. Cron generates from the plan every day.

### Why this is good

- Very simple for non-technical users.
- Dashboard remains the home.
- Calendar exists, but does not dominate the product.
- Easier to sell as “daily poster automation.”

### Risk

- Monthly planning may feel hidden unless onboarding highlights it well.

## Flow option C — Three-step wizard product

This is best for first-time users and sales demos.

### Navigation

- Setup
- Calendar
- Posters
- Settings

### User flow

1. User sets business details.
2. User chooses business category and country.
3. User uploads logo and brand color.
4. User clicks “Create my monthly calendar.”
5. AI generates 30 content ideas.
6. User approves the calendar.
7. System creates today’s poster.
8. Automation starts.

### Why this is good

- Great for onboarding.
- The user reaches value quickly.
- Good for selling because demo is easy.

### Risk

- After onboarding, the product still needs a clean day-to-day dashboard.

## Recommended choice

Use a mix of Option B and Option C:

- First-time experience: three-step wizard
- Daily experience: simple dashboard
- Planning experience: monthly calendar

This gives the product a simple sales story without making the app feel too small.

## Recommended first-time onboarding

### Step 1 — Business

Ask only:

- Business name
- Business category
- Country
- Timezone
- Contact number or website

Button:

> Continue

### Step 2 — Brand

Ask:

- Upload logo
- Choose main brand color
- Optional: upload 1–2 poster examples you like

Button:

> Continue

### Step 3 — Monthly calendar

Show:

> Let AI create a simple content plan for this month.

Inputs:

- Month
- Posting frequency: Daily / Weekdays only / Custom
- Content style: Educational / Promotional / Mixed

Button:

> Generate my calendar

AI fills dates with content ideas.

### Step 4 — Review calendar

Calendar row/card fields:

- Date
- Topic
- Message
- Poster style
- Status

Actions:

- Edit
- Regenerate
- Skip this day

Button:

> Approve calendar

### Step 5 — Activate automation

Ask:

- Gemini API key
- Delivery email
- Daily generation time

Button:

> Start daily posters

Success message:

> Your daily poster system is active. Tomorrow’s poster will be created at 8:00 AM.

## Monthly calendar UX

The calendar should have two views:

### Simple view

This is the default customer view.

Each day shows:

- Date
- Short topic
- Status chip

Status chips:

- Planned
- Poster ready
- Needs message
- Skipped

### Detail drawer

When the user clicks a date, open a side panel or modal.

Fields:

- Topic
- Custom message
- CTA
- Poster mode
- Inspiration image
- Notes

Actions:

- Save
- Generate poster now
- Regenerate idea
- Skip day

## Content calendar creation options

Give users three easy options.

### Option 1 — Generate with AI

User clicks:

> Generate full month

Inputs:

- Month
- Goal: awareness / promotion / engagement / mixed
- Any important offers or events

AI creates all calendar entries.

### Option 2 — Fill manually

User can type directly into dates.

This is useful for customers who already know their offers, events, launches, or campaigns.

### Option 3 — Import from sheet

User uploads CSV or connects Google Sheet.

This should be available, but not the primary flow in MVP.

The UI copy should avoid saying “Google Sheet integration” too early. Say:

> Import calendar

Supported columns:

- Date
- Topic
- Message
- CTA
- Poster Mode
- Notes

## Poster modes

Instead of exposing many poster types, use simple customer-friendly modes.

### Mode 1 — Normal poster

Uses business brand, category, and calendar message.

Good for:

- Awareness
- Tips
- Services
- Promotions
- Festival greetings
- General posts

### Mode 2 — Inspired by image

User uploads a poster they like.

The system uses only:

- Layout direction
- Typography feel
- Hierarchy
- Color mood
- Visual rhythm

The system must not copy:

- Logo
- Brand name
- Contact details
- Exact text
- Claims
- Offer details
- People/product imagery in a misleading way

### Mode 3 — Use my message exactly

User supplies the core message.

AI can polish lightly, but should not invent facts.

Good for:

- Confirmed offers
- Events
- Announcements
- Price-based promotions

## Inspiration poster flow

This should be very simple.

### Entry points

There should be two entry points:

1. From Calendar date detail: “Use inspiration image”
2. From Create Poster: “Create from inspiration”

### Flow

1. Upload inspiration poster.
2. Add message or choose “take idea from poster.”
3. Confirm what should not be copied.
4. Generate poster.
5. Save to selected calendar date or download.

### Two inspiration modes

The user should choose one:

#### A. Use my message

Best for business offers or specific announcements.

Input:

> What should this poster say?

Example:

> Summer skincare consultation offer. Book this week and get a free skin analysis.

#### B. Take idea from poster

Best when the user likes both the design and general communication angle.

Input:

> Any notes?

Example:

> Make this suitable for a dental clinic and keep it friendly.

## Daily cron logic

Every day, the cron should:

1. Find active businesses.
2. Check today’s calendar entry.
3. If today has an approved calendar item, create that poster.
4. If today has no calendar item, use AI fallback to create a safe generic post.
5. Store the poster.
6. Email it to the user.
7. Mark the calendar date as Poster ready.

Do not ask the user to choose poster type every day.

## Dashboard UX

The dashboard should answer four questions immediately:

1. Is automation active?
2. What is today’s poster?
3. What is planned next?
4. Is anything missing?

### Dashboard sections

1. Today’s poster
2. Next 7 days
3. Calendar health
4. Quick actions

### Quick actions

- Generate today’s poster
- Edit today’s message
- Plan next month
- Create from inspiration
- Pause automation

## Best MVP recommendation

Build this first:

1. Business setup
2. Brand setup
3. Monthly calendar page
4. AI generate full month
5. Manual calendar editing
6. Daily cron reads today’s calendar item
7. Poster generation from calendar item
8. Inspiration poster generation for one selected date
9. Email delivery
10. Poster history

Do not build yet:

- Social media posting
- Analytics
- Multiple workspaces
- Advanced prompt editor
- Multiple AI models
- Complex approval workflows
- Team members
- Agency dashboard
- Full Google Sheets sync both ways

## Open product decisions

### Decision 1 — Primary product positioning

Option A:

> Daily poster automation

Simple to sell, but calendar may feel secondary.

Option B:

> Monthly content calendar that creates posters automatically

More valuable, but slightly more complex to explain.

Option C:

> AI poster assistant for small businesses

Flexible, but less specific.

Recommended: Option B for product, Option A for ads.

### Decision 2 — Calendar data entry

Option A:

AI first, manual edit after.

Option B:

Manual first, AI helper beside it.

Option C:

Import sheet first, AI fills missing dates.

Recommended: Option A.

### Decision 3 — Inspiration poster placement

Option A:

Separate nav item called Inspiration Poster.

Option B:

Only inside each calendar date.

Option C:

Both separate nav and inside calendar.

Recommended: Option C for ease of discovery.

### Decision 4 — Poster modes naming

Option A:

- Normal
- Inspired
- Exact message

Option B:

- Auto design
- Copy style
- My message

Option C:

- Calendar poster
- Inspiration poster
- Custom poster

Recommended: Option C for clarity.

### Decision 5 — Monthly calendar format

Option A:

Calendar grid.

Option B:

Table/list.

Option C:

Toggle between calendar and list.

Recommended: Option B first, then add calendar grid later. Tables are easier to edit and understand for monthly planning.

### Decision 6 — Google Sheet support

Option A:

Keep Google Sheet as advanced import.

Option B:

Make Google Sheet the main content calendar.

Option C:

Do not show Google Sheet in MVP.

Recommended: Option A. The product should own the calendar UI, but sheet import is useful for power users.

## My recommended final user flow

1. User signs up.
2. User adds business details.
3. User adds logo and brand color.
4. User clicks “Generate this month’s calendar.”
5. AI creates the monthly plan.
6. User edits/approves the plan.
7. User adds Gemini API key and delivery email.
8. System creates today’s poster.
9. Every day, cron creates the poster from that day’s calendar item.
10. User can create special posters from inspiration images whenever needed.

This keeps the product simple, but much more useful than a random daily poster generator.
