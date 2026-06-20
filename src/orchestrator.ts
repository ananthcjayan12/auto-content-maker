import { imageContentTypeForKey } from "./assets";
import {
  defaultContentSourceSettings,
  findTodaySheetContent,
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
} from "./prompt-settings";
import type {
  Bindings,
  BusinessBrandSystem,
  GeminiUsage,
  GenerationSettings,
  GeneratedPoster,
  ImageModelId,
  ImageResolution,
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

interface LabeledImageReference extends ImageBase64Reference {
  label: string;
  guidance: string;
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
    ? `\n\nSUPPLIED CONTENT FROM TODAY'S GOOGLE SHEET ROW\n${JSON.stringify(input.suppliedContent, null, 2)}\nEdit this copy for clarity and mobile readability while preserving every fact and meaning. Do not replace it with a different topic.`
    : "";
  const reviewInstruction = input.hasReviewScreenshot
    ? "\n\nA customer review screenshot is attached. Read the actual review, rating, and attribution from it. Preserve the meaning, do not invent missing details, and create the review-poster JSON from that evidence."
    : input.reviewMessage
      ? `\n\nSUPPLIED CUSTOMER REVIEW MESSAGE\n${input.reviewMessage}\nUse this exact customer-supplied review as the factual source. You may shorten it only for mobile readability without changing its meaning. Do not invent a rating, name, treatment, or result.`
      : "";
  return basePrompt + sourceInstruction + reviewInstruction;
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
  const response = await callGemini({
    apiKey: input.apiKey,
    model: input.model,
    body: {
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json" },
    },
  });
  const rawText = textParts(response).join("\n").trim();
  return {
    prompt,
    brief: jsonFromModelText(rawText),
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
  const sections = [
    fillPromptTemplate(promptSettings.masterImagePromptTemplate, variables),
    fillPromptTemplate(promptSettings.posterTypePrompts[posterType], variables),
    fillPromptTemplate(promptSettings.referencePromptTemplate, variables),
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
  } = input;
  const imageModel = generationSettings.imageModel;
  const referenceUrls = typeReference?.referenceImageUrls.length
    ? typeReference.referenceImageUrls
    : typeReference?.productionReferenceImageUrl
      ? [typeReference.productionReferenceImageUrl]
      : [];
  const reviewScreenshotUrl =
    posterType === "review" && typeof brief.reviewScreenshotUrl === "string"
      ? brief.reviewScreenshotUrl
      : null;
  const [logo, board, posterReferences, reviewScreenshot] = await Promise.all([
    imageUrlToBase64({ url: brand.logoUrl, env, publicBaseUrl: base }),
    imageUrlToBase64({
      url: brand.brandReferenceBoardUrl,
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
      Number(Boolean(logo)) -
      Number(Boolean(board)) -
      Number(Boolean(reviewScreenshot)),
  );
  const styleReferenceLimit = Math.min(
    capability.maxStyleReferences,
    availableReferenceSlots,
  );
  const references: LabeledImageReference[] = [
    reviewScreenshot
      ? {
          ...reviewScreenshot,
          label: "Customer review screenshot",
          guidance:
            "Use this as factual content evidence for the testimonial. Do not copy the screenshot UI or invent review details.",
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
            "Attached brand board; follow the editable reference-image instructions in the prompt.",
        }
      : null,
    ...posterReferences
      .filter((reference): reference is ImageBase64Reference =>
        Boolean(reference),
      )
      .slice(0, styleReferenceLimit)
      .map((reference, index) => ({
        ...reference,
        label: `${posterType} poster style reference ${index + 1}`,
        guidance:
          "Attached poster-type design reference; follow the editable reference-image instructions in the prompt.",
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
  const r2Key = `businesses/${businessSlug}/generated/${posterType}/${date}-${runId}.${extension}`;
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
  const typeReference = await store.getTypeReference(businessSlug, posterType);
  const existing = await store.getGeneratedPoster(
    businessSlug,
    posterType,
    date,
  );
  const started = await store.upsertGeneratedPoster({
    businessSlug,
    posterType,
    date,
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
    brand,
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

  const existing = await store.getGeneratedPoster(
    businessSlug,
    posterType,
    date,
  );
  if (existing?.status === "ready" && !input.force) return existing;

  const brand = await store.getBrand(businessSlug);
  if (!brand) throw new Error("Business brand system not found.");
  const typeReference = await store.getTypeReference(businessSlug, posterType);

  const started = await store.upsertGeneratedPoster({
    businessSlug,
    posterType,
    date,
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
    const suppliedContent =
      posterType === "awareness" &&
      sourceSettings.awarenessMode === "sheet_first" &&
      sourceSettings.googleSheetUrl
        ? await findTodaySheetContent(
            sourceSettings.googleSheetUrl,
            date,
          ).catch(() => null)
        : null;
    const briefResult = await generatePosterBrief({
      apiKey,
      model: textModel,
      brand,
      posterType,
      typeReference,
      date,
      contextJsonUrl,
      promptSettings,
      suppliedContent,
    });
    const resolvedBrief: Record<string, unknown> = {
      ...briefResult.brief,
      contentSource: suppliedContent ? "google_sheet" : "ai_generated",
      ...(suppliedContent ? { sourceRow: suppliedContent } : {}),
    };
    const prompt = buildImagePrompt({
      brand,
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
      brief: resolvedBrief,
      briefUsage: briefResult.usage,
      started: {
        ...started,
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

export function defaultScheduledTarget(env: Bindings): {
  businessSlug: string;
  posterType: PosterType;
} {
  return {
    businessSlug: env.DEFAULT_BUSINESS_SLUG || "dr-poojas-smile-craft",
    posterType: env.DEFAULT_POSTER_TYPE || "awareness",
  };
}
