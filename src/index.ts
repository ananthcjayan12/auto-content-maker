import { Hono, type Context } from "hono";
import { DEFAULT_TIMEZONE, resolveDate, todayInTimezone } from "./date";
import { renderDashboard, renderLoginPage } from "./admin-render";
import { renderCustomerApp } from "./customer-render";
import {
  renderOnboardingActivate,
  renderOnboardingBrand,
  renderOnboardingPlan,
  renderOnboardingSample,
  renderOnboardingStart,
} from "./onboarding-render";
import {
  clearAdminSession,
  getAdminBusinessSlug,
  setAdminSession,
} from "./admin-session";
import { imageContentTypeForKey, isUploadedFile, uploadImage } from "./assets";
import {
  AUTOMATABLE_POSTER_TYPES,
  defaultAutomationSettings,
  isValidLocalTime,
  runAutomationHeartbeat,
  sendPosterEmail,
} from "./automation";
import { applyDrPoojaSmileCraftPreset } from "./brand-presets";
import {
  defaultContentSourceSettings,
  googleSheetCsvUrl,
  resolveAwarenessContent,
} from "./content-sources";
import {
  DEFAULT_GENERATION_SETTINGS,
  isImageModel,
  isImageResolution,
  isTextModel,
  normalizeGenerationSettings,
} from "./gemini-models";
import { renderErrorPage, renderPosterPage } from "./render";
import {
  baseUrl,
  defaultScheduledTarget,
  generatePosterBrief,
  generatePosterImageFromPrompt,
  imageUrlToBase64,
  runPosterOrchestrator,
  buildImagePrompt,
} from "./orchestrator";
import type { ImageBase64Reference } from "./orchestrator";
import { D1PosterStore } from "./store";
import {
  defaultPromptSettings,
  normalizePromptSettings,
} from "./prompt-settings";
import type {
  Bindings,
  BusinessBrandSystem,
  CalendarEntryStatus,
  CalendarPosterMode,
  ContentCalendarEntry,
  GenerationSettings,
  PosterTemplatePattern,
  PosterStore,
  PosterType,
} from "./types";
import { POSTER_TYPES } from "./types";
import {
  isPosterType,
  isValidSlug,
  validateBrand,
  validatePacket,
} from "./validation";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Frame-Options", "DENY");
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
});

function storeFor(env: Bindings): PosterStore {
  return env.TEST_STORE ?? new D1PosterStore(env.DB);
}

function jsonError(
  c: Context<{ Bindings: Bindings }>,
  status: 400 | 401 | 403 | 404 | 500,
  error: string,
  details?: string[],
) {
  return c.json(
    { success: false, error, ...(details ? { details } : {}) },
    status,
  );
}

async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, error: "Content-Type must be application/json" };
  }
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, error: "Request body must contain valid JSON" };
  }
}

function tokensMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) {
    mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function formLines(form: FormData, name: string): string[] {
  return formString(form, name)
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function formStrings(form: FormData, name: string): string[] {
  return form
    .getAll(name)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseJsonText(
  value: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!value.trim()) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Brief JSON must be a JSON object." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Brief JSON must contain valid JSON." };
  }
}

function isCalendarPosterMode(value: string): value is CalendarPosterMode {
  return (
    value === "normal" || value === "exact_message" || value === "inspiration"
  );
}

function isCalendarEntryStatus(value: string): value is CalendarEntryStatus {
  return (
    value === "planned" ||
    value === "poster_ready" ||
    value === "needs_message" ||
    value === "skipped"
  );
}

function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

