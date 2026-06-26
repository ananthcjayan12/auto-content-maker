import { imageContentTypeForKey } from "./assets";
import {
  defaultContentSourceSettings,
  resolveAwarenessContent,
} from "./content-sources";
import { DEFAULT_TIMEZONE, resolveDate, todayInTimezone } from "./date";
import { estimateGenerationCost, usageFromResponse } from "./gemini-pricing";
import {
  DEFAULT_GENERATION_SETTINGS,
  IMAGE_MODEL_CAPABILITIES,
  isImageModel,
  isImageResolution,
  isTextModel,
  normalizeGenerationSettings,
} from "./gemini-models";
import {
  defaultPromptSettings,
  fillPromptTemplate,
  normalizePromptSettings,
  promptVariables,
  REFERENCE_REMAKE_IMAGE_OVERRIDE,
} from "./prompt-settings";
import type {
  Bindings,
  BusinessBrandSystem,
  ContentCalendarEntry,
  GeminiUsage,
  GenerationSettings,
  GeneratedPoster,
  ImageModelId,
  ImageResolution,
  LanguageTypographyProfile,
  PosterStore,
  PosterPromptSettings,
  PosterType,
  PosterTypeReference,
} from "./types";

export interface ImageBase64Reference {
  url: string;
  contentType: string;
  byteLength: number;
  base64: string;
}

interface PosterLanguageTarget {
  languageCode: string;
  languageName: string;
  profile: LanguageTypographyProfile;
}

const LANGUAGE_CODE_OVERRIDES: Record<string, string> = {
  english: "en",
  malayalam: "ml",
  hindi: "hi",
  tamil: "ta",
  arabic: "ar",
  kannada: "kn",
  telugu: "te",
  bengali: "bn",
  marathi: "mr",
  gujarati: "gu",
  punjabi: "pa",
};

function languageCodeFor(language: string): string {
  const normalized = language.trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (LANGUAGE_CODE_OVERRIDES[normalized] ?? slug) || "lang";
}

function enabledPosterLanguages(
  brand: BusinessBrandSystem,
): PosterLanguageTarget[] {
  const settings = brand.languageTypography;
  if (!settings?.enabled) {
    return [
      {
        languageCode: "en",
        languageName: "English",
        profile: {
          language: "English",
          role: "primary",
          referenceImageUrl: null,
          styleProfile: null,
          enabled: true,
        },
      },
    ];
  }
  const profiles = settings.profiles?.length
    ? settings.profiles
    : [
        {
          language: settings.primaryLanguage,
          role: "primary" as const,
          referenceImageUrl: settings.typographyReferenceImageUrl,
          styleProfile: settings.typographyStyleProfile,
          enabled: true,
        },
        ...settings.additionalLanguages.map((language) => ({
          language,
          role: "secondary" as const,
          referenceImageUrl: settings.typographyReferenceImageUrl,
          styleProfile: settings.typographyStyleProfile,
          enabled: true,
        })),
      ];
  const seen = new Set<string>();
  return profiles
    .filter((profile) => profile.enabled !== false && profile.language.trim())
    .map((profile) => ({
      languageCode: languageCodeFor(profile.language),
      languageName: profile.language.trim(),
      profile,
    }))
    .filter((target) => {
      if (seen.has(target.languageCode)) return false;
      seen.add(target.languageCode);
      return true;
    });
}

function brandForLanguage(
  brand: BusinessBrandSystem,
  target: PosterLanguageTarget,
): BusinessBrandSystem {
  return {
    ...brand,
    languageTypography: {
      enabled: true,
      primaryLanguage: target.languageName,
      additionalLanguages: [],
      typographyReferenceImageUrl: target.profile.referenceImageUrl,
      typographyStyleProfile: target.profile.styleProfile,
      useReferenceForAllPosters:
        brand.languageTypography?.useReferenceForAllPosters ?? true,
      profiles: [
        {
          ...target.profile,
          language: target.languageName,
          role: "primary",
          enabled: true,
        },
      ],
    },
  };
}

interface LabeledImageReference extends ImageBase64Reference {
  label: string;
  guidance: string;
}

function hasSourcePoster(reference: PosterTypeReference | null): boolean {
  return Boolean(
    reference?.referenceImageUrls.length ||
    reference?.productionReferenceImageUrl,
  );
}

