import { Hono, type Context } from "hono";
import { DEFAULT_TIMEZONE, resolveDate, todayInTimezone } from "./date";
import { renderDashboard, renderLoginPage } from "./admin-render";
import {
  clearAdminSession,
  getAdminBusinessSlug,
  setAdminSession,
} from "./admin-session";
import { imageContentTypeForKey, isUploadedFile, uploadImage } from "./assets";
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
import { D1PosterStore } from "./store";
import {
  defaultPromptSettings,
  normalizePromptSettings,
} from "./prompt-settings";
import type {
  Bindings,
  GenerationSettings,
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
    return c.redirect(`/admin/${currentBusiness}`);
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
  return c.redirect(`/admin/${businessSlug}`, 303);
});

app.post("/admin/logout", async (c) => {
  clearAdminSession(c);
  return c.redirect("/", 303);
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
  ] = await Promise.all([
    store.getGenerationSettings(businessSlug),
    store.getPromptSettings(businessSlug),
    store.getContentSourceSettings(businessSlug),
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
      selectedType: posterType,
      selectedDate,
      publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
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
  let reviewScreenshotUrl: string | null = null;
  let reviewScreenshot = null;
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
  });
  const resolvedBrief: Record<string, unknown> = {
    ...brief.brief,
    contentSource: sheetLookup?.source ?? "ai_generated",
    ...(sheetLookup ? { contentSourceReason: sheetLookup.reason } : {}),
    ...(sheetLookup?.warning
      ? { contentSourceWarning: sheetLookup.warning }
      : {}),
    ...(suppliedContent ? { sourceRow: suppliedContent } : {}),
    ...(reviewScreenshotUrl ? { reviewScreenshotUrl } : {}),
    ...(reviewMessage ? { suppliedReviewMessage: reviewMessage } : {}),
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
    });
    const resolvedBrief: Record<string, unknown> = {
      ...brief.brief,
      contentSource: sheetLookup?.source ?? "ai_generated",
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
  const task = runPosterOrchestrator({
    env,
    store: storeFor(env),
    businessSlug: target.businessSlug,
    posterType: target.posterType,
    dateOrToday: "today",
    requestUrl: `${baseUrl("https://worker.local", env.PUBLIC_BASE_URL)}/__scheduled`,
  }).then((result) => {
    if (result.status !== "ready") {
      console.error("Scheduled poster generation did not finish ready", result);
    }
  });
  ctx.waitUntil(task);
}

export default {
  fetch: app.fetch,
  request: app.request.bind(app),
  scheduled,
};