function normalizeMonth(value: string, fallbackDate: string): string {
  return /^\d{4}-\d{2}$/.test(value) ? value : monthFromDate(fallbackDate);
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function customerRedirect(
  c: Context<{ Bindings: Bindings }>,
  businessSlug: string,
  params: Record<string, string>,
) {
  const search = new URLSearchParams(params);
  return c.redirect(`/app/${businessSlug}?${search.toString()}`, 303);
}

function fallbackCalendarEntries(input: {
  businessSlug: string;
  month: string;
  frequency: string;
  style: string;
  notes: string;
}): ContentCalendarEntry[] {
  const [year, monthNumber] = input.month.split("-").map(Number);
  const daysInMonth = new Date(year!, monthNumber!, 0).getDate();
  const topics = [
    "Useful tip for customers",
    "Product or service awareness",
    "Common customer question",
    "Behind-the-scenes trust post",
    "Promotion or booking reminder",
    "Customer education post",
    "Local festival or light engagement post",
  ];
  const entries: ContentCalendarEntry[] = [];
  for (let index = 0; index < daysInMonth; index += 1) {
    const date = `${input.month}-${String(index + 1).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    if (input.frequency === "weekdays" && (weekday === 0 || weekday === 6)) {
      continue;
    }
    const topic = topics[index % topics.length]!;
    entries.push({
      businessSlug: input.businessSlug,
      date,
      topic,
      message: `${topic}. Keep it ${input.style === "mixed" ? "simple, useful, and brand-friendly" : input.style}.`,
      cta: "Contact us today",
      posterMode: "normal",
      posterType:
        topic.toLowerCase().includes("festival") ||
        topic.toLowerCase().includes("engagement")
          ? "festival"
          : input.style === "promotional"
            ? "offer"
            : "general",
      templateId: null,
      inspirationImageUrl: null,
      notes: input.notes || null,
      status: "planned",
    });
  }
  return entries;
}

function slugPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "template"
  );
}

function businessSlugFromName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42) || "new-business"
  );
}

function normalizeContactUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("@")) {
    return `https://instagram.com/${trimmed.slice(1).replace(/^\/+/, "")}`;
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

function categoryFromBrand(brand: BusinessBrandSystem): string {
  const rule = brand.defaultPosterRules.find((item) =>
    item.startsWith("Create content suitable for "),
  );
  return (
    rule?.replace(/^Create content suitable for /, "").replace(/\.$/, "") ?? ""
  );
}

function categoryRules(input: {
  existingRules: string[];
  category: string;
  country: string;
  timezone: string;
}): string[] {
  const preserved = input.existingRules.filter(
    (rule) =>
      !rule.startsWith("Create content suitable for ") &&
      !rule.startsWith("Assume country/timezone context: "),
  );
  return [
    ...preserved,
    `Create content suitable for ${input.category}.`,
    `Assume country/timezone context: ${input.country}, ${input.timezone}.`,
  ];
}

async function uniqueBusinessSlug(
  store: PosterStore,
  businessName: string,
): Promise<string> {
  const base = businessSlugFromName(businessName);
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    if (!(await store.getBrand(candidate))) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function starterBrand(input: {
  businessSlug: string;
  businessName: string;
  phone: string;
  websiteUrl: string | null;
  category: string;
  country: string;
  timezone: string;
  publicBaseUrl: string;
}): BusinessBrandSystem {
  return {
    businessSlug: input.businessSlug,
    businessName: input.businessName,
    phone: input.phone,
    websiteUrl: input.websiteUrl,
    logoUrl: "/onboarding-assets/placeholder-logo.svg",
    brandReferenceBoardUrl: "/onboarding-assets/placeholder-board.svg",
    colors: {
      primary: "#0284c7",
      secondary: "#f9fafb",
      accent: "#ffffff",
      darkText: "#111827",
      mutedText: "#4b5563",
    },
    typography: {
      headingStyle: "clean bold sans-serif with strong mobile readability",
      bodyStyle: "simple readable sans-serif",
      fontMood: "modern, trustworthy, clear, and friendly",
    },
    visualStyle: {
      mood: `clean, useful, and conversion-focused for a ${input.category.toLowerCase()} in ${input.country}`,
      layout:
        "mobile-first poster layouts with a strong headline, simple message, clear CTA, and visible business identity",
      photoStyle:
        "bright, natural, brand-safe imagery or clean graphic backgrounds when photography is not available",
      avoid: [
        "crowded flyer look",
        "tiny unreadable text",
        "fake urgency",
        "invented claims, prices, awards, or guarantees",
      ],
    },
    defaultPosterRules: [
      "Keep every poster readable on mobile.",
      "Use the business name, logo, phone, and brand color consistently.",
      "Do not invent factual offers, prices, dates, awards, or claims.",
      `Create content suitable for ${input.category}.`,
      `Assume country/timezone context: ${input.country}, ${input.timezone}.`,
    ],
  };
}

function onboardingRedirect(
  c: Context<{ Bindings: Bindings }>,
  businessSlug: string,
  step: "business" | "brand" | "sample" | "plan" | "activate",
  params: Record<string, string> = {},
) {
  const search = new URLSearchParams(params);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return c.redirect(`/onboarding/${businessSlug}/${step}${suffix}`, 303);
}

function fallbackTemplatePatterns(input: {
  businessSlug: string;
  notes: string;
  referenceImageUrl?: string | null;
}): PosterTemplatePattern[] {
  const base = [
    {
      name: "Clean Educational Tip",
      description:
        "A premium, readable layout for useful tips and awareness posts.",
      bestFor: "Tips, awareness, FAQs, simple educational content",
      posterType: "awareness" as const,
      layoutPrompt:
        "Use a calm editorial layout with a strong headline at the top, one supporting line, generous whitespace, and one clear CTA near the bottom.",
      stylePrompt:
        "Keep the style modern, premium, uncluttered, brand-led, and readable on mobile. Use soft accents and avoid busy flyer elements.",
    },
    {
      name: "Bold Promo Card",
      description:
        "A stronger commercial layout for confirmed offers and booking pushes.",
      bestFor: "Offers, seasonal campaigns, booking reminders",
      posterType: "offer" as const,
      layoutPrompt:
        "Use a large offer/message block, a clear service benefit, and a prominent CTA. Keep terms visually secondary but readable.",
      stylePrompt:
        "Make it energetic without looking cheap. Avoid excessive badges, fake urgency, and clutter.",
    },
    {
      name: "Festival Greeting",
      description:
        "A warm greeting layout that keeps the business identity visible.",
      bestFor: "Festivals, observances, local special days",
      posterType: "festival" as const,
      layoutPrompt:
        "Use a greeting-led composition with a tasteful decorative area, business logo, short message, and subtle contact details.",
      stylePrompt:
        "Keep festival elements elegant and restrained. Do not overpower the brand palette.",
    },
    {
      name: "Minimal Premium",
      description:
        "A sparse, high-end template for trust-building and brand posts.",
      bestFor: "Brand reminders, trust posts, premium service messages",
      posterType: "general" as const,
      layoutPrompt:
        "Use a minimal poster with one central message, strong alignment, plenty of whitespace, and restrained supporting text.",
      stylePrompt:
        "Use premium spacing, simple shapes, and confident typography. Avoid stocky flyer styling.",
    },
  ];
  return base.map((pattern, index) => ({
    businessSlug: input.businessSlug,
    templateId: `${slugPart(pattern.name)}-${Date.now()}-${index + 1}`,
    ...pattern,
    previewImageUrl: null,
    referenceImageUrls: input.referenceImageUrl
      ? [input.referenceImageUrl]
      : [],
    isActive: true,
  }));
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function cleanHex(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(text) ? text : fallback;
}

async function suggestColorsFromLogo(input: {
  env: Bindings;
  brand: BusinessBrandSystem;
  logoImage: ImageBase64Reference | null;
}): Promise<BusinessBrandSystem["colors"]> {
  const fallback = {
    primary: input.brand.colors.primary,
    secondary:
      input.brand.colors.secondary === "#f9fafb"
        ? "#e0f2fe"
        : input.brand.colors.secondary,
    accent: input.brand.colors.accent,
    darkText: input.brand.colors.darkText,
    mutedText: input.brand.colors.mutedText,
  };
  const apiKey = input.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !input.logoImage) return fallback;
  const model =
    input.env.GEMINI_TEXT_MODEL && isTextModel(input.env.GEMINI_TEXT_MODEL)
      ? input.env.GEMINI_TEXT_MODEL
      : "gemini-2.5-flash";
  const prompt = `Suggest a clean social-poster brand palette from this logo.

Business: ${input.brand.businessName}
Current palette: ${JSON.stringify(input.brand.colors)}

Return only JSON:
{"primary":"#000000","secondary":"#000000","accent":"#000000","darkText":"#000000","mutedText":"#000000"}

Rules:
- primary should be the strongest recognizable brand color.
- secondary should be a soft supporting background color.
- accent should work for CTA/buttons/highlights.
- darkText must be readable on light backgrounds.
- mutedText must be readable for secondary copy.
- Use only six-digit hex colors.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: input.logoImage.contentType,
                  data: input.logoImage.base64,
                },
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) return fallback;
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";
  const parsed = parseJsonObject(text);
  if (!parsed) return fallback;
  return {
    primary: cleanHex(parsed.primary, fallback.primary),
    secondary: cleanHex(parsed.secondary, fallback.secondary),
    accent: cleanHex(parsed.accent, fallback.accent),
    darkText: cleanHex(parsed.darkText, fallback.darkText),
    mutedText: cleanHex(parsed.mutedText, fallback.mutedText),
  };
}

function fallbackSampleContent(input: {
  brand: BusinessBrandSystem;
  style: string;
  notes: string;
}): Pick<ContentCalendarEntry, "topic" | "message" | "cta" | "posterType"> {
  const category = categoryFromBrand(input.brand).toLowerCase();
  const note = input.notes ? ` Focus: ${input.notes}.` : "";
  if (category.includes("software")) {
    return {
      topic: "Show how your software service saves time",
      message: `Turn one repetitive business task into a smoother workflow with the right software partner.${note}`,
      cta: "Book a discovery call",
      posterType: input.style === "promotional" ? "offer" : "general",
    };
  }
  if (category.includes("design")) {
    return {
      topic: "Design that makes the brand easier to trust",
      message: `Good design helps customers understand your offer faster and remember your brand longer.${note}`,
      cta: "Start a design project",
      posterType: input.style === "promotional" ? "offer" : "general",
    };
  }
  return {
    topic: "Helpful tip for customers",
    message: `A simple, useful post that introduces ${input.brand.businessName} and gives customers one clear reason to get in touch today.${note}`,
    cta: "Contact us today",
    posterType: input.style === "promotional" ? "offer" : "general",
  };
}

async function generateSampleContent(input: {
  env: Bindings;
  brand: BusinessBrandSystem;
  style: string;
  notes: string;
}): Promise<
  Pick<ContentCalendarEntry, "topic" | "message" | "cta" | "posterType">
> {
  const fallback = fallbackSampleContent(input);
  const apiKey = input.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return fallback;
  const model =
    input.env.GEMINI_TEXT_MODEL && isTextModel(input.env.GEMINI_TEXT_MODEL)
      ? input.env.GEMINI_TEXT_MODEL
      : "gemini-2.5-flash";
  const prompt = `Create one sample social poster content idea for this business.

Business: ${input.brand.businessName}
Category: ${categoryFromBrand(input.brand) || "Small business"}
Website/contact: ${input.brand.websiteUrl ?? ""} ${input.brand.phone}
Style: ${input.style}
Focus note: ${input.notes || "None"}

Return only JSON:
{"topic":"","message":"","cta":"","posterType":"general|awareness|offer|festival|anniversary"}

Rules:
- Make it specific to the business category.
- Keep message short enough for a poster.
- Do not invent prices, discounts, awards, dates, customer counts, legal claims, medical claims, or guaranteed outcomes.
- Use offer only if the focus note clearly asks for a promotion.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) return fallback;
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";
  const parsed = parseJsonObject(text);
  if (!parsed) return fallback;
  const posterType = String(parsed.posterType ?? fallback.posterType);
  return {
    topic: String(parsed.topic ?? fallback.topic).slice(0, 140),
    message: String(parsed.message ?? fallback.message).slice(0, 500),
    cta: String(parsed.cta ?? fallback.cta).slice(0, 120),
    posterType:
      isPosterType(posterType) && posterType !== "review"
        ? posterType
        : fallback.posterType,
  };
}

async function generateTemplatePatterns(input: {
  env: Bindings;
  brand: BusinessBrandSystem;
  notes: string;
  referenceImageUrl?: string | null;
  referenceImage?: ImageBase64Reference | null;
}): Promise<PosterTemplatePattern[]> {
  const apiKey = input.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return fallbackTemplatePatterns({
      businessSlug: input.brand.businessSlug,
      notes: input.notes,
      referenceImageUrl: input.referenceImageUrl,
    });
  }
  const model =
    input.env.GEMINI_TEXT_MODEL && isTextModel(input.env.GEMINI_TEXT_MODEL)
      ? input.env.GEMINI_TEXT_MODEL
      : DEFAULT_GENERATION_SETTINGS.textModel;
  const referenceInstruction = input.referenceImage
    ? `A reference poster image is attached. Use it only for broad layout structure, visual hierarchy, spacing rhythm, font feel, image/text placement, and composition patterns. Do not copy its brand name, logo, contact details, exact wording, claims, offers, illustrations, people, products, icons, or distinctive protected artwork.`
    : `No reference poster image is attached. Create original reusable patterns that fit the business brand.`;
  const prompt = `Create 5 reusable poster template pattern cards for a small business.

Business: ${input.brand.businessName}
Brand colors: primary ${input.brand.colors.primary}, secondary ${input.brand.colors.secondary}, accent ${input.brand.colors.accent}, dark text ${input.brand.colors.darkText}, muted text ${input.brand.colors.mutedText}
Brand typography mood: ${input.brand.typography.headingStyle}; ${input.brand.typography.fontMood}
Brand visual mood: ${input.brand.visualStyle.mood}
User notes: ${input.notes || "Create a balanced set for education, promotion, festival, and premium brand posts."}
Reference guidance: ${referenceInstruction}

Return only JSON:
{"templates":[{"name":"","description":"","bestFor":"","posterType":"general|awareness|offer|festival|anniversary","layoutPrompt":"","stylePrompt":""}]}

Rules:
- These are reusable visual/layout patterns, not daily content ideas.
- Keep the final template brand-led: clinic logo, brand colors, and contact style must remain from this business.
- If a reference image is attached, adapt only layout, hierarchy, spacing, and typography feel.
- Do not create prompts that copy competitors or require exact copyrighted layouts, exact text, logos, people, claims, or contact details from the reference image.
- Keep language understandable for a non-designer.
- layoutPrompt should describe composition, hierarchy, spacing, and content placement.
- stylePrompt should describe mood, typography feel, visual treatment, and what to avoid.`;
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: prompt }];
  if (input.referenceImage) {
    parts.push({
      inlineData: {
        mimeType: input.referenceImage.contentType,
        data: input.referenceImage.base64,
      },
    });
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) {
    return fallbackTemplatePatterns({
      businessSlug: input.brand.businessSlug,
      notes: input.notes,
      referenceImageUrl: input.referenceImageUrl,
    });
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";
  try {
    const parsed = JSON.parse(text) as {
      templates?: Array<Record<string, unknown>>;
    };
    const templates = (parsed.templates ?? [])
      .slice(0, 6)
      .map((template, index) => {
        const name =
          String(template.name ?? "").slice(0, 80) || `Template ${index + 1}`;
        const posterType = String(template.posterType ?? "general");
        return {
          businessSlug: input.brand.businessSlug,
          templateId: `${slugPart(name)}-${Date.now()}-${index + 1}`,
          name,
          description:
            String(template.description ?? "").slice(0, 220) ||
            "Reusable poster layout pattern.",
          bestFor:
            String(template.bestFor ?? "").slice(0, 180) ||
            "General business posters",
          posterType:
            isPosterType(posterType) &&
            posterType !== "review" &&
            posterType !== "reference"
              ? posterType
              : "general",
          layoutPrompt:
            String(template.layoutPrompt ?? "").slice(0, 1200) ||
            "Use a clean layout with clear hierarchy and mobile-readable text.",
          stylePrompt:
            String(template.stylePrompt ?? "").slice(0, 1200) ||
            "Keep the design premium, brand-led, and uncluttered.",
          previewImageUrl: null,
          referenceImageUrls: input.referenceImageUrl
            ? [input.referenceImageUrl]
            : [],
          isActive: true,
        } satisfies PosterTemplatePattern;
      });
    return templates.length
      ? templates
      : fallbackTemplatePatterns({
          businessSlug: input.brand.businessSlug,
          notes: input.notes,
          referenceImageUrl: input.referenceImageUrl,
        });
  } catch {
    return fallbackTemplatePatterns({
      businessSlug: input.brand.businessSlug,
      notes: input.notes,
      referenceImageUrl: input.referenceImageUrl,
    });
  }
}

async function generateCalendarEntries(input: {
  env: Bindings;
  brandName: string;
  businessSlug: string;
  month: string;
  frequency: string;
  style: string;
  notes: string;
}): Promise<ContentCalendarEntry[]> {
  const apiKey = input.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return fallbackCalendarEntries(input);
  const prompt = `Create a simple monthly social media content calendar for a small business.

Business: ${input.brandName}
Month: ${input.month}
Posting frequency: ${input.frequency}
Content style: ${input.style}
Important notes: ${input.notes || "None"}

Return only JSON in this exact shape:
{"entries":[{"date":"YYYY-MM-DD","topic":"","message":"","cta":"","posterType":"general|awareness|offer|festival|anniversary","notes":""}]}

Rules:
- Keep each message short enough for a poster.
- Do not invent prices, discounts, medical/legal/financial claims, awards, or exact event details.
- Use offer only when the notes explicitly mention an offer; otherwise use general, awareness, festival, or anniversary.
- For weekdays frequency, include only Monday to Friday.`;
  const model =
    input.env.GEMINI_TEXT_MODEL && isTextModel(input.env.GEMINI_TEXT_MODEL)
      ? input.env.GEMINI_TEXT_MODEL
      : DEFAULT_GENERATION_SETTINGS.textModel;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) return fallbackCalendarEntries(input);
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";
  try {
    const parsed = JSON.parse(text) as {
      entries?: Array<Record<string, unknown>>;
    };
    const entries: ContentCalendarEntry[] = [];
    for (const entry of parsed.entries ?? []) {
      const date = String(entry.date ?? "");
      const posterType = String(entry.posterType ?? "general");
      if (
        !resolveDate(date, DEFAULT_TIMEZONE) ||
        !date.startsWith(input.month)
      ) {
        continue;
      }
      entries.push({
        businessSlug: input.businessSlug,
        date,
        topic: String(entry.topic ?? "").slice(0, 140) || "Business update",
        message: String(entry.message ?? "").slice(0, 500) || null,
        cta: String(entry.cta ?? "").slice(0, 120) || null,
        posterMode: "normal",
        posterType:
          isPosterType(posterType) && posterType !== "review"
            ? posterType
            : "general",
        templateId: null,
        inspirationImageUrl: null,
        notes: String(entry.notes ?? "").slice(0, 500) || null,
        status: "planned",
      });
    }
    return entries.length ? entries : fallbackCalendarEntries(input);
  } catch {
    return fallbackCalendarEntries(input);
  }
}

function defaultGenerationSettings(
  businessSlug: string,
  env: Bindings,
): GenerationSettings {
  const textModel =
    env.GEMINI_TEXT_MODEL && isTextModel(env.GEMINI_TEXT_MODEL)
      ? env.GEMINI_TEXT_MODEL
      : DEFAULT_GENERATION_SETTINGS.textModel;
  const imageModel =
    env.GEMINI_IMAGE_MODEL && isImageModel(env.GEMINI_IMAGE_MODEL)
      ? env.GEMINI_IMAGE_MODEL
      : DEFAULT_GENERATION_SETTINGS.imageModel;
  const imageResolution =
    env.GEMINI_IMAGE_RESOLUTION &&
    isImageResolution(env.GEMINI_IMAGE_RESOLUTION)
      ? env.GEMINI_IMAGE_RESOLUTION
      : DEFAULT_GENERATION_SETTINGS.imageResolution;
  return normalizeGenerationSettings({
    businessSlug,
    textModel,
    imageModel,
    imageResolution,
    aspectRatio: "9:16",
  });
}

async function hasAdminAccess(
  c: Context<{ Bindings: Bindings }>,
  businessSlug: string,
): Promise<boolean> {
  return (await getAdminBusinessSlug(c)) === businessSlug;
}

