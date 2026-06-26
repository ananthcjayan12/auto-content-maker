import {
  POSTER_TYPES,
  type BusinessBrandSystem,
  type PosterPromptSettings,
  type PosterType,
} from "./types";

export const DEFAULT_CONTENT_PROMPT_TEMPLATE = `You create only today's content for one {{posterType}} Instagram Story poster dated {{date}}.

Return one valid JSON object only, with exactly these keys:
{"angle":"","headline":"","subheadline":"","supportingText":"","cta":"","offerText":"","occasionLabel":"","reviewQuote":"","reviewAttribution":"","requiredText":[]}

Use only fields relevant to the selected poster type and return empty strings for unused fields. Keep all copy concise and mobile-readable. Never change or describe the brand, logo, fonts, colors, layout, or reference-image styling. Never invent offers, reviews, milestones, statistics, dates, credentials, or medical claims.

Business: {{businessName}}
Phone: {{phone}}
Date: {{date}}
Poster type: {{posterType}}
Brand context: {{brandContext}}
Poster reference notes: {{referenceNotes}}

POSTER-TYPE CONTENT RULES
{{posterTypePrompt}}`;

export const DEFAULT_MASTER_IMAGE_PROMPT_TEMPLATE = `Create one complete 9:16 Instagram Story poster for {{businessName}}.

BRAND IDENTITY — FIXED
- Use the attached original logo exactly as supplied.
- Never redraw, recreate, stylize, crop, distort, recolor, or replace the logo.
- Clinic name: {{businessName}}
- Phone: {{phone}}

COLOR SYSTEM — FIXED
{{colorSystem}}
- Do not introduce unrelated colors.

TYPOGRAPHY — FIXED
- Headlines: {{headingStyle}}
- Supporting text: {{bodyStyle}}
- Font character: {{fontMood}}
- Never use decorative script, handwritten, novelty, or random fonts unless explicitly required by the selected poster-type reference.
- Preserve clear hierarchy and accurate spelling.

LAYOUT — FIXED
- Mood: {{visualMood}}
- Layout: {{visualLayout}}
- Photography: {{photoStyle}}
- Keep all important text inside mobile-safe margins.
- Do not create a crowded flyer or generic stock design.

OUTPUT RULES
- Produce one finished poster only.
- Do not display mockups, devices, frames, or multiple alternatives.
- All required visible text must be spelled exactly.
- Do not add unrequested text, fabricated credentials, prices, offers, dates, statistics, or medical claims.`;

export const DEFAULT_REFERENCE_PROMPT_TEMPLATE = `REFERENCE IMAGE INSTRUCTIONS
- ORIGINAL LOGO: preserve exactly and use only as the brand identity.
- BRAND BOARD: use for the fixed colors, typography character, and overall brand identity.
- {{posterType}} DESIGN REFERENCES: primary references for layout, font weight, hierarchy, spacing, photo-mask treatment, accents, and visual rhythm.
- Extract the shared design system from all poster references. Do not copy their old wording or factual content.
- References control visual execution; TODAY'S CONTENT controls only today's message.

PRIORITY
Logo identity → original logo
Colors and brand feel → brand board
Layout and typography → poster-type references
Words and message → today's content`;

export const REFERENCE_REMAKE_IMAGE_OVERRIDE = `REFERENCE REMAKE MODE — OVERRIDES THE TYPOGRAPHY AND LAYOUT RULES ABOVE
- The uploaded reference poster is the source of truth for composition, typography style, font character, type scale, hierarchy, alignment, spacing, image placement, masks, borders, accents, and overall visual rhythm.
- Follow the reference poster's layout and typographic treatment closely. Do not fall back to the saved brand typography, saved brand layout, or the brand board's composition.
- Use the saved brand system only for the original logo, business identity, contact details, and brand color palette.
- The brand board may guide colors and identity only. Ignore its fonts, layout, spacing, image treatment, and composition.
- Replace the source poster's colors with the supplied brand palette while preserving the source poster's contrast relationships and hierarchy.
- Never copy or retain a competitor logo, business name, contact details, people, product images, claims, offer facts, or exact wording from the source poster.
- Use TODAY'S CONTENT for all visible message copy. The result should feel like this business's poster built with the uploaded poster's design language.`;