export function baseUrl(requestUrl: string, configured?: string): string {
  const candidate = configured?.trim();
  if (candidate) return candidate.replace(/\/+$/, "");
  return new URL(requestUrl).origin;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function isSupportedReferenceImage(contentType: string): boolean {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return (
    normalized === "image/png" ||
    normalized === "image/jpeg" ||
    normalized === "image/webp" ||
    normalized === "image/gif"
  );
}

export async function imageUrlToBase64(input: {
  url: string | null;
  env: Bindings;
  publicBaseUrl: string;
}): Promise<ImageBase64Reference | null> {
  const { url, env, publicBaseUrl } = input;
  if (!url) return null;

  try {
    const parsed = new URL(url, `${publicBaseUrl}/`);
    const publicOrigin = new URL(publicBaseUrl).origin;
    if (
      parsed.origin === publicOrigin &&
      parsed.pathname.startsWith("/assets/")
    ) {
      if (!env.ASSETS) return null;
      const key = decodeURIComponent(
        parsed.pathname.replace(/^\/assets\//, ""),
      );
      const object = await env.ASSETS.get(key);
      if (!object) return null;
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      const contentType =
        headers.get("content-type") || imageContentTypeForKey(key);
      if (!isSupportedReferenceImage(contentType)) return null;
      const buffer = await object.arrayBuffer();
      return {
        url: parsed.toString(),
        contentType,
        byteLength: buffer.byteLength,
        base64: arrayBufferToBase64(buffer),
      };
    }

    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "daily-poster-orchestrator/1.0" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) return null;
    if (!isSupportedReferenceImage(contentType)) return null;
    const buffer = await response.arrayBuffer();
    return {
      url: parsed.toString(),
      contentType: contentType.split(";")[0] || "application/octet-stream",
      byteLength: buffer.byteLength,
      base64: arrayBufferToBase64(buffer),
    };
  } catch {
    return null;
  }
}

function geminiEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

function geminiImageEndpoint(model: ImageModelId): string {
  return `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`;
}

async function callGemini(input: {
  apiKey: string;
  model: string;
  body: unknown;
}): Promise<Record<string, unknown>> {
  const response = await fetch(geminiEndpoint(input.model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify(input.body),
  });
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error &&
      "message" in payload.error
        ? String(payload.error.message)
        : `Gemini request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as Record<string, unknown>;
}

async function callGeminiImageInteraction(input: {
  apiKey: string;
  model: ImageModelId;
  resolution: ImageResolution;
  aspectRatio: "9:16";
  prompt: string;
  references: LabeledImageReference[];
}): Promise<Record<string, unknown>> {
  const parts = [
    { text: input.prompt },
    ...input.references.flatMap((reference) => [
      {
        text: `REFERENCE IMAGE: ${reference.label}. ${reference.guidance}`,
      },
      {
        inline_data: {
          data: reference.base64,
          mime_type: reference.contentType,
        },
      },
    ]),
  ];

  const response = await fetch(geminiImageEndpoint(input.model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
    }),
  });
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error &&
      "message" in payload.error
        ? String(payload.error.message)
        : `Gemini image request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as Record<string, unknown>;
}

export function imageGenerationConfig(
  model: ImageModelId,
  resolution: ImageResolution,
  aspectRatio: "9:16",
): {
  imageConfig: Record<string, string>;
} {
  const capability = IMAGE_MODEL_CAPABILITIES[model];
  const imageConfig: Record<string, string> = { aspectRatio };
  if (capability.configurableResolution) {
    imageConfig.imageSize = capability.resolutions.includes(resolution)
      ? resolution
      : capability.defaultResolution;
  }
  return {
    imageConfig,
  };
}

function generationSettingsFor(
  businessSlug: string,
  env: Bindings,
  saved: GenerationSettings | null,
): GenerationSettings {
  if (saved) return normalizeGenerationSettings(saved);
  const textModel =
    env.GEMINI_TEXT_MODEL && isTextModel(env.GEMINI_TEXT_MODEL)
      ? env.GEMINI_TEXT_MODEL
      : DEFAULT_GENERATION_SETTINGS.textModel;
  const imageModel =
    env.GEMINI_IMAGE_MODEL && isImageModel(env.GEMINI_IMAGE_MODEL)
      ? env.GEMINI_IMAGE_MODEL
      : DEFAULT_GENERATION_SETTINGS.imageModel;
  const requestedResolution =
    env.GEMINI_IMAGE_RESOLUTION &&
    isImageResolution(env.GEMINI_IMAGE_RESOLUTION)
      ? env.GEMINI_IMAGE_RESOLUTION
      : DEFAULT_GENERATION_SETTINGS.imageResolution;
  return normalizeGenerationSettings({
    businessSlug,
    textModel,
    imageModel,
    imageResolution: requestedResolution,
    aspectRatio: "9:16",
  });
}

function textParts(response: Record<string, unknown>): string[] {
  const candidates = Array.isArray(response.candidates)
    ? response.candidates
    : [];
  return candidates.flatMap((candidate) => {
    const content =
      typeof candidate === "object" && candidate && "content" in candidate
        ? candidate.content
        : null;
    const parts =
      typeof content === "object" &&
      content &&
      "parts" in content &&
      Array.isArray(content.parts)
        ? content.parts
        : [];
    return parts
      .map((part: unknown) =>
        typeof part === "object" &&
        part &&
        "text" in part &&
        typeof part.text === "string"
          ? part.text
          : "",
      )
      .filter(Boolean);
  });
}

function imagePart(
  response: Record<string, unknown>,
): { mimeType: string; data: string } | null {
  function imageFromValue(
    value: unknown,
  ): { mimeType: string; data: string } | null {
    if (
      typeof value === "object" &&
      value &&
      "type" in value &&
      value.type === "image" &&
      "data" in value &&
      typeof value.data === "string"
    ) {
      return {
        mimeType:
          "mime_type" in value && typeof value.mime_type === "string"
            ? value.mime_type
            : "mimeType" in value && typeof value.mimeType === "string"
              ? value.mimeType
              : "image/jpeg",
        data: value.data,
      };
    }
    return null;
  }

  if (
    "output_image" in response &&
    typeof response.output_image === "object" &&
    response.output_image &&
    "data" in response.output_image &&
    typeof response.output_image.data === "string"
  ) {
    return {
      mimeType:
        "mime_type" in response.output_image &&
        typeof response.output_image.mime_type === "string"
          ? response.output_image.mime_type
          : "image/png",
      data: response.output_image.data,
    };
  }

  const outputs = Array.isArray(response.outputs) ? response.outputs : [];
  for (const output of outputs) {
    const image = imageFromValue(output);
    if (image) return image;
  }

  const steps = Array.isArray(response.steps) ? response.steps : [];
  for (const step of steps) {
    if (
      typeof step === "object" &&
      step &&
      "content" in step &&
      Array.isArray(step.content)
    ) {
      for (const content of step.content) {
        const image = imageFromValue(content);
        if (image) return image;
      }
    }
  }

  const candidates = Array.isArray(response.candidates)
    ? response.candidates
    : [];
  for (const candidate of candidates) {
    const content =
      typeof candidate === "object" && candidate && "content" in candidate
        ? candidate.content
        : null;
    const parts =
      typeof content === "object" &&
      content &&
      "parts" in content &&
      Array.isArray(content.parts)
        ? content.parts
        : [];
    for (const part of parts) {
      if (
        typeof part === "object" &&
        part &&
        "inlineData" in part &&
        typeof part.inlineData === "object" &&
        part.inlineData &&
        "data" in part.inlineData &&
        typeof part.inlineData.data === "string"
      ) {
        return {
          mimeType:
            "mimeType" in part.inlineData &&
            typeof part.inlineData.mimeType === "string"
              ? part.inlineData.mimeType
              : "image/png",
          data: part.inlineData.data,
        };
      }
    }
  }
  return null;
}

function jsonFromModelText(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return { angle: text.trim() };
  }
}