function adminRedirect(
  c: Context<{ Bindings: Bindings }>,
  businessSlug: string,
  params: Record<string, string>,
) {
  const search = new URLSearchParams(params);
  return c.redirect(`/admin/${businessSlug}?${search.toString()}`, 303);
}

app.use("/api/*", async (c, next) => {
  const expected = c.env.POSTER_ADMIN_TOKEN;
  const authorization = c.req.header("Authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!expected || !supplied || !tokensMatch(supplied, expected)) {
    return c.json(
      {
        success: false,
        error: "Unauthorized. Supply a valid Authorization: Bearer token.",
      },
      401,
    );
  }
  await next();
});

app.get("/", async (c) => {
  const store = storeFor(c.env);
  const currentBusiness = await getAdminBusinessSlug(c);
  if (currentBusiness && (await store.getBrand(currentBusiness))) {
    return c.redirect(`/app/${currentBusiness}`);
  }
  return c.html(
    renderLoginPage(
      await store.listBrands(),
      c.req.query("error") || undefined,
    ),
  );
});

app.post("/admin/login", async (c) => {
  const form = await c.req.formData();
  const businessSlug = formString(form, "businessSlug");
  const token = formString(form, "token");
  const expected = c.env.POSTER_ADMIN_TOKEN;
  const store = storeFor(c.env);
  if (
    !isValidSlug(businessSlug) ||
    !(await store.getBrand(businessSlug)) ||
    !expected ||
    !tokensMatch(token, expected)
  ) {
    return c.html(
      renderLoginPage(
        await store.listBrands(),
        "Invalid business or admin token.",
      ),
      401,
    );
  }
  await setAdminSession(c, businessSlug);
  return c.redirect(`/app/${businessSlug}`, 303);
});

app.post("/admin/logout", async (c) => {
  clearAdminSession(c);
  return c.redirect("/", 303);
});

app.get("/onboarding-assets/placeholder-logo.svg", (c) =>
  c.body(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="120" fill="#e0f2fe"/><circle cx="256" cy="210" r="74" fill="#0284c7"/><path d="M130 392c22-70 72-106 126-106s104 36 126 106" fill="#0284c7"/></svg>`,
    200,
    { "Content-Type": "image/svg+xml; charset=utf-8" },
  ),
);

app.get("/onboarding-assets/placeholder-board.svg", (c) =>
  c.body(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520"><rect width="900" height="520" rx="36" fill="#f9fafb"/><rect x="64" y="64" width="330" height="390" rx="24" fill="#ffffff" stroke="#e5e7eb"/><rect x="448" y="64" width="388" height="104" rx="20" fill="#e0f2fe"/><rect x="448" y="208" width="184" height="246" rx="20" fill="#111827"/><rect x="652" y="208" width="184" height="246" rx="20" fill="#0284c7"/><circle cx="229" cy="190" r="58" fill="#0284c7"/><rect x="124" y="300" width="210" height="22" rx="11" fill="#111827"/><rect x="124" y="342" width="150" height="18" rx="9" fill="#4b5563"/></svg>`,
    200,
    { "Content-Type": "image/svg+xml; charset=utf-8" },
  ),
);

