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
- Do not create a crowded flyer or generic stock-template design.

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
Purpose: present one supplied patient testimonial as credible social proof. Treat the exact review as a quotation and do not rewrite its meaning. Show only the supplied patient name, initials, rating, and attribution. Never invent a review, rating, patient identity, treatment result, or before-and-after claim.`,
  general: `POSTER TYPE: GENERAL CLINIC COMMUNICATION
Purpose: communicate one supplied clinic update, service message, reminder, or greeting. Use one clear message and one clear CTA. Never invent services, doctor availability, opening hours, credentials, facilities, or announcements. For a general daily post, determine one relevant Kerala/India angle for the supplied date.`,
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