function buildBriefPrompt(input: {
  brand: BusinessBrandSystem;
  posterType: PosterType;
  typeReference: PosterTypeReference | null;
  date: string;
  contextJsonUrl: string;
  promptSettings: PosterPromptSettings;
  suppliedContent?: Record<string, string> | null;
  hasReviewScreenshot?: boolean;
  reviewMessage?: string | null;
  referenceMessage?: string | null;
  hasReferencePoster?: boolean;
}): string {
  const { brand, posterType, typeReference, date, promptSettings } = input;
  const posterTypePrompt = promptSettings.posterTypePrompts[posterType];
  const basePrompt = fillPromptTemplate(
    promptSettings.contentPromptTemplate,
    promptVariables({
      brand,
      posterType,
      date,
      referenceNotes: typeReference?.notes,
      posterTypePrompt,
    }),
  );
  const sourceInstruction = input.suppliedContent
    ? `\n\nSUPPLIED CONTENT FOR THIS DATE\n${JSON.stringify(input.suppliedContent, null, 2)}\nEdit this copy for clarity and mobile readability while preserving every fact and meaning. Do not replace it with a different topic.`
    : "";
  const reviewInstruction = input.hasReviewScreenshot
    ? "\n\nA customer review screenshot is attached. Do not extract, transcribe, paraphrase, or repeat its review text in the JSON. The screenshot itself will be used as the visible testimonial. Keep reviewQuote and reviewAttribution empty. Generate one short, warm, original social-proof headline for the clinic outside the screenshot, plus an optional concise CTA. Creative directions include “A new review,” “Another happy smile,” “Kind words from our patient,” “Another reason to smile,” and “Your trust makes us smile”; vary the wording naturally and do not invent counts, outcomes, or medical results."
    : input.reviewMessage
      ? `\n\nSUPPLIED CUSTOMER REVIEW MESSAGE\n${input.reviewMessage}\nUse this exact customer-supplied review as the factual source. You may shorten it only for mobile readability without changing its meaning. Do not invent a rating, name, treatment, or result.`
      : "";
  const referenceInstruction = input.referenceMessage
    ? `\n\nUSER'S POSTER MESSAGE — PRIMARY CONTENT SOURCE\n${input.referenceMessage}\nBase the poster content on this message. Preserve its subject, intent, and every supplied fact. You may polish and shorten it for a mobile poster, but do not replace it with an AI-chosen topic and do not add prices, offers, claims, dates, services, or outcomes that the user did not provide. The attached source poster controls visual design only.`
    : input.hasReferencePoster
      ? `\n\nSOURCE POSTER CONTENT FALLBACK\nA source poster is attached. Identify only its broad communication idea or poster purpose, then adapt that idea into safe dental-clinic copy for ${brand.businessName}. Do not copy exact wording, competitor identity, contact details, prices, offers, dates, claims, credentials, people, products, or unsupported treatment outcomes. Keep the result relevant to a dental clinic and concise enough for a mobile poster.`
      : "";
  const languageTypography = brand.languageTypography;
  const additionalLanguages = Array.isArray(
    languageTypography?.additionalLanguages,
  )
    ? languageTypography.additionalLanguages
    : [];
  const enabledProfiles = (languageTypography?.profiles ?? []).filter(
    (profile) => profile.enabled !== false,
  );
  const primaryProfile =
    enabledProfiles.find((profile) => profile.role === "primary") ??
    enabledProfiles[0] ??
    null;
  const languageInstruction = languageTypography?.enabled
    ? `\n\nLANGUAGE LOCALIZATION\nWrite the visible poster copy for the primary poster language: ${primaryProfile?.language || languageTypography.primaryLanguage || "English"}. ${
        additionalLanguages.length
          ? `Keep these future language variants in mind for short, translatable phrasing: ${additionalLanguages.join(", ")}.`
          : ""
      } Use natural local phrasing, not literal translation. Keep headline, subheadline, and CTA short enough for a mobile poster.`
    : "";
  return (
    basePrompt +
    sourceInstruction +
    reviewInstruction +
    referenceInstruction +
    languageInstruction
  );
}