app.get("/onboarding/new", async (c) => {
  return c.html(
    renderOnboardingStart({
      timezone: c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
});

app.post("/onboarding/business", async (c) => {
  const form = await c.req.formData();
  const token = formString(form, "token");
  const expected = c.env.POSTER_ADMIN_TOKEN;
  if (!expected || !tokensMatch(token, expected)) {
    return c.redirect(
      "/onboarding/new?error=Enter+a+valid+admin+token+to+create+a+customer",
      303,
    );
  }
  const businessName = formString(form, "businessName");
  const category = formString(form, "category");
  const phone = formString(form, "phone");
  const country = formString(form, "country") || "India";
  const timezone = formString(form, "timezone") || DEFAULT_TIMEZONE;
  if (!businessName || !category || !phone) {
    return c.redirect(
      "/onboarding/new?error=Business+name,+category,+and+phone+are+required",
      303,
    );
  }
  const rawWebsiteUrl = formString(form, "websiteUrl");
  const websiteUrl = normalizeContactUrl(rawWebsiteUrl);
  if (rawWebsiteUrl && !websiteUrl) {
    return c.redirect(
      "/onboarding/new?error=Enter+a+valid+website+URL+or+Instagram+handle",
      303,
    );
  }
  const store = storeFor(c.env);
  const businessSlug = await uniqueBusinessSlug(store, businessName);
  const brand = starterBrand({
    businessSlug,
    businessName,
    phone,
    websiteUrl,
    category,
    country,
    timezone,
    publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
  });
  const validated = validateBrand(brand, businessSlug);
  if (!validated.value) {
    return c.redirect(
      `/onboarding/new?error=${encodeURIComponent(validated.errors.join(" "))}`,
      303,
    );
  }
  await store.upsertBrand(validated.value);
  await store.upsertGenerationSettings(
    defaultGenerationSettings(businessSlug, c.env),
  );
  await store.upsertContentSourceSettings(
    defaultContentSourceSettings(businessSlug),
  );
  await store.upsertPromptSettings(defaultPromptSettings(businessSlug));
  await store.upsertAutomationSettings({
    ...defaultAutomationSettings(businessSlug),
    enabled: false,
    posterTypes: ["general"],
  });
  await setAdminSession(c, businessSlug);
  return onboardingRedirect(c, businessSlug, "brand", {
    message: "Customer workspace created. Add brand details next.",
  });
});

app.get("/onboarding/:businessSlug/business", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.redirect("/?error=Please+sign+in+to+continue+onboarding", 303);
  }
  const brand = await storeFor(c.env).getBrand(businessSlug);
  if (!brand)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  return c.html(
    renderOnboardingStart({
      brand,
      category: categoryFromBrand(brand),
      timezone: c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
});

app.post("/onboarding/:businessSlug/business", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const existing = await store.getBrand(businessSlug);
  if (!existing)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  const form = await c.req.formData();
  const businessName = formString(form, "businessName");
  const category = formString(form, "category");
  const phone = formString(form, "phone");
  const country = formString(form, "country") || "India";
  const timezone = formString(form, "timezone") || DEFAULT_TIMEZONE;
  const rawWebsiteUrl = formString(form, "websiteUrl");
  const websiteUrl = normalizeContactUrl(rawWebsiteUrl);
  if (!businessName || !category || !phone) {
    return onboardingRedirect(c, businessSlug, "business", {
      error: "Business name, category, and phone are required.",
    });
  }
  if (rawWebsiteUrl && !websiteUrl) {
    return onboardingRedirect(c, businessSlug, "business", {
      error: "Enter a valid website URL or Instagram handle.",
    });
  }
  const validated = validateBrand(
    {
      ...existing,
      businessName,
      phone,
      websiteUrl,
      visualStyle: {
        ...existing.visualStyle,
        mood: `clean, useful, and conversion-focused for a ${category.toLowerCase()} in ${country}`,
      },
      defaultPosterRules: categoryRules({
        existingRules: existing.defaultPosterRules,
        category,
        country,
        timezone,
      }),
    },
    businessSlug,
    existing,
  );
  if (!validated.value) {
    return onboardingRedirect(c, businessSlug, "business", {
      error: validated.errors.join(" "),
    });
  }
  await store.upsertBrand(validated.value);
  return onboardingRedirect(c, businessSlug, "brand", {
    message: "Business details updated.",
  });
});

app.get("/onboarding/:businessSlug/brand", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.redirect("/?error=Please+sign+in+to+continue+onboarding", 303);
  }
  const brand = await storeFor(c.env).getBrand(businessSlug);
  if (!brand)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  return c.html(
    renderOnboardingBrand({
      brand,
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
});

app.post("/onboarding/:businessSlug/brand", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const existing = await store.getBrand(businessSlug);
  if (!existing)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  try {
    const form = await c.req.formData();
    const logoFile = form.get("logoFile");
    const boardFile = form.get("boardFile");
    const primary = formString(form, "primary") || existing.colors.primary;
    const secondary =
      formString(form, "secondary") || existing.colors.secondary;
    const accent = formString(form, "accent") || existing.colors.accent;
    const darkText = formString(form, "darkText") || existing.colors.darkText;
    const mutedText =
      formString(form, "mutedText") || existing.colors.mutedText;
    const style = formString(form, "style") || "premium";
    const notes = formString(form, "notes");
    const brandInput = {
      ...existing,
      logoUrl: existing.logoUrl,
      brandReferenceBoardUrl: existing.brandReferenceBoardUrl,
      colors: {
        primary,
        secondary,
        accent,
        darkText,
        mutedText,
      },
      typography: {
        headingStyle:
          style === "bold"
            ? "bold high-contrast sans-serif built for short promotional posters"
            : style === "minimal"
              ? "minimal premium sans-serif with confident spacing"
              : "clean bold sans-serif with strong mobile readability",
        bodyStyle: "simple readable sans-serif",
        fontMood: `${style}, modern, clear, and brand-safe`,
      },
      visualStyle: {
        ...existing.visualStyle,
        mood: `${style}, trustworthy, conversion-focused, and easy to scan`,
        layout:
          "simple mobile poster layouts with one strong headline, concise supporting text, clear CTA, and visible business identity",
        avoid: [
          ...new Set([
            ...existing.visualStyle.avoid,
            ...formLines(form, "notes"),
            ...(notes ? [notes] : []),
          ]),
        ],
      },
    };
    const publicBase = baseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
    if (isUploadedFile(logoFile)) {
      brandInput.logoUrl = await uploadImage({
        env: c.env,
        file: logoFile,
        keyPrefix: `businesses/${businessSlug}/brand/logo-${Date.now()}`,
        publicBaseUrl: publicBase,
      });
    }
    if (isUploadedFile(boardFile)) {
      brandInput.brandReferenceBoardUrl = await uploadImage({
        env: c.env,
        file: boardFile,
        keyPrefix: `businesses/${businessSlug}/brand/reference-board-${Date.now()}`,
        publicBaseUrl: publicBase,
      });
    }
    const validated = validateBrand(brandInput, businessSlug, existing);
    if (!validated.value) {
      return onboardingRedirect(c, businessSlug, "brand", {
        error: validated.errors.join(" "),
      });
    }
    await store.upsertBrand(validated.value);
    const patterns = fallbackTemplatePatterns({
      businessSlug,
      notes,
      referenceImageUrl: validated.value.brandReferenceBoardUrl.startsWith(
        "/onboarding-assets/",
      )
        ? null
        : validated.value.brandReferenceBoardUrl,
    });
    await Promise.all(
      patterns.map((pattern) => store.upsertTemplatePattern(pattern)),
    );
    return onboardingRedirect(c, businessSlug, "sample", {
      message: "Brand style saved. Create the first sample now.",
    });
  } catch (error) {
    return onboardingRedirect(c, businessSlug, "brand", {
      error: error instanceof Error ? error.message : "Brand setup failed.",
    });
  }
});

app.post("/onboarding/:businessSlug/brand/suggest-colors", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const existing = await store.getBrand(businessSlug);
  if (!existing)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  try {
    const form = await c.req.formData();
    const logoFile = form.get("logoFile");
    const boardFile = form.get("boardFile");
    const publicBase = baseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
    let logoUrl = existing.logoUrl;
    let boardUrl = existing.brandReferenceBoardUrl;
    if (isUploadedFile(logoFile)) {
      logoUrl = await uploadImage({
        env: c.env,
        file: logoFile,
        keyPrefix: `businesses/${businessSlug}/brand/logo-${Date.now()}`,
        publicBaseUrl: publicBase,
      });
    }
    if (isUploadedFile(boardFile)) {
      boardUrl = await uploadImage({
        env: c.env,
        file: boardFile,
        keyPrefix: `businesses/${businessSlug}/brand/reference-board-${Date.now()}`,
        publicBaseUrl: publicBase,
      });
    }
    const logoImage = await imageUrlToBase64({
      url: logoUrl,
      env: c.env,
      publicBaseUrl: publicBase,
    });
    const colors = await suggestColorsFromLogo({
      env: c.env,
      brand: { ...existing, logoUrl, brandReferenceBoardUrl: boardUrl },
      logoImage,
    });
    const style = formString(form, "style") || "premium";
    const notes = formString(form, "notes");
    const validated = validateBrand(
      {
        ...existing,
        logoUrl,
        brandReferenceBoardUrl: boardUrl,
        colors,
        typography: {
          headingStyle:
            style === "bold"
              ? "bold high-contrast sans-serif built for short promotional posters"
              : style === "minimal"
                ? "minimal premium sans-serif with confident spacing"
                : "clean bold sans-serif with strong mobile readability",
          bodyStyle: "simple readable sans-serif",
          fontMood: `${style}, modern, clear, and brand-safe`,
        },
        visualStyle: {
          ...existing.visualStyle,
          mood: `${style}, trustworthy, conversion-focused, and easy to scan`,
          avoid: [
            ...new Set([
              ...existing.visualStyle.avoid,
              ...formLines(form, "notes"),
              ...(notes ? [notes] : []),
            ]),
          ],
        },
      },
      businessSlug,
      existing,
    );
    if (!validated.value) {
      return onboardingRedirect(c, businessSlug, "brand", {
        error: validated.errors.join(" "),
      });
    }
    await store.upsertBrand(validated.value);
    return onboardingRedirect(c, businessSlug, "brand", {
      message: logoImage
        ? "Colors suggested from the logo. Review and adjust if needed."
        : "Logo saved. Add a PNG, JPG, or WebP logo for stronger color suggestions.",
    });
  } catch (error) {
    return onboardingRedirect(c, businessSlug, "brand", {
      error:
        error instanceof Error ? error.message : "Color suggestion failed.",
    });
  }
});

app.get("/onboarding/:businessSlug/sample", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.redirect("/?error=Please+sign+in+to+continue+onboarding", 303);
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  const today = todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  const entry = await store.getCalendarEntry(businessSlug, today);
  const poster = await store.getGeneratedPoster(
    businessSlug,
    entry?.posterType ?? "general",
    today,
  );
  return c.html(
    renderOnboardingSample({
      brand,
      today,
      entry,
      poster,
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
});

app.post("/onboarding/:businessSlug/sample-content", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  const form = await c.req.formData();
  const resolvedDate =
    resolveDate(
      formString(form, "date"),
      c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
    ) ?? todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  const content = await generateSampleContent({
    env: c.env,
    brand,
    style: formString(form, "contentStyle") || "mixed",
    notes: formString(form, "contentNotes"),
  });
  await store.upsertCalendarEntry({
    businessSlug,
    date: resolvedDate,
    topic: content.topic,
    message: content.message,
    cta: content.cta,
    posterMode: "normal",
    posterType: content.posterType,
    templateId: null,
    inspirationImageUrl: null,
    notes: formString(form, "contentNotes") || null,
    status: "planned",
  });
  return onboardingRedirect(c, businessSlug, "sample", {
    message: "Sample content created. Review it, then generate the poster.",
  });
});

app.post("/onboarding/:businessSlug/sample", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const form = await c.req.formData();
  const resolvedDate =
    resolveDate(
      formString(form, "date"),
      c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
    ) ?? todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  const topic = formString(form, "topic") || "Helpful tip for customers";
  const existingEntry = await store.getCalendarEntry(
    businessSlug,
    resolvedDate,
  );
  const entry = await store.upsertCalendarEntry({
    businessSlug,
    date: resolvedDate,
    topic,
    message: formString(form, "message") || null,
    cta: existingEntry?.cta ?? "Contact us today",
    posterMode: "normal",
    posterType: existingEntry?.posterType ?? "general",
    templateId: existingEntry?.templateId ?? null,
    inspirationImageUrl: null,
    notes: "Onboarding sample poster. Keep it clean, useful, and brand-led.",
    status: "planned",
  });
  try {
    const poster = await runPosterOrchestrator({
      env: c.env,
      store,
      businessSlug,
      posterType: "general",
      dateOrToday: resolvedDate,
      requestUrl: c.req.url,
      force: true,
      calendarEntry: entry,
    });
    if (poster.status === "ready") {
      await store.upsertCalendarEntry({ ...entry, status: "poster_ready" });
    }
    return onboardingRedirect(c, businessSlug, "sample", {
      message:
        poster.status === "ready"
          ? "Sample poster generated. Use this style daily when you are ready."
          : poster.failureReason || "Sample poster needs review.",
    });
  } catch (error) {
    return onboardingRedirect(c, businessSlug, "sample", {
      error:
        error instanceof Error
          ? error.message
          : "Sample poster generation failed.",
    });
  }
});

app.get("/onboarding/:businessSlug/plan", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.redirect("/?error=Please+sign+in+to+continue+onboarding", 303);
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  const today = todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  const month = normalizeMonth(c.req.query("month") || "", today);
  const entries = await store.listCalendarEntries(businessSlug, { month });
  return c.html(
    renderOnboardingPlan({
      brand,
      month,
      entries,
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
});

app.post("/onboarding/:businessSlug/plan", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  const today = todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  const form = await c.req.formData();
  const month = normalizeMonth(formString(form, "month"), today);
  const entries = await generateCalendarEntries({
    env: c.env,
    brandName: brand.businessName,
    businessSlug,
    month,
    frequency: formString(form, "frequency") || "daily",
    style: formString(form, "style") || "mixed",
    notes: formString(form, "notes"),
  });
  await Promise.all(entries.map((entry) => store.upsertCalendarEntry(entry)));
  return onboardingRedirect(c, businessSlug, "plan", {
    month,
    message: `${entries.length} calendar ideas generated. Review and approve when ready.`,
  });
});

app.get("/onboarding/:businessSlug/activate", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.redirect("/?error=Please+sign+in+to+continue+onboarding", 303);
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand)
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  const automationSettings =
    (await store.getAutomationSettings(businessSlug)) ??
    defaultAutomationSettings(businessSlug);
  return c.html(
    renderOnboardingActivate({
      brand,
      automationSettings,
      emailProviderConfigured: Boolean(
        c.env.RESEND_API_KEY?.trim() && c.env.POSTER_FROM_EMAIL?.trim(),
      ),
      geminiConfigured: Boolean(c.env.GEMINI_API_KEY?.trim()),
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
});

app.post("/onboarding/:businessSlug/activate", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const form = await c.req.formData();
  const localTime = formString(form, "localTime");
  const emailEnabled = form.has("emailEnabled");
  const recipientEmails = formString(form, "recipientEmails")
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!isValidLocalTime(localTime)) {
    return onboardingRedirect(c, businessSlug, "activate", {
      error: "Choose a valid daily generation time.",
    });
  }
  if (
    recipientEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return onboardingRedirect(c, businessSlug, "activate", {
      error: "Enter valid recipient email addresses.",
    });
  }
  if (emailEnabled && recipientEmails.length === 0) {
    return onboardingRedirect(c, businessSlug, "activate", {
      error: "Add at least one delivery email before enabling email.",
    });
  }
  if (
    emailEnabled &&
    (!c.env.RESEND_API_KEY?.trim() || !c.env.POSTER_FROM_EMAIL?.trim())
  ) {
    return onboardingRedirect(c, businessSlug, "activate", {
      error: "Email delivery is not configured yet. Add Resend settings first.",
    });
  }
  await storeFor(c.env).upsertAutomationSettings({
    businessSlug,
    enabled: form.has("enabled"),
    localTime,
    posterTypes: ["general"],
    forceGeneration: false,
    emailEnabled,
    recipientEmails,
  });
  return c.redirect(
    `/app/${businessSlug}?message=${encodeURIComponent("Your daily poster system is active.")}`,
    303,
  );
});

app.get("/app/:businessSlug", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.redirect("/?error=Please+sign+in+to+open+the+app", 303);
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    clearAdminSession(c);
    return c.redirect("/?error=Business+not+found", 303);
  }
  const timezone = c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
  const today = todayInTimezone(timezone);
  const month = normalizeMonth(c.req.query("month") || "", today);
  const calendarPage = Number.parseInt(c.req.query("calendarPage") || "1", 10);
  const historyPage = Number.parseInt(c.req.query("historyPage") || "1", 10);
  const historyPosterType = c.req.query("historyPosterType") || "all";
  const historyStatus = c.req.query("historyStatus") || "all";
  const editDate = c.req.query("editDate") || undefined;
  const from = today;
  const to = addDays(today, 6);
  const [
    calendarEntries,
    nextEntries,
    todayEntry,
    todayPoster,
    recentPosters,
    templatePatterns,
  ] = await Promise.all([
    store.listCalendarEntries(businessSlug, { month }),
    store.listCalendarEntries(businessSlug, { from, to }),
    store.getCalendarEntry(businessSlug, today),
    store
      .getGeneratedPoster(businessSlug, "general", today)
      .then(
        async (poster) =>
          poster ??
          (await store.getGeneratedPoster(businessSlug, "awareness", today)) ??
          (await store.getGeneratedPoster(businessSlug, "reference", today)),
      ),
    store.listGeneratedPosters(businessSlug, { limit: 100 }),
    store.listTemplatePatterns(businessSlug),
  ]);
  const automationSettings =
    (await store.getAutomationSettings(businessSlug)) ??
    defaultAutomationSettings(businessSlug);
  return c.html(
    renderCustomerApp({
      brand,
      month,
      today,
      calendarEntries,
      nextEntries,
      todayEntry,
      todayPoster,
      recentPosters,
      templatePatterns,
      automationSettings,
      calendarPage: Number.isFinite(calendarPage) ? calendarPage : 1,
      historyPage: Number.isFinite(historyPage) ? historyPage : 1,
      historyPosterType,
      historyStatus,
      editDate,
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
});

app.post("/app/:businessSlug/calendar/save", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }
  try {
    const form = await c.req.formData();
    const date = formString(form, "date");
    const resolvedDate = resolveDate(
      date,
      c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
    );
    if (!resolvedDate) {
      return customerRedirect(c, businessSlug, {
        error: "Choose a valid calendar date.",
      });
    }
    const posterModeValue = formString(form, "posterMode") || "normal";
    const statusValue = formString(form, "status") || "planned";
    const posterTypeValue = formString(form, "posterType") || "general";
    if (
      !isCalendarPosterMode(posterModeValue) ||
      !isCalendarEntryStatus(statusValue) ||
      !isPosterType(posterTypeValue)
    ) {
      return customerRedirect(c, businessSlug, {
        month: monthFromDate(resolvedDate),
        error: "Calendar item has an invalid mode, status, or poster type.",
      });
    }
    const inspirationFile = form.get("inspirationImage");
    let inspirationImageUrl =
      formString(form, "existingInspirationImageUrl") || null;
    if (isUploadedFile(inspirationFile)) {
      inspirationImageUrl = await uploadImage({
        env: c.env,
        file: inspirationFile,
        keyPrefix: `businesses/${businessSlug}/calendar/${resolvedDate}/inspiration-${Date.now()}`,
        publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
      });
    }
    const topic = formString(form, "topic");
    if (!topic) {
      return customerRedirect(c, businessSlug, {
        month: monthFromDate(resolvedDate),
        error: "Add a topic before saving the calendar item.",
      });
    }
    await store.upsertCalendarEntry({
      businessSlug,
      date: resolvedDate,
      topic,
      message: formString(form, "message") || null,
      cta: formString(form, "cta") || null,
      posterMode: posterModeValue,
      posterType:
        posterModeValue === "inspiration" ? "reference" : posterTypeValue,
      templateId: formString(form, "templateId") || null,
      inspirationImageUrl,
      notes: formString(form, "notes") || null,
      status: statusValue,
    });
    return customerRedirect(c, businessSlug, {
      month: monthFromDate(resolvedDate),
      message: "Calendar item saved.",
    });
  } catch (error) {
    return customerRedirect(c, businessSlug, {
      error: error instanceof Error ? error.message : "Calendar save failed.",
    });
  }
});

app.post("/app/:businessSlug/calendar/generate-month", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }
  const today = todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  const form = await c.req.formData();
  const month = normalizeMonth(formString(form, "month"), today);
  const frequency = formString(form, "frequency") || "daily";
  const style = formString(form, "style") || "mixed";
  const notes = formString(form, "notes");
  const entries = await generateCalendarEntries({
    env: c.env,
    brandName: brand.businessName,
    businessSlug,
    month,
    frequency,
    style,
    notes,
  });
  await Promise.all(entries.map((entry) => store.upsertCalendarEntry(entry)));
  return customerRedirect(c, businessSlug, {
    month,
    message: `${entries.length} calendar ideas generated for ${month}.`,
  });
});

