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
  buildFinalInstruction,
  renderErrorPage,
  renderPosterPage,
} from "./render";
import { D1PosterStore } from "./store";
import type { Bindings, PosterStore } from "./types";
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

function baseUrl(requestUrl: string, configured?: string): string {
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

async function imageUrlToBase64(input: {
  url: string | null;
  env: Bindings;
  publicBaseUrl: string;
}): Promise<{
  url: string;
  contentType: string;
  byteLength: number;
  base64: string;
} | null> {
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
      headers: { "User-Agent": "daily-poster-packet-image-inliner/1.0" },
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

function jsonError(
  c: Context<{ Bindings: Bindings }>,
  status: 400 | 401 | 404 | 500,
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
  const typeReference = await store.getTypeReference(businessSlug, posterType);
  return c.html(
    renderDashboard({
      brand,
      typeReference,
      selectedType: posterType,
      selectedDate,
      publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
      message: c.req.query("message") || undefined,
      error: c.req.query("error") || undefined,
    }),
  );
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
    const typeReferenceFile = form.get("typeReferenceFile");
    let productionReferenceImageUrl =
      formString(form, "productionReferenceImageUrl") || null;
    if (isUploadedFile(typeReferenceFile)) {
      productionReferenceImageUrl = await uploadImage({
        env: c.env,
        file: typeReferenceFile,
        keyPrefix: `businesses/${businessSlug}/types/${posterType}/reference-${Date.now()}`,
        publicBaseUrl: baseUrl(c.req.url, c.env.PUBLIC_BASE_URL),
      });
    }
    await store.upsertTypeReference({
      businessSlug,
      posterType,
      productionReferenceImageUrl,
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
  const typeReference = await store.getTypeReference(
    businessSlug,
    posterTypeValue,
  );
  return { brand, posterType: posterTypeValue, typeReference, resolvedDate };
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
    return c.json({
      businessBrandSystem: result.brand,
      posterType: result.posterType,
      resolvedDate: result.resolvedDate,
      publicPageUrl,
      jsonUrl,
      posterTypeReference: result.typeReference,
      posterReferenceImageUrl:
        result.typeReference?.productionReferenceImageUrl ?? null,
      brandHexPalette: result.brand.colors,
      imageColorGuidanceHex: result.brand.colors,
      finalChatGPTInstruction: buildFinalInstruction(
        result.brand,
        result.posterType,
        result.typeReference,
      ),
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
  const posterReferenceBase64 = await imageUrlToBase64({
    url: result.typeReference?.productionReferenceImageUrl ?? null,
    env: c.env,
    publicBaseUrl: base,
  });
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
        posterReference: posterReferenceBase64,
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

export default app;