export async function generatePosterBrief(input: {
  apiKey: string;
  model: string;
  brand: BusinessBrandSystem;
  posterType: PosterType;
  typeReference: PosterTypeReference | null;
  date: string;
  contextJsonUrl: string;
  promptSettings: PosterPromptSettings;
  suppliedContent?: Record<string, string> | null;
  reviewScreenshot?: ImageBase64Reference | null;
  reviewMessage?: string | null;
  referencePoster?: ImageBase64Reference | null;
  referenceMessage?: string | null;
}): Promise<{
  prompt: string;
  brief: Record<string, unknown>;
  rawText: string;
  usage: GeminiUsage;
}> {
  const prompt = buildBriefPrompt({
    brand: input.brand,
    posterType: input.posterType,
    typeReference: input.typeReference,
    date: input.date,
    contextJsonUrl: input.contextJsonUrl,
    promptSettings: input.promptSettings,
    suppliedContent: input.suppliedContent,
    hasReviewScreenshot: Boolean(input.reviewScreenshot),
    reviewMessage: input.reviewMessage,
    referenceMessage: input.referenceMessage,
    hasReferencePoster: Boolean(input.referencePoster),
  });
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (input.reviewScreenshot) {
    parts.push({
      inline_data: {
        data: input.reviewScreenshot.base64,
        mime_type: input.reviewScreenshot.contentType,
      },
    });
  }
  if (input.referencePoster) {
    parts.push({
      inline_data: {
        data: input.referencePoster.base64,
        mime_type: input.referencePoster.contentType,
      },
    });
  }
  const response = await callGemini({
    apiKey: input.apiKey,
    model: input.model,
    body: {
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json" },
    },
  });
  const rawText = textParts(response).join("\n").trim();
  const parsedBrief = jsonFromModelText(rawText);
  return {
    prompt,
    brief: input.reviewScreenshot
      ? { ...parsedBrief, reviewQuote: "", reviewAttribution: "" }
      : parsedBrief,
    rawText,
    usage: usageFromResponse(response),
  };
}

export function buildImagePrompt(input: {
  brand: BusinessBrandSystem;
  posterType: PosterType;
  typeReference: PosterTypeReference | null;
  date: string;
  brief: Record<string, unknown>;
  contextUrl: string;
  runId: string;
  settings: GenerationSettings;
  promptSettings: PosterPromptSettings;
  force?: boolean;
}): string {
  const {
    brand,
    posterType,
    typeReference,
    date,
    brief,
    runId,
    settings,
    promptSettings,
  } = input;
  const variables = promptVariables({
    brand,
    posterType,
    date,
    referenceNotes: typeReference?.notes,
    posterTypePrompt: promptSettings.posterTypePrompts[posterType],
  });
  const languageTypography = brand.languageTypography;
  const additionalLanguages = Array.isArray(
    languageTypography?.additionalLanguages,
  )
    ? languageTypography.additionalLanguages
    : [];
  const enabledProfiles = (languageTypography?.profiles ?? []).filter(
    (profile) => profile.enabled !== false,
  );
  const primaryProfile =
    enabledProfiles.find((profile) => profile.role === "primary") ??
    enabledProfiles[0] ??
    null;
  const languageProfileSummary = enabledProfiles.length
    ? enabledProfiles
        .map(
          (profile) =>
            `${profile.role === "primary" ? "Primary" : "Extra"}: ${profile.language}${profile.styleProfile ? ` — ${profile.styleProfile}` : ""}${profile.referenceImageUrl ? " — reference image saved" : ""}`,
        )
        .join("\n")
    : "";
  const languageGuidance =
    languageTypography?.enabled &&
    (primaryProfile?.language ||
      languageTypography.primaryLanguage ||
      additionalLanguages.length ||
      primaryProfile?.styleProfile ||
      languageTypography.typographyStyleProfile)
      ? `LANGUAGE & TYPOGRAPHY REFERENCE — COST-CONTROLLED AI-FIRST MODE
- Primary poster language: ${primaryProfile?.language || languageTypography.primaryLanguage || "English"}.
- Extra language variants to keep in mind for this business: ${
          additionalLanguages.length
            ? additionalLanguages.join(", ")
            : "None configured"
        }.
- Saved language cards:
${languageProfileSummary || "No per-language cards saved."}
- Use the exact meaning from TODAY'S CONTENT, but localize phrasing naturally for the primary poster language. Avoid literal translation that becomes too long or awkward.
- Keep visible text short enough for a mobile social poster. Prefer fewer, stronger words over dense copy.
- Typography style profile: ${primaryProfile?.styleProfile || languageTypography.typographyStyleProfile || "Use the attached typography reference image as the lettering style guide."}
- If a typography reference image is attached, match its lettering mood closely: stroke thickness, curves, spacing, weight, headline treatment, and script-native feel.
- Do not switch to a generic font style. Do not distort glyphs. Do not invent unreadable or misspelled text.
- If the target script is regional/Indic/Arabic, render it cleanly and naturally in that script.`
      : "";
  const sections = [
    fillPromptTemplate(promptSettings.masterImagePromptTemplate, variables),
    fillPromptTemplate(promptSettings.posterTypePrompts[posterType], variables),
    languageGuidance,
    fillPromptTemplate(promptSettings.referencePromptTemplate, variables),
    ...(posterType === "reference" ? [REFERENCE_REMAKE_IMAGE_OVERRIDE] : []),
    ...(posterType === "review" && typeof brief.reviewScreenshotUrl === "string"
      ? [
          `REVIEW SCREENSHOT — PRIMARY TESTIMONIAL CONTENT
- Place the attached customer review screenshot prominently as one intact, readable rectangular image within the poster.
- Preserve the screenshot exactly as supplied. Do not redraw, recreate, transcribe, paraphrase, summarize, crop, mask, blur, stylize, recolor, or replace it.
- Do not write the review quote, patient identity, rating, attribution, date, or platform details anywhere else on the poster.
- Add one short, warm clinic-owned social-proof headline above or around the screenshot. Keep it distinct from the review text and vary it naturally between posters.
- Design the clinic-branded layout around the screenshot. The screenshot must remain legible and visually dominant.`,
        ]
      : []),
    `TODAY'S CONTENT — CHANGE ONLY THESE CONTENT AREAS\n${JSON.stringify(brief, null, 2)}`,
    `RENDER METADATA\nDate: ${date}\nGeneration run id: ${runId}\nOutput: ${settings.aspectRatio} at ${settings.imageResolution}`,
  ];
  return sections.join("\n\n");
}