app.post("/app/:businessSlug/calendar/generate-poster", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const form = await c.req.formData();
  const date = formString(form, "date");
  const resolvedDate = resolveDate(
    date,
    c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
  );
  if (!resolvedDate) {
    return customerRedirect(c, businessSlug, {
      error: "Choose a valid date before generating.",
    });
  }

  let entry = await store.getCalendarEntry(businessSlug, resolvedDate);
  const topicFromForm = formString(form, "topic");
  if (topicFromForm) {
    const posterModeValue = formString(form, "posterMode") || "normal";
    const statusValue = formString(form, "status") || "planned";
    const posterTypeValue = formString(form, "posterType") || "general";
    if (
      !isCalendarPosterMode(posterModeValue) ||
      !isCalendarEntryStatus(statusValue) ||
      !isPosterType(posterTypeValue)
    ) {
      return customerRedirect(c, businessSlug, {
        month: monthFromDate(resolvedDate),
        error: "Calendar item has an invalid mode, status, or poster type.",
      });
    }
    const inspirationFile = form.get("inspirationImage");
    let inspirationImageUrl =
      formString(form, "existingInspirationImageUrl") ||
      entry?.inspirationImageUrl ||
      null;
    if (isUploadedFile(inspirationFile)) {
      inspirationImageUrl = await uploadImage({
        env: c.env,
        file: inspirationFile,
        keyPrefix: `businesses/${businessSlug}/calendar/${resolvedDate}/inspiration-${Date.now()}`,
        publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
      });
    }
    entry = await store.upsertCalendarEntry({
      businessSlug,
      date: resolvedDate,
      topic: topicFromForm,
      message: formString(form, "message") || null,
      cta: formString(form, "cta") || null,
      posterMode: posterModeValue,
      posterType:
        posterModeValue === "inspiration" ? "reference" : posterTypeValue,
      templateId: formString(form, "templateId") || null,
      inspirationImageUrl,
      notes: formString(form, "notes") || null,
      status: statusValue,
    });
  }
  const posterType = entry?.posterType ?? "general";
  try {
    const poster = await runPosterOrchestrator({
      env: c.env,
      store,
      businessSlug,
      posterType,
      dateOrToday: resolvedDate,
      requestUrl: c.req.url,
      force: formString(form, "force") === "true",
      calendarEntry: entry,
    });
    if (poster.status === "ready" && entry) {
      await store.upsertCalendarEntry({ ...entry, status: "poster_ready" });
    }
    return customerRedirect(c, businessSlug, {
      month: monthFromDate(resolvedDate),
      message:
        poster.status === "ready"
          ? "Poster generated successfully."
          : poster.failureReason ||
            "Poster generation started but needs review.",
    });
  } catch (error) {
    return customerRedirect(c, businessSlug, {
      month: monthFromDate(resolvedDate),
      error:
        error instanceof Error ? error.message : "Poster generation failed.",
    });
  }
});

app.post("/app/:businessSlug/calendar/edit-poster", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }
  const form = await c.req.formData();
  const resolvedDate = resolveDate(
    formString(form, "date"),
    c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
  );
  if (!resolvedDate) {
    return customerRedirect(c, businessSlug, {
      error: "Choose a valid date before editing a poster.",
    });
  }
  const editInstruction = formString(form, "editInstruction").slice(0, 1200);
  if (!editInstruction) {
    return customerRedirect(c, businessSlug, {
      month: monthFromDate(resolvedDate),
      error: "Add an edit instruction before editing the poster image.",
    });
  }

  const entry = await store.getCalendarEntry(businessSlug, resolvedDate);
  const requestedPosterType = formString(form, "posterType");
  const posterTypesToTry: PosterType[] = [
    entry?.posterType,
    isPosterType(requestedPosterType) ? requestedPosterType : null,
    "general",
    "awareness",
    "reference",
    "offer",
    "festival",
    "anniversary",
    "review",
  ].filter(
    (value, index, values): value is PosterType =>
      Boolean(value) && values.indexOf(value) === index,
  );
  const existingCandidates = await Promise.all(
    posterTypesToTry.map(async (posterType) => ({
      posterType,
      poster: await store.getGeneratedPoster(
        businessSlug,
        posterType,
        resolvedDate,
      ),
    })),
  );
  const existing = existingCandidates.find(
    (candidate) =>
      candidate.poster?.status === "ready" && candidate.poster.imageUrl,
  );
  if (!existing?.poster?.imageUrl) {
    return customerRedirect(c, businessSlug, {
      month: monthFromDate(resolvedDate),
      error: "Generate a poster for this date before using custom image edits.",
    });
  }

  const brief: Record<string, unknown> = {
    angle: entry?.topic ?? existing.poster.angle ?? "Edited poster",
    contentSource: "user_image_edit",
    calendarEntry: entry,
    originalPosterUrl: existing.poster.imageUrl,
    userEditInstruction: editInstruction,
  };
  const prompt = `EDIT EXISTING POSTER IMAGE

Business: ${brand.businessName}
Phone: ${brand.phone}
Website: ${brand.websiteUrl ?? ""}
Date: ${resolvedDate}

Use the attached current generated poster as the source image. Apply the user's custom edit instruction while preserving the clinic's brand identity, logo usage, phone number, color theme, aspect ratio, and overall professional dental-clinic quality.

User edit instruction:
${editInstruction}

Important rules:
- Do not create an unrelated new poster.
- Keep the same poster purpose unless the user explicitly asks to change it.
- Preserve or improve legibility of all important text.
- Do not invent prices, claims, offers, dates, patient outcomes, or medical promises.
- Do not copy any competitor identity or external branding.
- Return one finished 9:16 poster image.`;

  try {
    const poster = await generatePosterImageFromPrompt({
      env: c.env,
      store,
      businessSlug,
      posterType: existing.posterType,
      dateOrToday: resolvedDate,
      requestUrl: c.req.url,
      prompt,
      brief,
      calendarEntry: entry,
      editSourceImageUrl: existing.poster.imageUrl,
    });
    if (poster.status === "ready" && entry) {
      await store.upsertCalendarEntry({ ...entry, status: "poster_ready" });
    }
    return customerRedirect(c, businessSlug, {
      month: monthFromDate(resolvedDate),
      message:
        poster.status === "ready"
          ? "Poster edited successfully."
          : poster.failureReason || "Poster edit needs review.",
    });
  } catch (error) {
    return customerRedirect(c, businessSlug, {
      month: monthFromDate(resolvedDate),
      error: error instanceof Error ? error.message : "Poster edit failed.",
    });
  }
});

app.post("/app/:businessSlug/templates/generate", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }
  const form = await c.req.formData();
  const referenceFile = form.get("referenceImage");
  let referenceImageUrl: string | null = null;
  if (isUploadedFile(referenceFile)) {
    referenceImageUrl = await uploadImage({
      env: c.env,
      file: referenceFile,
      keyPrefix: `businesses/${businessSlug}/templates/reference-${Date.now()}`,
      publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
    });
  }
  const referenceImage = await imageUrlToBase64({
    url: referenceImageUrl,
    env: c.env,
    publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
  });
  const patterns = await generateTemplatePatterns({
    env: c.env,
    brand,
    notes: formString(form, "notes"),
    referenceImageUrl,
    referenceImage,
  });
  await Promise.all(
    patterns.map((pattern) => store.upsertTemplatePattern(pattern)),
  );
  return customerRedirect(c, businessSlug, {
    message: `${patterns.length} template pattern ideas saved.`,
  });
});

app.post("/app/:businessSlug/templates/toggle", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const form = await c.req.formData();
  const templateId = formString(form, "templateId");
  const pattern = await storeFor(c.env).getTemplatePattern(
    businessSlug,
    templateId,
  );
  if (!pattern) {
    return customerRedirect(c, businessSlug, {
      error: "Template pattern not found.",
    });
  }
  await storeFor(c.env).upsertTemplatePattern({
    ...pattern,
    isActive: formString(form, "isActive") === "true",
  });
  return customerRedirect(c, businessSlug, {
    message: "Template pattern updated.",
  });
});

app.post("/app/:businessSlug/templates/delete", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const form = await c.req.formData();
  const templateId = formString(form, "templateId");
  if (templateId) {
    await storeFor(c.env).deleteTemplatePattern(businessSlug, templateId);
  }
  return customerRedirect(c, businessSlug, {
    message: "Template pattern deleted.",
  });
});

app.post("/app/:businessSlug/settings", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const form = await c.req.formData();
  const enabled = form.has("enabled");
  const emailEnabled = form.has("emailEnabled");
  const localTime = formString(form, "localTime");
  const recipientEmails = formString(form, "recipientEmails")
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!isValidLocalTime(localTime)) {
    return customerRedirect(c, businessSlug, {
      error: "Choose a valid daily generation time.",
    });
  }
  if (
    recipientEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return customerRedirect(c, businessSlug, {
      error: "Enter valid recipient email addresses.",
    });
  }
  if (emailEnabled && recipientEmails.length === 0) {
    return customerRedirect(c, businessSlug, {
      error: "Add at least one delivery email before enabling email.",
    });
  }
  if (
    emailEnabled &&
    (!c.env.RESEND_API_KEY?.trim() || !c.env.POSTER_FROM_EMAIL?.trim())
  ) {
    return customerRedirect(c, businessSlug, {
      error:
        "Email delivery is not configured yet. Add Resend settings before enabling email.",
    });
  }
  await storeFor(c.env).upsertAutomationSettings({
    businessSlug,
    enabled,
    localTime,
    posterTypes: ["general"],
    forceGeneration: false,
    emailEnabled,
    recipientEmails,
  });
  return customerRedirect(c, businessSlug, {
    message: "Daily poster settings saved.",
  });
});

app.get("/admin/:businessSlug", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.redirect("/?error=Please+sign+in+to+open+the+dashboard", 303);
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    clearAdminSession(c);
    return c.redirect("/?error=Business+not+found", 303);
  }
  const posterTypeValue = c.req.query("posterType") || "awareness";
  const posterType = isPosterType(posterTypeValue)
    ? posterTypeValue
    : "awareness";
  const requestedDate = c.req.query("date") || "today";
  const selectedDate =
    resolveDate(requestedDate, c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE) ??
    todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  const [
    savedGenerationSettings,
    savedPromptSettings,
    savedContentSourceSettings,
    savedAutomationSettings,
  ] = await Promise.all([
    store.getGenerationSettings(businessSlug),
    store.getPromptSettings(businessSlug),
    store.getContentSourceSettings(businessSlug),
    store.getAutomationSettings(businessSlug),
  ]);
  const [generatedPoster, recentGeneratedPosters, typeReferences] =
    await Promise.all([
      store.getGeneratedPoster(businessSlug, posterType, selectedDate),
      store.listGeneratedPosters(businessSlug, {
        posterType,
        limit: 24,
      }),
      Promise.all(
        POSTER_TYPES.map((type) => store.getTypeReference(businessSlug, type)),
      ),
    ]);
  const allTypeReferences = Object.fromEntries(
    POSTER_TYPES.map((type, index) => [type, typeReferences[index] ?? null]),
  ) as Record<PosterType, (typeof typeReferences)[number]>;
  return c.html(
    renderDashboard({
      brand,
      typeReference: allTypeReferences[posterType],
      allTypeReferences,
      generatedPoster,
      recentGeneratedPosters,
      generationSettings:
        savedGenerationSettings ??
        defaultGenerationSettings(businessSlug, c.env),
      promptSettings: normalizePromptSettings(
        savedPromptSettings ?? defaultPromptSettings(businessSlug),
      ),
      contentSourceSettings:
        savedContentSourceSettings ??
        defaultContentSourceSettings(businessSlug),
      automationSettings:
        savedAutomationSettings ?? defaultAutomationSettings(businessSlug),
      emailProviderConfigured: Boolean(
        c.env.RESEND_API_KEY?.trim() && c.env.POSTER_FROM_EMAIL?.trim(),
      ),
      automationTimezone: c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
      selectedType: posterType,
      selectedDate,
      publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
});

app.post("/admin/:businessSlug/automation-settings", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const form = await c.req.formData();
  const enabled = form.has("enabled");
  const forceGeneration = form.has("forceGeneration");
  const emailEnabled = form.has("emailEnabled");
  const localTime = formString(form, "localTime");
  const posterTypes = formStrings(form, "posterTypes").filter(
    (value): value is PosterType =>
      isPosterType(value) && AUTOMATABLE_POSTER_TYPES.includes(value),
  );
  const recipientEmails = formString(form, "recipientEmails")
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!isValidLocalTime(localTime)) {
    return adminRedirect(c, businessSlug, {
      error: "Choose a valid local automation time.",
    });
  }
  if (enabled && posterTypes.length === 0) {
    return adminRedirect(c, businessSlug, {
      error: "Choose at least one automatable poster type.",
    });
  }
  if (
    recipientEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return adminRedirect(c, businessSlug, {
      error: "Enter valid recipient email addresses.",
    });
  }
  if (emailEnabled && recipientEmails.length === 0) {
    return adminRedirect(c, businessSlug, {
      error: "Add at least one recipient before enabling email delivery.",
    });
  }
  if (
    emailEnabled &&
    (!c.env.RESEND_API_KEY?.trim() || !c.env.POSTER_FROM_EMAIL?.trim())
  ) {
    return adminRedirect(c, businessSlug, {
      error:
        "Configure RESEND_API_KEY and POSTER_FROM_EMAIL before enabling delivery.",
    });
  }
  await storeFor(c.env).upsertAutomationSettings({
    businessSlug,
    enabled,
    localTime,
    posterTypes,
    forceGeneration,
    emailEnabled,
    recipientEmails,
  });
  return adminRedirect(c, businessSlug, {
    message: "Automation schedule and email delivery settings saved.",
  });
});

