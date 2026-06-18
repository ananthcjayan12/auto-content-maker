import { imageContentTypeForKey } from "./assets";
import { DEFAULT_TIMEZONE, resolveDate, todayInTimezone } from "./date";
import { buildFinalInstruction } from "./render";
import type {
  Bindings,
  BusinessBrandSystem,
  GeneratedPoster,
  PosterStore,
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

function geminiInteractionsEndpoint(): string {
  return "https://generativelanguage.googleapis.com/v1beta/interactions";
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
  model: string;
  prompt: string;
  references: LabeledImageReference[];
}): Promise<Record<string, unknown>> {
  const response = await fetch(geminiInteractionsEndpoint(), {
    method: "POST",
    headers: {
      "Api-Revision": "2026-05-20",
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify({
      model: input.model,
      input: [
        { type: "text", text: input.prompt },
        ...input.references.flatMap((reference) => [
          {
            type: "text",
            text: `REFERENCE IMAGE: ${reference.label}. ${reference.guidance}`,
          },
          {
            type: "image",
            data: reference.base64,
            mime_type: reference.contentType,
          },
        ]),
      ],
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: "9:16",
        image_size: "1K",
      },
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
}): string {
  const { brand, posterType, typeReference, date, contextJsonUrl } = input;
  return `You are planning a single daily Instagram story poster for a dental clinic in Kerala, India.

Return only compact JSON with these keys:
- angle: the best timely content angle for ${date}
- headline: short poster headline
- subheadline: one supporting line
- requiredText: exact required text array
- visualDirection: concise design direction
- safetyNotes: dental/medical claims to avoid

Strict output rules:
- Return one valid JSON object only.
- Do not wrap it in markdown.
- Do not add text before or after the JSON.
- Escape quotes inside strings.
- Keep requiredText to 2-4 short lines so the final poster stays readable.

Context JSON URL: ${contextJsonUrl}
Business: ${brand.businessName}
Phone: ${brand.phone}
Poster type: ${posterType}
Brand colors: ${JSON.stringify(brand.colors)}
Typography: ${JSON.stringify(brand.typography)}
Visual style: ${JSON.stringify(brand.visualStyle)}
Default rules: ${brand.defaultPosterRules.join(" | ")}
Poster reference notes: ${typeReference?.notes ?? "none"}

  Check what is special, relevant, seasonal, or useful on ${date} in India/Kerala for a dental clinic. Prefer a practical dental awareness angle if there is no strong public event.`;
}

export async function generatePosterBrief(input: {
  apiKey: string;
  model: string;
  brand: BusinessBrandSystem;
  posterType: PosterType;
  typeReference: PosterTypeReference | null;
  date: string;
  contextJsonUrl: string;
}): Promise<{
  prompt: string;
  brief: Record<string, unknown>;
  rawText: string;
}> {
  const prompt = buildBriefPrompt({
    brand: input.brand,
    posterType: input.posterType,
    typeReference: input.typeReference,
    date: input.date,
    contextJsonUrl: input.contextJsonUrl,
  });
  const response = await callGemini({
    apiKey: input.apiKey,
    model: input.model,
    body: {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    },
  });
  const rawText = textParts(response).join("\n").trim();
  return {
    prompt,
    brief: jsonFromModelText(rawText),
    rawText,
  };
}

function buildImagePrompt(input: {
  brand: BusinessBrandSystem;
  posterType: PosterType;
  typeReference: PosterTypeReference | null;
  date: string;
  brief: Record<string, unknown>;
  contextUrl: string;
  runId: string;
  force?: boolean;
}): string {
  const { brand, posterType, typeReference, date, brief, contextUrl, runId } =
    input;
  return `Create one complete 9:16 Instagram story poster image.

Business: ${brand.businessName}
Phone: ${brand.phone}
Date: ${date}
Poster type: ${posterType}
Generation run id: ${runId}
Context page: ${contextUrl}
Brief JSON: ${JSON.stringify(brief)}

Use the attached reference images with this priority:
1. Poster type reference image: this is the main composition, typography, spacing, and styling reference. Closely follow its design language.
2. Logo image: preserve the existing logo identity and place it as a small brand mark or lockup, not as a redesigned logo.
3. Brand reference board: use only for brand feel if it is a real brand board; ignore it if it is a placeholder.

Style-match requirements from the poster reference:
- use a pale aqua or clean white background with premium clinical whitespace
- use very large bold geometric sans-serif headline typography, deep navy for primary words and deep teal for emphasis
- use controlled all-caps tracking for small label text where appropriate
- use thin teal divider lines and small sparkle/star accents sparingly
- use a rounded or organic photo card/mask with a clean white border
- keep the layout structured like a premium social poster, not a generic AI flyer
- do not use random fonts, decorative script, or mismatched typography unless the reference itself uses it for a small accent
- do not drift into a different color palette or casual stock-template style

Use exact brand colors: ${JSON.stringify(brand.colors)}. Typography mood: ${JSON.stringify(brand.typography)}. Visual style: ${JSON.stringify(brand.visualStyle)}.

Required visible text exactly:
${brand.businessName}
${brand.phone}

Design constraints:
- 9:16 vertical Instagram story poster
- clean, premium, modern dental clinic design
- readable on mobile
- high whitespace and strong hierarchy
- do not make a crowded flyer
- do not invent a new logo
- avoid unsupported medical cure claims
- create a fresh visual variant for this generation run; do not intentionally repeat a previous render pixel-for-pixel
${typeReference?.productionReferenceImageUrl ? "- strongly follow the stable poster reference image for font weight, text hierarchy, spacing, divider treatment, photo mask shape, accent style, and overall premium teal/navy look" : ""}`;
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
  const textModel = env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
  const imageModel = env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
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
    geminiJobName: null,
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
    const briefResult = await generatePosterBrief({
      apiKey,
      model: textModel,
      brand,
      posterType,
      typeReference,
      date,
      contextJsonUrl,
    });
    const prompt = buildImagePrompt({
      brand,
      posterType,
      typeReference,
      date,
      brief: briefResult.brief,
      contextUrl,
      runId,
      force: input.force,
    });

    const [logo, board, posterReference] = await Promise.all([
      imageUrlToBase64({ url: brand.logoUrl, env, publicBaseUrl: base }),
      imageUrlToBase64({
        url: brand.brandReferenceBoardUrl,
        env,
        publicBaseUrl: base,
      }),
      imageUrlToBase64({
        url: typeReference?.productionReferenceImageUrl ?? null,
        env,
        publicBaseUrl: base,
      }),
    ]);
    const references: LabeledImageReference[] = [
      logo
        ? {
            ...logo,
            label: "Logo",
            guidance:
              "Use only as the clinic identity reference. Preserve it; do not redesign or invent a new logo.",
          }
        : null,
      board
        ? {
            ...board,
            label: "Brand reference board",
            guidance:
              "Use for overall brand colors and mood only. If it appears to be a placeholder, give it low priority.",
          }
        : null,
      posterReference
        ? {
            ...posterReference,
            label: `${posterType} poster style reference`,
            guidance:
              "Highest-priority visual style reference. Match its typography hierarchy, font weight, spacing, pale aqua background, teal/navy palette, rounded photo mask, thin divider lines, sparkle accents, and premium clinical poster composition.",
          }
        : null,
    ].filter((reference): reference is LabeledImageReference =>
      Boolean(reference),
    );

    const imageResponse = await callGeminiImageInteraction({
      apiKey,
      model: imageModel,
      prompt,
      references,
    });
    const image = imagePart(imageResponse);
    const validationErrors = validateGeneratedPoster({ brand, image, prompt });
    if (validationErrors.length || !image) {
      return store.upsertGeneratedPoster({
        ...started,
        status: "needs_review",
        angle: String(briefResult.brief.angle ?? ""),
        briefJson: JSON.stringify(briefResult.brief),
        prompt,
        validationErrors,
        failureReason: validationErrors.join(" "),
      });
    }

    const extension = imageExtension(image.mimeType);
    const r2Key = `businesses/${businessSlug}/generated/${posterType}/${date}-${runId}.${extension}`;
    await env.ASSETS.put(r2Key, base64ToArrayBuffer(image.data), {
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
      angle: String(briefResult.brief.angle ?? ""),
      briefJson: JSON.stringify(briefResult.brief),
      prompt,
      imageUrl,
      imageContentType: image.mimeType,
      r2Key,
      validationErrors: [],
      failureReason: null,
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

export { buildFinalInstruction };