export const DEFAULT_POSTER_TYPE_PROMPTS: Record<PosterType, string> = {
  awareness: `POSTER TYPE: DENTAL AWARENESS
Purpose: communicate one useful, timely dental-health message. Use an educational but friendly tone. Prioritize one concise headline, one supporting line, and one practical action. Avoid fear-based imagery, graphic dental conditions, diagnosis, guaranteed outcomes, and unsupported medical claims. Determine a relevant Kerala/India angle for the supplied date; if there is no strong event, use a practical dental-awareness topic.`,
  offer: `POSTER TYPE: OFFER
Purpose: make one confirmed clinic offer immediately understandable. The offer is the strongest visual element, followed by its exact terms and CTA. Never invent a price, percentage, expiry date, eligibility condition, treatment, or benefit. Keep the design premium; do not use discount-store styling, aggressive sale graphics, or excessive badges. Use only offer facts supplied in the context.`,
  festival: `POSTER TYPE: FESTIVAL
Purpose: connect a verified festival or observance with a warm clinic greeting. Keep the clinic identity dominant and festival elements elegant and restrained. Do not replace the brand palette with unrelated festival colors or invent greetings in another language. Verify relevance to Kerala/India and the supplied date.`,
  anniversary: `POSTER TYPE: ANNIVERSARY OR MILESTONE
Purpose: celebrate a verified clinic anniversary or milestone. Make the verified milestone or number prominent. Use a confident, grateful, celebratory tone with restrained premium accents. Never invent an anniversary year, patient count, award, achievement, or date. Use only milestone facts supplied in the context.`,
  review: `POSTER TYPE: PATIENT REVIEW
Purpose: present authentic patient feedback as credible social proof.
When a review screenshot is supplied, the screenshot itself is the testimonial and must be placed prominently in the final poster. Preserve the supplied screenshot as one intact, readable rectangular image. Do not transcribe, retype, recreate, paraphrase, summarize, restyle, crop, mask, blur, or replace any review text, patient name, initials, avatar, rating, attribution, date, or platform UI visible inside it. Do not generate a separate quotation from the screenshot. You may add only minimal clinic-owned framing text outside the screenshot, such as “Patient feedback” or a CTA.
Create one short, warm, original social-proof headline outside the screenshot. Use ideas such as “A new review,” “Another happy smile,” “Kind words from our patient,” “Another reason to smile,” or “Your trust makes us smile” as creative direction, not mandatory wording. Keep it natural, premium, and mobile-readable. Vary the headline between posters. Do not imply a verified customer count, guaranteed happiness, treatment outcome, or medical result.
When only pasted review text is supplied and no screenshot exists, preserve its meaning and never invent a rating, patient identity, treatment result, or before-and-after claim.`,
  general: `POSTER TYPE: GENERAL CLINIC COMMUNICATION
Purpose: communicate one supplied clinic update, service message, reminder, or greeting. Use one clear message and one clear CTA. Never invent services, doctor availability, opening hours, credentials, facilities, or announcements. For a general daily post, determine one relevant Kerala/India angle for the supplied date.`,
  reference: `POSTER TYPE: REFERENCE REMAKE
Purpose: create a new clinic poster whose layout and typography are led by an uploaded source poster. Use the source poster only as visual direction. Never copy its competitor identity, logo, contact details, claims, offer facts, or exact wording. Create concise content suitable for the supplied date and any instructions in the reference notes. If the notes do not provide a specific message, choose a safe, useful general clinic communication without inventing prices, credentials, availability, outcomes, or medical claims.`,
};

export function defaultPromptSettings(
  businessSlug: string,
): PosterPromptSettings {
  return {
    businessSlug,
    contentPromptTemplate: DEFAULT_CONTENT_PROMPT_TEMPLATE,
    masterImagePromptTemplate: DEFAULT_MASTER_IMAGE_PROMPT_TEMPLATE,
    referencePromptTemplate: DEFAULT_REFERENCE_PROMPT_TEMPLATE,
    posterTypePrompts: { ...DEFAULT_POSTER_TYPE_PROMPTS },
  };
}

export function normalizePromptSettings(
  settings: PosterPromptSettings,
): PosterPromptSettings {
  const defaults = defaultPromptSettings(settings.businessSlug);
  return {
    ...settings,
    contentPromptTemplate:
      settings.contentPromptTemplate.trim() || defaults.contentPromptTemplate,
    masterImagePromptTemplate:
      settings.masterImagePromptTemplate.trim() ||
      defaults.masterImagePromptTemplate,
    referencePromptTemplate:
      settings.referencePromptTemplate.trim() ||
      defaults.referencePromptTemplate,
    posterTypePrompts: Object.fromEntries(
      POSTER_TYPES.map((type) => [
        type,
        settings.posterTypePrompts[type]?.trim() ||
          defaults.posterTypePrompts[type],
      ]),
    ) as Record<PosterType, string>,
  };
}

export function promptVariables(input: {
  brand: BusinessBrandSystem;
  posterType: PosterType;
  date: string;
  referenceNotes?: string | null;
  posterTypePrompt: string;
}): Record<string, string> {
  const { brand } = input;
  return {
    businessName: brand.businessName,
    phone: brand.phone,
    posterType: input.posterType,
    date: input.date,
    referenceNotes: input.referenceNotes || "none",
    posterTypePrompt: input.posterTypePrompt,
    brandContext: JSON.stringify({
      colors: brand.colors,
      typography: brand.typography,
      visualStyle: brand.visualStyle,
    }),
    colorSystem: `- Primary: ${brand.colors.primary}\n- Secondary: ${brand.colors.secondary}\n- Accent: ${brand.colors.accent}\n- Dark text: ${brand.colors.darkText}\n- Muted text: ${brand.colors.mutedText}`,
    headingStyle: brand.typography.headingStyle,
    bodyStyle: brand.typography.bodyStyle,
    fontMood: brand.typography.fontMood,
    visualMood: brand.visualStyle.mood,
    visualLayout: brand.visualStyle.layout,
    photoStyle: brand.visualStyle.photoStyle,
  };
}

export function fillPromptTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g,
    (match, key: string) => variables[key] ?? match,
  );
}