app.post("/admin/:businessSlug/automation-test-email", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const form = await c.req.formData();
  const posterType = formString(form, "posterType");
  const date = formString(form, "date");
  if (!isPosterType(posterType) || !resolveDate(date, DEFAULT_TIMEZONE)) {
    return adminRedirect(c, businessSlug, {
      error: "Choose a valid poster type and date for the test email.",
    });
  }
  const store = storeFor(c.env);
  const [settings, poster] = await Promise.all([
    store.getAutomationSettings(businessSlug),
    store.getGeneratedPoster(businessSlug, posterType, date),
  ]);
  if (!settings?.recipientEmails.length) {
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      error: "Save at least one recipient email first.",
    });
  }
  if (!poster || poster.status !== "ready" || !poster.imageUrl) {
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      error: "Generate a ready poster before sending a test email.",
    });
  }
  try {
    await sendPosterEmail({
      env: c.env,
      settings,
      poster,
      idempotencyKey: `test-${businessSlug}-${posterType}-${date}-${Date.now()}`,
    });
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      message: "Test poster email sent successfully.",
    });
  } catch (error) {
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      error: error instanceof Error ? error.message : "Test email failed.",
    });
  }
});

app.post("/admin/:businessSlug/content-sources", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const form = await c.req.formData();
  const awarenessMode = formString(form, "awarenessMode");
  const googleSheetUrl = formString(form, "googleSheetUrl") || null;
  if (awarenessMode !== "sheet_first" && awarenessMode !== "ai_only") {
    return adminRedirect(c, businessSlug, {
      error: "Invalid awareness content source.",
    });
  }
  try {
    if (googleSheetUrl) googleSheetCsvUrl(googleSheetUrl);
    await storeFor(c.env).upsertContentSourceSettings({
      businessSlug,
      awarenessMode,
      googleSheetUrl,
    });
    return adminRedirect(c, businessSlug, {
      message: "Awareness content source saved.",
    });
  } catch (error) {
    return adminRedirect(c, businessSlug, {
      error:
        error instanceof Error
          ? error.message
          : "Content source update failed.",
    });
  }
});

app.post("/admin/:businessSlug/generation-settings", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  if (!(await store.getBrand(businessSlug))) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }

  try {
    const form = await c.req.formData();
    const textModel = formString(form, "textModel");
    const imageModel = formString(form, "imageModel");
    const imageResolution = formString(form, "imageResolution");
    if (!isTextModel(textModel)) {
      return adminRedirect(c, businessSlug, {
        error: "Unsupported Gemini text model.",
      });
    }
    if (!isImageModel(imageModel)) {
      return adminRedirect(c, businessSlug, {
        error: "Unsupported Gemini image model.",
      });
    }
    if (!isImageResolution(imageResolution)) {
      return adminRedirect(c, businessSlug, {
        error: "Unsupported image resolution.",
      });
    }

    const normalized = normalizeGenerationSettings({
      businessSlug,
      textModel,
      imageModel,
      imageResolution,
      aspectRatio: "9:16",
    });
    await store.upsertGenerationSettings(normalized);
    return adminRedirect(c, businessSlug, {
      message: "Generation models and resolution saved.",
    });
  } catch (error) {
    return adminRedirect(c, businessSlug, {
      error:
        error instanceof Error
          ? error.message
          : "Generation settings update failed.",
    });
  }
});

app.post("/admin/:businessSlug/prompt-settings", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  if (!(await store.getBrand(businessSlug))) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }
  try {
    const form = await c.req.formData();
    const defaults = defaultPromptSettings(businessSlug);
    const posterTypePrompts = Object.fromEntries(
      POSTER_TYPES.map((type) => [
        type,
        formString(form, `posterTypePrompt_${type}`) ||
          defaults.posterTypePrompts[type],
      ]),
    ) as typeof defaults.posterTypePrompts;
    await store.upsertPromptSettings(
      normalizePromptSettings({
        businessSlug,
        contentPromptTemplate: formString(form, "contentPromptTemplate"),
        masterImagePromptTemplate: formString(
          form,
          "masterImagePromptTemplate",
        ),
        referencePromptTemplate: formString(form, "referencePromptTemplate"),
        posterTypePrompts,
      }),
    );
    return adminRedirect(c, businessSlug, {
      posterType: formString(form, "selectedPosterType") || "awareness",
      message: "Prompt templates saved.",
    });
  } catch (error) {
    return adminRedirect(c, businessSlug, {
      error:
        error instanceof Error
          ? error.message
          : "Prompt settings update failed.",
    });
  }
});

app.post("/admin/:businessSlug/brand", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const existing = await store.getBrand(businessSlug);
  if (!existing) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }

  try {
    const form = await c.req.formData();
    const logoFile = form.get("logoFile");
    const boardFile = form.get("boardFile");
    const brandInput = {
      businessName: formString(form, "businessName"),
      phone: formString(form, "phone"),
      websiteUrl: formString(form, "websiteUrl") || null,
      logoUrl: formString(form, "logoUrl"),
      brandReferenceBoardUrl: formString(form, "brandReferenceBoardUrl"),
      colors: {
        primary: formString(form, "primary"),
        secondary: formString(form, "secondary"),
        accent: formString(form, "accent"),
        darkText: formString(form, "darkText"),
        mutedText: formString(form, "mutedText"),
      },
      typography: {
        headingStyle: formString(form, "headingStyle"),
        bodyStyle: formString(form, "bodyStyle"),
        fontMood: formString(form, "fontMood"),
      },
      visualStyle: {
        mood: formString(form, "mood"),
        layout: formString(form, "layout"),
        photoStyle: formString(form, "photoStyle"),
        avoid: formLines(form, "avoid"),
      },
      defaultPosterRules: formLines(form, "defaultPosterRules"),
    };
    const preliminary = validateBrand(brandInput, businessSlug, existing);
    if (!preliminary.value) {
      return adminRedirect(c, businessSlug, {
        error: preliminary.errors.join(" "),
      });
    }

    const publicBase = baseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
    if (isUploadedFile(logoFile)) {
      brandInput.logoUrl = await uploadImage({
        env: c.env,
        file: logoFile,
        keyPrefix: `businesses/${businessSlug}/brand/logo-${Date.now()}`,
        publicBaseUrl: publicBase,
      });
    }
    if (isUploadedFile(boardFile)) {
      brandInput.brandReferenceBoardUrl = await uploadImage({
        env: c.env,
        file: boardFile,
        keyPrefix: `businesses/${businessSlug}/brand/reference-board-${Date.now()}`,
        publicBaseUrl: publicBase,
      });
    }
    const validated = validateBrand(brandInput, businessSlug, existing);
    if (!validated.value) {
      return adminRedirect(c, businessSlug, {
        error: validated.errors.join(" "),
      });
    }
    await store.upsertBrand(validated.value);
    return adminRedirect(c, businessSlug, {
      message: "Brand system saved successfully.",
    });
  } catch (error) {
    return adminRedirect(c, businessSlug, {
      error: error instanceof Error ? error.message : "Brand update failed.",
    });
  }
});

app.post("/admin/:businessSlug/preset", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const existing = await store.getBrand(businessSlug);
  if (!existing) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }
  await store.upsertBrand(applyDrPoojaSmileCraftPreset(existing));
  return adminRedirect(c, businessSlug, {
    message: "Smile Craft poster preset applied.",
  });
});

app.post("/admin/:businessSlug/type-reference", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }

  let posterType = "awareness";
  let date = todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  try {
    const form = await c.req.formData();
    posterType = formString(form, "posterType");
    date = formString(form, "date") || date;
    if (!isPosterType(posterType)) {
      return adminRedirect(c, businessSlug, {
        error: "Invalid poster type.",
      });
    }
    const existingReference = await store.getTypeReference(
      businessSlug,
      posterType,
    );
    const keepUrls = formStrings(form, "keepReferenceImageUrls");
    const legacyFile = form.get("typeReferenceFile");
    const uploadedFiles = [
      ...form.getAll("typeReferenceFiles"),
      ...(isUploadedFile(legacyFile) ? [legacyFile] : []),
    ].filter(isUploadedFile);
    const referenceImageUrls =
      keepUrls.length > 0
        ? [...keepUrls]
        : uploadedFiles.length === 0
          ? [...(existingReference?.referenceImageUrls ?? [])]
          : [];
    if (referenceImageUrls.length + uploadedFiles.length > 14) {
      return adminRedirect(c, businessSlug, {
        posterType,
        date,
        error: "A poster type can store at most 14 reference images.",
      });
    }
    const uploadStartedAt = Date.now();
    for (const [index, file] of uploadedFiles.entries()) {
      referenceImageUrls.push(
        await uploadImage({
          env: c.env,
          file,
          keyPrefix: `businesses/${businessSlug}/types/${posterType}/reference-${uploadStartedAt}-${index + 1}`,
          publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
        }),
      );
    }
    await store.upsertTypeReference({
      businessSlug,
      posterType,
      productionReferenceImageUrl: referenceImageUrls[0] ?? null,
      referenceImageUrls,
      notes: formString(form, "notes") || null,
    });
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      message: "Poster type reference saved successfully.",
    });
  } catch (error) {
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      error:
        error instanceof Error
          ? error.message
          : "Poster type reference update failed.",
    });
  }
});