async function generatePosterImage(input: {
  env: Bindings;
  store: PosterStore;
  brand: BusinessBrandSystem;
  businessSlug: string;
  posterType: PosterType;
  date: string;
  base: string;
  contextUrl: string;
  contextJsonUrl: string;
  typeReference: PosterTypeReference | null;
  generationSettings: GenerationSettings;
  prompt: string;
  brief: Record<string, unknown>;
  briefUsage: GeminiUsage | null;
  started: GeneratedPoster;
  editSourceImageUrl?: string | null;
}): Promise<GeneratedPoster> {
  const {
    env,
    store,
    brand,
    businessSlug,
    posterType,
    date,
    base,
    contextUrl,
    contextJsonUrl,
    typeReference,
    generationSettings,
    prompt,
    brief,
    briefUsage,
    started,
    editSourceImageUrl,
  } = input;
  const imageModel = generationSettings.imageModel;
  const typeReferenceUrls = typeReference?.referenceImageUrls.length
    ? typeReference.referenceImageUrls
    : typeReference?.productionReferenceImageUrl
      ? [typeReference.productionReferenceImageUrl]
      : [];
  const referenceUrls = typeReferenceUrls;
  const reviewScreenshotUrl =
    posterType === "review" && typeof brief.reviewScreenshotUrl === "string"
      ? brief.reviewScreenshotUrl
      : null;
  const typographyReferenceUrl =
    brand.languageTypography?.enabled &&
    (brand.languageTypography.useReferenceForAllPosters ||
      brand.languageTypography.typographyStyleProfile)
      ? (brand.languageTypography.profiles?.find(
          (profile) => profile.enabled !== false && profile.role === "primary",
        )?.referenceImageUrl ??
        brand.languageTypography.profiles?.find(
          (profile) => profile.enabled !== false && profile.referenceImageUrl,
        )?.referenceImageUrl ??
        brand.languageTypography.typographyReferenceImageUrl)
      : null;
  const [
    editSource,
    logo,
    board,
    typographyReference,
    posterReferences,
    reviewScreenshot,
  ] = await Promise.all([
    imageUrlToBase64({
      url: editSourceImageUrl ?? null,
      env,
      publicBaseUrl: base,
    }),
    imageUrlToBase64({ url: brand.logoUrl, env, publicBaseUrl: base }),
    imageUrlToBase64({
      url: brand.brandReferenceBoardUrl,
      env,
      publicBaseUrl: base,
    }),
    imageUrlToBase64({
      url: typographyReferenceUrl,
      env,
      publicBaseUrl: base,
    }),
    Promise.all(
      referenceUrls.map((url) =>
        imageUrlToBase64({ url, env, publicBaseUrl: base }),
      ),
    ),
    imageUrlToBase64({ url: reviewScreenshotUrl, env, publicBaseUrl: base }),
  ]);
  const capability = IMAGE_MODEL_CAPABILITIES[imageModel];
  const availableReferenceSlots = Math.max(
    0,
    capability.maxInputImages -
      Number(Boolean(editSource)) -
      Number(Boolean(logo)) -
      Number(Boolean(board)) -
      Number(Boolean(typographyReference)) -
      Number(Boolean(reviewScreenshot)),
  );
  const styleReferenceLimit = Math.min(
    capability.maxStyleReferences,
    availableReferenceSlots,
  );
  const references: LabeledImageReference[] = [
    editSource
      ? {
          ...editSource,
          label: "Current generated poster to edit",
          guidance:
            "This is the existing poster image the user wants edited. Use it as the primary visual source, preserve the clinic identity, and apply only the requested user changes from the prompt.",
        }
      : null,
    reviewScreenshot
      ? {
          ...reviewScreenshot,
          label: "Customer review screenshot",
          guidance:
            "This exact screenshot is the primary testimonial content. Place it intact and readable in the poster; do not extract, retype, redraw, crop, mask, restyle, or replace it.",
        }
      : null,
    logo
      ? {
          ...logo,
          label: "Original logo",
          guidance:
            "Attached original logo image; follow the editable reference-image instructions in the prompt.",
        }
      : null,
    board
      ? {
          ...board,
          label: "Brand reference board",
          guidance:
            posterType === "reference"
              ? "Use this brand board only for the business color palette and identity. Ignore its typography, layout, spacing, composition, and image treatment."
              : "Attached brand board; follow the editable reference-image instructions in the prompt.",
        }
      : null,
    typographyReference
      ? {
          ...typographyReference,
          label: "Typography reference for multilingual poster text",
          guidance:
            "This image controls the desired lettering style for generated poster text. Match its script-native character shapes, weight, stroke contrast, curves, spacing, and headline treatment as closely as possible while keeping the new poster text readable and correctly spelled.",
        }
      : null,
    ...posterReferences
      .filter((reference): reference is ImageBase64Reference =>
        Boolean(reference),
      )
      .slice(0, styleReferenceLimit)
      .map((reference, index) => ({
        ...reference,
        label:
          posterType === "reference"
            ? `Source poster to remake ${index + 1}`
            : `${posterType} poster style reference ${index + 1}`,
        guidance:
          posterType === "reference"
            ? "This source poster controls layout, typography, hierarchy, spacing, and visual treatment. Rebuild its design language with today's content and the attached business logo and brand colors; do not copy competitor identity, facts, or wording."
            : "Attached poster-type design reference; follow the editable reference-image instructions in the prompt.",
      })),
  ].filter((reference): reference is LabeledImageReference =>
    Boolean(reference),
  );

  const imageResponse = await callGeminiImageInteraction({
    apiKey: env.GEMINI_API_KEY!.trim(),
    model: imageModel,
    resolution: generationSettings.imageResolution,
    aspectRatio: generationSettings.aspectRatio,
    prompt,
    references,
  });
  const imageUsage = usageFromResponse(imageResponse);
  const costBreakdown = briefUsage
    ? estimateGenerationCost({
        textModel: generationSettings.textModel,
        imageModel,
        imageResolution: generationSettings.imageResolution,
        briefUsage,
        imageUsage,
      })
    : null;
  const image = imagePart(imageResponse);
  const validationErrors = validateGeneratedPoster({ brand, image, prompt });
  if (validationErrors.length || !image) {
    return store.upsertGeneratedPoster({
      ...started,
      status: "needs_review",
      contextUrl,
      contextJsonUrl,
      angle: String(brief.angle ?? ""),
      briefJson: JSON.stringify(brief),
      prompt,
      briefUsage,
      imageUsage,
      costBreakdown,
      validationErrors,
      failureReason: validationErrors.join(" "),
    });
  }

  const extension = imageExtension(image.mimeType);
  const runId = new Date().toISOString().replaceAll(/\D/g, "").slice(0, 17);
  const languageCode = input.started.languageCode ?? "en";
  const r2Key = `businesses/${businessSlug}/generated/${posterType}/${date}-${languageCode}-${runId}.${extension}`;
  await env.ASSETS!.put(r2Key, base64ToArrayBuffer(image.data), {
    httpMetadata: {
      contentType: image.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  const imageUrl = env.R2_PUBLIC_BASE_URL
    ? `${env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${r2Key}`
    : `${base}/assets/${r2Key}`;

  return store.upsertGeneratedPoster({
    ...started,
    status: "ready",
    contextUrl,
    contextJsonUrl,
    angle: String(brief.angle ?? ""),
    briefJson: JSON.stringify(brief),
    prompt,
    imageUrl,
    imageContentType: image.mimeType,
    r2Key,
    briefUsage,
    imageUsage,
    costBreakdown,
    validationErrors: [],
    failureReason: null,
  });
}

export async function generatePosterImageFromPrompt(input: {
  env: Bindings;
  store: PosterStore;
  businessSlug: string;
  posterType: PosterType;
  dateOrToday: string;
  requestUrl: string;
  prompt: string;
  brief?: Record<string, unknown>;
  calendarEntry?: ContentCalendarEntry | null;
  editSourceImageUrl?: string | null;
  languageCode?: string | null;
}): Promise<GeneratedPoster> {
  const { env, store, businessSlug, posterType, dateOrToday, requestUrl } =
    input;
  const timezone = env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
  const date = resolveDate(dateOrToday, timezone) ?? todayInTimezone(timezone);
  const base = baseUrl(requestUrl, env.PUBLIC_BASE_URL);
  const contextUrl = `${base}/daily-poster/${businessSlug}/${posterType}/today`;
  const contextJsonUrl = `${contextUrl}.json`;
  if (!env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  if (!env.ASSETS) {
    throw new Error("R2 asset storage is not configured.");
  }

  const generationSettings = generationSettingsFor(
    businessSlug,
    env,
    await store.getGenerationSettings(businessSlug),
  );
  const brand = await store.getBrand(businessSlug);
  if (!brand) throw new Error("Business brand system not found.");
  const languageTargets = enabledPosterLanguages(brand);
  const languageTarget =
    languageTargets.find(
      (target) => target.languageCode === input.languageCode,
    ) ?? languageTargets[0]!;
  const languageBrand = brandForLanguage(brand, languageTarget);
  const [typeReference, calendarEntry] = await Promise.all([
    store.getTypeReference(businessSlug, posterType),
    input.calendarEntry === undefined
      ? store.getCalendarEntry(businessSlug, date)
      : Promise.resolve(input.calendarEntry),
  ]);
  if (
    posterType === "reference" &&
    !calendarEntry?.inspirationImageUrl &&
    !hasSourcePoster(typeReference)
  ) {
    throw new Error(
      "Upload an inspiration image for this date or save a source poster before generating a Reference remake.",
    );
  }
  const existing = await store.getGeneratedPoster(
    businessSlug,
    posterType,
    date,
    languageTarget.languageCode,
  );
  const started = await store.upsertGeneratedPoster({
    businessSlug,
    posterType,
    date,
    languageCode: languageTarget.languageCode,
    languageName: languageTarget.languageName,
    status: "processing",
    contextUrl,
    contextJsonUrl,
    angle: existing?.angle ?? null,
    briefJson: input.brief
      ? JSON.stringify(input.brief)
      : (existing?.briefJson ?? null),
    prompt: input.prompt,
    imageUrl: existing?.imageUrl ?? null,
    imageContentType: existing?.imageContentType ?? null,
    r2Key: existing?.r2Key ?? null,
    geminiTextModel: generationSettings.textModel,
    geminiImageModel: generationSettings.imageModel,
    imageResolution: generationSettings.imageResolution,
    aspectRatio: generationSettings.aspectRatio,
    geminiJobName: null,
    briefUsage: existing?.briefUsage ?? null,
    imageUsage: null,
    costBreakdown: null,
    validationErrors: [],
    failureReason: null,
  });
  const brief =
    input.brief ??
    (existing?.briefJson ? jsonFromModelText(existing.briefJson) : {});
  return generatePosterImage({
    env,
    store,
    brand: languageBrand,
    businessSlug,
    posterType,
    date,
    base,
    contextUrl,
    contextJsonUrl,
    typeReference,
    generationSettings,
    prompt: input.prompt,
    brief,
    briefUsage: started.briefUsage,
    started,
    editSourceImageUrl: input.editSourceImageUrl,
  });
}

function imageExtension(contentType: string): string {
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function validateGeneratedPoster(input: {
  brand: BusinessBrandSystem;
  image: { mimeType: string; data: string } | null;
  prompt: string;
}): string[] {
  const errors: string[] = [];
  if (!input.image?.data) errors.push("Gemini did not return an inline image.");
  if (!input.prompt.includes(input.brand.businessName)) {
    errors.push("Prompt does not include the business name.");
  }
  if (!input.prompt.includes(input.brand.phone)) {
    errors.push("Prompt does not include the phone number.");
  }
  return errors;
}

export async function runPosterOrchestrator(input: {
  env: Bindings;
  store: PosterStore;
  businessSlug: string;
  posterType: PosterType;
  dateOrToday: string;
  requestUrl: string;
  force?: boolean;
  calendarEntry?: ContentCalendarEntry | null;
  languageTarget?: PosterLanguageTarget;
}): Promise<GeneratedPoster> {
  const { env, store, businessSlug, posterType, dateOrToday, requestUrl } =
    input;
  const timezone = env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
  const date = resolveDate(dateOrToday, timezone) ?? todayInTimezone(timezone);
  const base = baseUrl(requestUrl, env.PUBLIC_BASE_URL);
  const contextUrl = `${base}/daily-poster/${businessSlug}/${posterType}/today`;
  const contextJsonUrl = `${contextUrl}.json`;
  const apiKey = env.GEMINI_API_KEY?.trim();
  const generationSettings = generationSettingsFor(
    businessSlug,
    env,
    await store.getGenerationSettings(businessSlug),
  );
  const promptSettings = normalizePromptSettings(
    (await store.getPromptSettings(businessSlug)) ??
      defaultPromptSettings(businessSlug),
  );
  const textModel = generationSettings.textModel;
  const imageModel = generationSettings.imageModel;
  const runId = new Date().toISOString().replaceAll(/\D/g, "").slice(0, 17);

  const brand = await store.getBrand(businessSlug);
  if (!brand) throw new Error("Business brand system not found.");
  const languageTarget =
    input.languageTarget ?? enabledPosterLanguages(brand)[0]!;
  const languageBrand = brandForLanguage(brand, languageTarget);

  const existing = await store.getGeneratedPoster(
    businessSlug,
    posterType,
    date,
    languageTarget.languageCode,
  );
  if (existing?.status === "ready" && !input.force) return existing;

  const [typeReference, calendarEntry] = await Promise.all([
    store.getTypeReference(businessSlug, posterType),
    input.calendarEntry === undefined
      ? store.getCalendarEntry(businessSlug, date)
      : Promise.resolve(input.calendarEntry),
  ]);
  if (
    posterType === "reference" &&
    !calendarEntry?.inspirationImageUrl &&
    !hasSourcePoster(typeReference)
  ) {
    throw new Error(
      "Upload an inspiration image for this date or save a source poster before generating a Reference remake.",
    );
  }

  const started = await store.upsertGeneratedPoster({
    businessSlug,
    posterType,
    date,
    languageCode: languageTarget.languageCode,
    languageName: languageTarget.languageName,
    status: "processing",
    contextUrl,
    contextJsonUrl,
    angle: null,
    briefJson: null,
    prompt: null,
    imageUrl: null,
    imageContentType: null,
    r2Key: null,
    geminiTextModel: textModel,
    geminiImageModel: imageModel,
    imageResolution: generationSettings.imageResolution,
    aspectRatio: generationSettings.aspectRatio,
    geminiJobName: null,
    briefUsage: null,
    imageUsage: null,
    costBreakdown: null,
    validationErrors: [],
    failureReason: null,
  });

  if (!apiKey) {
    return store.upsertGeneratedPoster({
      ...started,
      status: "failed",
      failureReason: "GEMINI_API_KEY is not configured.",
    });
  }
  if (!env.ASSETS) {
    return store.upsertGeneratedPoster({
      ...started,
      status: "failed",
      failureReason: "R2 asset storage is not configured.",
    });
  }

  try {
    const sourceSettings =
      (await store.getContentSourceSettings(businessSlug)) ??
      defaultContentSourceSettings(businessSlug);
    const sheetLookup =
      !calendarEntry && posterType === "awareness"
        ? await resolveAwarenessContent(sourceSettings, date)
        : null;
    const calendarContent = calendarEntry
      ? {
          Date: calendarEntry.date,
          Topic: calendarEntry.topic,
          Message: calendarEntry.message ?? "",
          CTA: calendarEntry.cta ?? "",
          PosterMode: calendarEntry.posterMode,
          PosterType: calendarEntry.posterType,
          Notes: calendarEntry.notes ?? "",
        }
      : null;
    const suppliedContent = calendarContent ?? sheetLookup?.row ?? null;
    const referencePosterUrl =
      posterType === "reference"
        ? (calendarEntry?.inspirationImageUrl ??
          typeReference?.referenceImageUrls[0] ??
          typeReference?.productionReferenceImageUrl ??
          null)
        : null;
    const referencePoster = await imageUrlToBase64({
      url: referencePosterUrl,
      env,
      publicBaseUrl: base,
    });
    const briefResult = await generatePosterBrief({
      apiKey,
      model: textModel,
      brand: languageBrand,
      posterType,
      typeReference,
      date,
      contextJsonUrl,
      promptSettings,
      suppliedContent,
      referencePoster,
      referenceMessage:
        calendarEntry?.posterMode === "inspiration" ||
        calendarEntry?.posterMode === "exact_message"
          ? (calendarEntry.message ?? calendarEntry.topic)
          : null,
    });
    const resolvedBrief: Record<string, unknown> = {
      ...briefResult.brief,
      language: {
        code: languageTarget.languageCode,
        name: languageTarget.languageName,
      },
      contentSource: calendarEntry
        ? "content_calendar"
        : (sheetLookup?.source ??
          (posterType === "reference" ? "reference_poster" : "ai_generated")),
      ...(calendarEntry ? { calendarEntry } : {}),
      ...(sheetLookup ? { contentSourceReason: sheetLookup.reason } : {}),
      ...(sheetLookup?.warning
        ? { contentSourceWarning: sheetLookup.warning }
        : {}),
      ...(suppliedContent ? { sourceRow: suppliedContent } : {}),
    };
    const prompt = buildImagePrompt({
      brand: languageBrand,
      posterType,
      typeReference,
      date,
      brief: resolvedBrief,
      contextUrl,
      runId,
      settings: generationSettings,
      promptSettings,
      force: input.force,
    });
    return generatePosterImage({
      env,
      store,
      brand: languageBrand,
      businessSlug,
      posterType,
      date,
      base,
      contextUrl,
      contextJsonUrl,
      typeReference,
      generationSettings,
      prompt,
      brief: resolvedBrief,
      briefUsage: briefResult.usage,
      started: {
        ...started,
        languageCode: languageTarget.languageCode,
        languageName: languageTarget.languageName,
        angle: String(resolvedBrief.angle ?? ""),
        briefJson: JSON.stringify(resolvedBrief),
        prompt,
        briefUsage: briefResult.usage,
      },
    });
  } catch (error) {
    return store.upsertGeneratedPoster({
      ...started,
      status: "failed",
      failureReason:
        error instanceof Error ? error.message : "Poster orchestration failed.",
    });
  }
}

export async function runPosterOrchestratorForLanguages(input: {
  env: Bindings;
  store: PosterStore;
  businessSlug: string;
  posterType: PosterType;
  dateOrToday: string;
  requestUrl: string;
  force?: boolean;
  calendarEntry?: ContentCalendarEntry | null;
}): Promise<GeneratedPoster[]> {
  const brand = await input.store.getBrand(input.businessSlug);
  if (!brand) throw new Error("Business brand system not found.");
  const targets = enabledPosterLanguages(brand);
  const results: GeneratedPoster[] = [];
  for (const languageTarget of targets) {
    results.push(
      await runPosterOrchestrator({
        ...input,
        languageTarget,
      }),
    );
  }
  return results;
}

export function defaultScheduledTarget(env: Bindings): {
  businessSlug: string;
  posterType: PosterType;
} {
  return {
    businessSlug: env.DEFAULT_BUSINESS_SLUG || "dr-poojas-smile-craft",
    posterType: env.DEFAULT_POSTER_TYPE || "awareness",
  };
}