app.post("/admin/:businessSlug/generation-lab/brief", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return jsonError(c, 403, "Admin session required.");
  }
  const form = await c.req.formData();
  const posterType = formString(form, "posterType");
  const date = formString(form, "date");
  if (!isPosterType(posterType)) {
    return jsonError(c, 400, "Invalid poster type.");
  }
  const resolvedDate = resolveDate(
    date,
    c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
  );
  if (!resolvedDate) {
    return jsonError(c, 400, "Date must be today or a valid YYYY-MM-DD date.");
  }
  const apiKey = c.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return jsonError(c, 500, "GEMINI_API_KEY is not configured.");
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return jsonError(c, 404, "Business not found.");
  }
  const [typeReference, savedGenerationSettings, savedPromptSettings] =
    await Promise.all([
      store.getTypeReference(businessSlug, posterType),
      store.getGenerationSettings(businessSlug),
      store.getPromptSettings(businessSlug),
    ]);
  if (
    posterType === "reference" &&
    !typeReference?.referenceImageUrls.length &&
    !typeReference?.productionReferenceImageUrl
  ) {
    return jsonError(
      c,
      400,
      "Upload at least one source poster in Reference remake before preparing content.",
    );
  }
  const generationSettings =
    savedGenerationSettings ?? defaultGenerationSettings(businessSlug, c.env);
  const promptSettings = normalizePromptSettings(
    savedPromptSettings ?? defaultPromptSettings(businessSlug),
  );
  const base = baseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
  const contextUrl = `${base}/daily-poster/${businessSlug}/${posterType}/today`;
  const contextJsonUrl = `${contextUrl}.json`;
  const sourceSettings =
    (await store.getContentSourceSettings(businessSlug)) ??
    defaultContentSourceSettings(businessSlug);
  const sheetLookup =
    posterType === "awareness"
      ? await resolveAwarenessContent(sourceSettings, resolvedDate)
      : null;
  const suppliedContent = sheetLookup?.row ?? null;
  const reviewFile = form.get("reviewScreenshot");
  const reviewMessage = formString(form, "reviewMessage");
  const referenceMessage = formString(form, "referenceMessage").slice(0, 500);
  let reviewScreenshotUrl: string | null = null;
  let reviewScreenshot = null;
  let referencePoster = null;
  if (posterType === "review") {
    if (!isUploadedFile(reviewFile) && !reviewMessage) {
      return jsonError(
        c,
        400,
        "Upload a customer review screenshot or paste the review message.",
      );
    }
    if (isUploadedFile(reviewFile)) {
      reviewScreenshotUrl = await uploadImage({
        env: c.env,
        file: reviewFile,
        keyPrefix: `businesses/${businessSlug}/reviews/${resolvedDate}-${Date.now()}`,
        publicBaseUrl: base,
      });
      reviewScreenshot = await imageUrlToBase64({
        url: reviewScreenshotUrl,
        env: c.env,
        publicBaseUrl: base,
      });
    }
  }
  if (posterType === "reference") {
    const referencePosterUrl =
      typeReference?.referenceImageUrls[0] ??
      typeReference?.productionReferenceImageUrl ??
      null;
    referencePoster = await imageUrlToBase64({
      url: referencePosterUrl,
      env: c.env,
      publicBaseUrl: base,
    });
    if (!referencePoster) {
      return jsonError(c, 400, "The saved source poster could not be loaded.");
    }
  }
  const brief = await generatePosterBrief({
    apiKey,
    model: generationSettings.textModel,
    brand,
    posterType,
    typeReference,
    date: resolvedDate,
    contextJsonUrl,
    promptSettings,
    suppliedContent,
    reviewScreenshot,
    reviewMessage,
    referencePoster,
    referenceMessage,
  });
  const resolvedBrief: Record<string, unknown> = {
    ...brief.brief,
    contentSource:
      sheetLookup?.source ??
      (posterType === "reference"
        ? referenceMessage
          ? "user_message"
          : "reference_poster"
        : "ai_generated"),
    ...(sheetLookup ? { contentSourceReason: sheetLookup.reason } : {}),
    ...(sheetLookup?.warning
      ? { contentSourceWarning: sheetLookup.warning }
      : {}),
    ...(suppliedContent ? { sourceRow: suppliedContent } : {}),
    ...(reviewScreenshotUrl ? { reviewScreenshotUrl } : {}),
    ...(reviewMessage ? { suppliedReviewMessage: reviewMessage } : {}),
    ...(referenceMessage ? { suppliedReferenceMessage: referenceMessage } : {}),
  };
  const imagePrompt = buildImagePrompt({
    brand,
    posterType,
    typeReference,
    date: resolvedDate,
    brief: resolvedBrief,
    contextUrl,
    runId: new Date().toISOString().replaceAll(/\D/g, "").slice(0, 17),
    settings: generationSettings,
    promptSettings,
  });
  const savedGeneratedPoster = await store.upsertGeneratedPoster({
    businessSlug,
    posterType,
    date: resolvedDate,
    status: "pending",
    contextUrl,
    contextJsonUrl,
    angle: String(resolvedBrief.angle ?? ""),
    briefJson: JSON.stringify(resolvedBrief),
    prompt: imagePrompt,
    imageUrl: null,
    imageContentType: null,
    r2Key: null,
    geminiTextModel: generationSettings.textModel,
    geminiImageModel: generationSettings.imageModel,
    imageResolution: generationSettings.imageResolution,
    aspectRatio: generationSettings.aspectRatio,
    geminiJobName: null,
    briefUsage: brief.usage,
    imageUsage: null,
    costBreakdown: null,
    validationErrors: [],
    failureReason: null,
  });
  return c.json({
    success: true,
    date: resolvedDate,
    posterType,
    contextJsonUrl,
    generationSettings,
    dailyBriefPrompt: brief.prompt,
    dailyBrief: resolvedBrief,
    contentSource: resolvedBrief.contentSource,
    contentSourceReason: resolvedBrief.contentSourceReason,
    contentSourceWarning: resolvedBrief.contentSourceWarning,
    rawText: brief.rawText,
    imagePrompt,
    generatedPoster: savedGeneratedPoster,
  });
});

app.post("/admin/:businessSlug/generation-lab/image", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return jsonError(c, 403, "Admin session required.");
  }
  const form = await c.req.formData();
  const posterType = formString(form, "posterType");
  const date = formString(form, "date");
  const prompt = formString(form, "prompt");
  const briefJson = formString(form, "briefJson");
  if (!isPosterType(posterType)) {
    return jsonError(c, 400, "Invalid poster type.");
  }
  if (!prompt) {
    return jsonError(c, 400, "Prompt is required before generating the image.");
  }
  const parsedBrief = parseJsonText(briefJson);
  if (!parsedBrief.ok) {
    return jsonError(c, 400, parsedBrief.error);
  }
  try {
    const generatedPoster = await generatePosterImageFromPrompt({
      env: c.env,
      store: storeFor(c.env),
      businessSlug,
      posterType,
      dateOrToday: date,
      requestUrl: c.req.url,
      prompt,
      brief: parsedBrief.value,
    });
    return c.json({ success: true, generatedPoster });
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Image generation failed.",
    );
  }
});

app.post("/admin/:businessSlug/generated-reference", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const form = await c.req.formData();
  const posterType = formString(form, "posterType");
  const date = formString(form, "date");
  const imageUrl = formString(form, "imageUrl");
  if (!isPosterType(posterType)) {
    return adminRedirect(c, businessSlug, {
      error: "Invalid poster type.",
    });
  }
  if (!imageUrl) {
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      error: "Generated image URL is required.",
    });
  }
  const store = storeFor(c.env);
  const existingReference = await store.getTypeReference(
    businessSlug,
    posterType,
  );
  const referenceImageUrls = [...(existingReference?.referenceImageUrls ?? [])];
  if (!referenceImageUrls.includes(imageUrl)) {
    if (referenceImageUrls.length >= 14) {
      return adminRedirect(c, businessSlug, {
        posterType,
        date,
        error: "A poster type can store at most 14 reference images.",
      });
    }
    referenceImageUrls.push(imageUrl);
  }
  await store.upsertTypeReference({
    businessSlug,
    posterType,
    productionReferenceImageUrl:
      existingReference?.productionReferenceImageUrl ??
      referenceImageUrls[0] ??
      null,
    referenceImageUrls,
    notes: existingReference?.notes ?? null,
  });
  return adminRedirect(c, businessSlug, {
    posterType,
    date,
    message: "Generated image added to permanent references.",
  });
});

app.post("/admin/:businessSlug/packet", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!(await hasAdminAccess(c, businessSlug))) {
    return c.html(
      renderErrorPage(403, "Forbidden", "Admin session required."),
      403,
    );
  }
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return c.html(
      renderErrorPage(404, "Not found", "Business not found."),
      404,
    );
  }

  let posterType = "awareness";
  let date = todayInTimezone(c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE);
  try {
    const form = await c.req.formData();
    posterType = formString(form, "posterType");
    date = formString(form, "date");
    if (!isPosterType(posterType) || !resolveDate(date, DEFAULT_TIMEZONE)) {
      return adminRedirect(c, businessSlug, {
        error: "Invalid poster type or date.",
      });
    }
    const existing = await store.getPacket(businessSlug, posterType, date);
    const packetInput = {
      status: formString(form, "status"),
      headline: formString(form, "headline"),
      subheadline: formString(form, "subheadline") || null,
      cta: formString(form, "cta") || null,
      offer: formString(form, "offer") || null,
      campaignGoal: formString(form, "campaignGoal") || null,
      targetAudience: formString(form, "targetAudience") || null,
      requiredText: formLines(form, "requiredText"),
      productionReferenceImageUrl:
        formString(form, "productionReferenceImageUrl") || null,
      additionalReferenceImages: formLines(form, "additionalReferenceImages"),
      specialInstructions: formLines(form, "specialInstructions"),
      chatgptImagePrompt: formString(form, "chatgptImagePrompt") || undefined,
    };
    const preliminary = validatePacket(
      packetInput,
      { businessSlug, posterType, date },
      brand,
      existing,
      { requireProductionReference: false },
    );
    if (!preliminary.value) {
      return adminRedirect(c, businessSlug, {
        posterType,
        date,
        error: preliminary.errors.join(" "),
      });
    }
    const validated = validatePacket(
      packetInput,
      { businessSlug, posterType, date },
      brand,
      existing,
      { requireProductionReference: false },
    );
    if (!validated.value) {
      return adminRedirect(c, businessSlug, {
        posterType,
        date,
        error: validated.errors.join(" "),
      });
    }
    await store.upsertPacket(validated.value);
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      message: "Daily poster packet saved successfully.",
    });
  } catch (error) {
    return adminRedirect(c, businessSlug, {
      posterType,
      date,
      error: error instanceof Error ? error.message : "Packet update failed.",
    });
  }
});

app.get("/assets/:key{.+}", async (c) => {
  const key = c.req.path.replace(/^\/assets\//, "");
  if (!key || !c.env.ASSETS) {
    return c.text("Asset not found.", 404);
  }
  const object = await c.env.ASSETS.get(key);
  if (!object) return c.text("Asset not found.", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get("content-type")) {
    headers.set("content-type", imageContentTypeForKey(key));
  }
  headers.set("etag", object.httpEtag);
  headers.set(
    "cache-control",
    headers.get("cache-control") || "public, max-age=31536000, immutable",
  );
  return new Response(object.body, { headers });
});

app.get("/robots.txt", (c) =>
  c.text(
    [
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: OAI-SearchBot",
      "Allow: /",
      "",
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-agent: *",
      "Allow: /",
      "",
    ].join("\n"),
    200,
    {
      "Content-Type": "text/plain; charset=utf-8",
    },
  ),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "daily-poster-packet",
    openaiApiUsed: false,
  }),
);

async function loadPublicContext(
  businessSlug: string,
  posterTypeValue: string,
  dateOrToday: string,
  env: Bindings,
): Promise<
  | {
      brand: Awaited<ReturnType<PosterStore["getBrand"]>> & {};
      posterType: Parameters<PosterStore["getTypeReference"]>[1];
      typeReference: Awaited<ReturnType<PosterStore["getTypeReference"]>>;
      generationSettings: GenerationSettings;
      promptSettings: ReturnType<typeof defaultPromptSettings>;
      resolvedDate: string;
    }
  | { error: string; status: 400 | 404 }
> {
  if (!isValidSlug(businessSlug)) {
    return { error: "Invalid business slug.", status: 400 as const };
  }
  if (!isPosterType(posterTypeValue)) {
    return { error: "Unsupported poster type.", status: 400 as const };
  }
  const timezone = env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
  const resolvedDate = resolveDate(dateOrToday, timezone);
  if (!resolvedDate) {
    return {
      error: "Date must be today or a valid YYYY-MM-DD date.",
      status: 400 as const,
    };
  }
  const store = storeFor(env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return { error: "Business brand system not found.", status: 404 as const };
  }
  const [typeReference, savedGenerationSettings, savedPromptSettings] =
    await Promise.all([
      store.getTypeReference(businessSlug, posterTypeValue),
      store.getGenerationSettings(businessSlug),
      store.getPromptSettings(businessSlug),
    ]);
  return {
    brand,
    posterType: posterTypeValue,
    typeReference,
    generationSettings:
      savedGenerationSettings ?? defaultGenerationSettings(businessSlug, env),
    promptSettings: normalizePromptSettings(
      savedPromptSettings ?? defaultPromptSettings(businessSlug),
    ),
    resolvedDate,
  };
}

app.get("/daily-poster/:businessSlug/:posterType/:dateOrToday", async (c) => {
  const rawDate = c.req.param("dateOrToday");
  const wantsJson = rawDate.endsWith(".json");
  const dateOrToday = wantsJson ? rawDate.slice(0, -5) : rawDate;
  const result = await loadPublicContext(
    c.req.param("businessSlug"),
    c.req.param("posterType"),
    dateOrToday,
    c.env,
  );
  if ("error" in result) {
    if (wantsJson) return jsonError(c, result.status, result.error);
    return c.html(
      renderErrorPage(
        result.status,
        "Poster context unavailable",
        result.error,
      ),
      result.status,
    );
  }

  const base = baseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
  const explicitPath = `/daily-poster/${result.brand.businessSlug}/${result.posterType}/today`;
  const publicPageUrl = `${base}${explicitPath}`;
  const jsonUrl = `${publicPageUrl}.json`;
  c.header("X-Robots-Tag", "noindex");
  c.header("Cache-Control", "public, max-age=300");
  if (wantsJson) {
    const posterReferenceImageUrls = result.typeReference?.referenceImageUrls
      .length
      ? result.typeReference.referenceImageUrls
      : result.typeReference?.productionReferenceImageUrl
        ? [result.typeReference.productionReferenceImageUrl]
        : [];
    return c.json({
      business: {
        businessSlug: result.brand.businessSlug,
        businessName: result.brand.businessName,
        phone: result.brand.phone,
        websiteUrl: result.brand.websiteUrl,
        logoUrl: result.brand.logoUrl,
        brandReferenceBoardUrl: result.brand.brandReferenceBoardUrl,
      },
      posterType: result.posterType,
      resolvedDate: result.resolvedDate,
      publicPageUrl,
      jsonUrl,
      generationSettings: result.generationSettings,
      posterReferenceImageUrls,
    });
  }
  const logoBase64 = await imageUrlToBase64({
    url: result.brand.logoUrl,
    env: c.env,
    publicBaseUrl: base,
  });
  const brandReferenceBoardBase64 = await imageUrlToBase64({
    url: result.brand.brandReferenceBoardUrl,
    env: c.env,
    publicBaseUrl: base,
  });
  const posterReferenceUrls = result.typeReference?.referenceImageUrls.length
    ? result.typeReference.referenceImageUrls
    : result.typeReference?.productionReferenceImageUrl
      ? [result.typeReference.productionReferenceImageUrl]
      : [];
  const posterReferencesBase64 = await Promise.all(
    posterReferenceUrls.map((url) =>
      imageUrlToBase64({
        url,
        env: c.env,
        publicBaseUrl: base,
      }),
    ),
  );
  return c.html(
    renderPosterPage({
      brand: result.brand,
      posterType: result.posterType,
      typeReference: result.typeReference,
      publicPageUrl,
      jsonUrl,
      imageBase64: {
        logo: logoBase64,
        brandReferenceBoard: brandReferenceBoardBase64,
        posterReferences: posterReferencesBase64,
      },
    }),
  );
});

app.put("/api/business/:businessSlug/brand-system", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  if (!isValidSlug(businessSlug)) {
    return jsonError(c, 400, "Invalid business slug.", [
      "Use lowercase letters, numbers, and single hyphens only.",
    ]);
  }
  const body = await readJson(c.req.raw);
  if (!body.ok) return jsonError(c, 400, body.error);

  const store = storeFor(c.env);
  const existing = await store.getBrand(businessSlug);
  const validated = validateBrand(body.value, businessSlug, existing);
  if (!validated.value) {
    return jsonError(
      c,
      400,
      "Brand system validation failed.",
      validated.errors,
    );
  }

  const brand = await store.upsertBrand(validated.value);
  return c.json({ success: true, businessBrandSystem: brand });
});

app.put("/api/daily-poster/:businessSlug/:posterType/:date", async (c) => {
  const businessSlug = c.req.param("businessSlug");
  const posterTypeValue = c.req.param("posterType");
  const date = c.req.param("date");
  if (!isValidSlug(businessSlug)) {
    return jsonError(c, 400, "Invalid business slug.");
  }
  if (!isPosterType(posterTypeValue)) {
    return jsonError(c, 400, "Unsupported poster type.");
  }
  const resolvedDate = resolveDate(
    date,
    c.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE,
  );
  if (!resolvedDate) {
    return jsonError(c, 400, "Date must be today or a valid YYYY-MM-DD date.");
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return jsonError(c, 400, body.error);
  const store = storeFor(c.env);
  const brand = await store.getBrand(businessSlug);
  if (!brand) {
    return jsonError(
      c,
      404,
      "Business does not exist. Create its brand system first.",
    );
  }
  const existing = await store.getPacket(
    businessSlug,
    posterTypeValue,
    resolvedDate,
  );
  const typeReference = await store.getTypeReference(
    businessSlug,
    posterTypeValue,
  );
  const validated = validatePacket(
    body.value,
    { businessSlug, posterType: posterTypeValue, date: resolvedDate },
    brand,
    existing,
    {
      requireProductionReference: !typeReference?.productionReferenceImageUrl,
    },
  );
  if (!validated.value) {
    return jsonError(
      c,
      400,
      "Daily poster packet validation failed.",
      validated.errors,
    );
  }

  await store.upsertPacket(validated.value);
  const base = baseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
  const path = `/daily-poster/${businessSlug}/${posterTypeValue}/${resolvedDate}`;
  return c.json({
    success: true,
    publicUrl: `${base}${path}`,
    jsonUrl: `${base}${path}.json`,
  });
});

app.get(
  "/api/generated-poster/:businessSlug/:posterType/:dateOrToday",
  async (c) => {
    const result = await loadPublicContext(
      c.req.param("businessSlug"),
      c.req.param("posterType"),
      c.req.param("dateOrToday"),
      c.env,
    );
    if ("error" in result) {
      return jsonError(c, result.status, result.error);
    }
    const generated = await storeFor(c.env).getGeneratedPoster(
      result.brand.businessSlug,
      result.posterType,
      result.resolvedDate,
    );
    if (!generated) return jsonError(c, 404, "Generated poster not found.");
    return c.json({ success: true, generatedPoster: generated });
  },
);

app.post(
  "/api/daily-brief/:businessSlug/:posterType/:dateOrToday",
  async (c) => {
    const result = await loadPublicContext(
      c.req.param("businessSlug"),
      c.req.param("posterType"),
      c.req.param("dateOrToday"),
      c.env,
    );
    if ("error" in result) {
      return jsonError(c, result.status, result.error);
    }
    const apiKey = c.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return jsonError(c, 500, "GEMINI_API_KEY is not configured.");
    }
    if (
      result.posterType === "reference" &&
      !result.typeReference?.referenceImageUrls.length &&
      !result.typeReference?.productionReferenceImageUrl
    ) {
      return jsonError(
        c,
        400,
        "Upload at least one source poster before preparing a Reference remake.",
      );
    }

    const base = baseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
    const contextUrl = `${base}/daily-poster/${result.brand.businessSlug}/${result.posterType}/today`;
    const contextJsonUrl = `${contextUrl}.json`;
    const generationSettings =
      result.generationSettings ??
      defaultGenerationSettings(result.brand.businessSlug, c.env);
    const model = generationSettings.textModel;
    const store = storeFor(c.env);
    const sourceSettings =
      (await store.getContentSourceSettings(result.brand.businessSlug)) ??
      defaultContentSourceSettings(result.brand.businessSlug);
    const sheetLookup =
      result.posterType === "awareness"
        ? await resolveAwarenessContent(sourceSettings, result.resolvedDate)
        : null;
    const suppliedContent = sheetLookup?.row ?? null;
    const referencePosterUrl =
      result.posterType === "reference"
        ? (result.typeReference?.referenceImageUrls[0] ??
          result.typeReference?.productionReferenceImageUrl ??
          null)
        : null;
    const referencePoster = await imageUrlToBase64({
      url: referencePosterUrl,
      env: c.env,
      publicBaseUrl: base,
    });
    if (result.posterType === "reference" && !referencePoster) {
      return jsonError(c, 400, "The saved source poster could not be loaded.");
    }
    const brief = await generatePosterBrief({
      apiKey,
      model,
      brand: result.brand,
      posterType: result.posterType,
      typeReference: result.typeReference,
      date: result.resolvedDate,
      contextJsonUrl,
      promptSettings: result.promptSettings,
      suppliedContent,
      referencePoster,
    });
    const resolvedBrief: Record<string, unknown> = {
      ...brief.brief,
      contentSource:
        sheetLookup?.source ??
        (result.posterType === "reference"
          ? "reference_poster"
          : "ai_generated"),
      ...(sheetLookup ? { contentSourceReason: sheetLookup.reason } : {}),
      ...(sheetLookup?.warning
        ? { contentSourceWarning: sheetLookup.warning }
        : {}),
      ...(suppliedContent ? { sourceRow: suppliedContent } : {}),
    };

    return c.json({
      success: true,
      model,
      businessSlug: result.brand.businessSlug,
      posterType: result.posterType,
      date: result.resolvedDate,
      contextJsonUrl,
      dailyBriefPrompt: brief.prompt,
      dailyBrief: resolvedBrief,
      contentSource: resolvedBrief.contentSource,
      contentSourceReason: resolvedBrief.contentSourceReason,
      contentSourceWarning: resolvedBrief.contentSourceWarning,
      rawText: brief.rawText,
      imagePrompt: buildImagePrompt({
        brand: result.brand,
        posterType: result.posterType,
        typeReference: result.typeReference,
        date: result.resolvedDate,
        brief: resolvedBrief,
        contextUrl,
        runId: new Date().toISOString().replaceAll(/\D/g, "").slice(0, 17),
        settings: generationSettings,
        promptSettings: result.promptSettings,
      }),
    });
  },
);

app.post(
  "/api/orchestrate/:businessSlug/:posterType/:dateOrToday",
  async (c) => {
    const result = await loadPublicContext(
      c.req.param("businessSlug"),
      c.req.param("posterType"),
      c.req.param("dateOrToday"),
      c.env,
    );
    if ("error" in result) {
      return jsonError(c, result.status, result.error);
    }
    const force = c.req.query("force") === "true";
    const generatedPoster = await runPosterOrchestrator({
      env: c.env,
      store: storeFor(c.env),
      businessSlug: result.brand.businessSlug,
      posterType: result.posterType,
      dateOrToday: result.resolvedDate,
      requestUrl: c.req.url,
      force,
    });
    return c.json({
      success:
        generatedPoster.status === "ready" ||
        generatedPoster.status === "needs_review",
      generatedPoster,
    });
  },
);

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return jsonError(c, 404, "Route not found.");
  }
  return c.html(
    renderErrorPage(404, "Not found", "This route does not exist."),
    404,
  );
});

app.onError((error, c) => {
  console.error(error);
  if (c.req.path.startsWith("/api/")) {
    return jsonError(c, 500, "Internal server error.");
  }
  return c.html(
    renderErrorPage(
      500,
      "Internal server error",
      "The poster packet could not be loaded.",
    ),
    500,
  );
});

async function scheduled(
  _event: ScheduledEvent,
  env: Bindings,
  ctx: ExecutionContext,
) {
  const target = defaultScheduledTarget(env);
  const task = runAutomationHeartbeat({
    env,
    store: storeFor(env),
    businessSlug: target.businessSlug,
    requestUrl: `${baseUrl("https://worker.local", env.PUBLIC_BASE_URL)}/__scheduled`,
  }).then((runs) => {
    for (const run of runs) {
      if (run.status !== "ready" || run.deliveryStatus === "failed") {
        console.error("Scheduled poster automation needs attention", run);
      }
    }
  });
  ctx.waitUntil(task);
}

export default {
  fetch: app.fetch,
  request: app.request.bind(app),
  scheduled,
};
