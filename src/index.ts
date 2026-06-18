import { Hono, type Context } from "hono";
import { DEFAULT_TIMEZONE, resolveDate } from "./date";
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
    "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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

app.get("/", (c) =>
  c.html(
    renderErrorPage(
      200,
      "Daily Poster Packet",
      "Open /daily-poster/:businessSlug/:posterType/:dateOrToday to view a packet.",
    ),
  ),
);

app.get("/robots.txt", (c) =>
  c.text("User-agent: *\nDisallow: /\n", 200, {
    "Content-Type": "text/plain; charset=utf-8",
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "daily-poster-packet",
    openaiApiUsed: false,
  }),
);

async function loadPublicPacket(
  businessSlug: string,
  posterTypeValue: string,
  dateOrToday: string,
  env: Bindings,
): Promise<
  | {
      brand: Awaited<ReturnType<PosterStore["getBrand"]>> & {};
      packet: Awaited<ReturnType<PosterStore["getPacket"]>> & {};
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
  const packet = await store.getPacket(
    businessSlug,
    posterTypeValue,
    resolvedDate,
  );
  if (!packet) {
    return {
      error: `Daily poster packet not found for ${resolvedDate}.`,
      status: 404 as const,
    };
  }
  return { brand, packet, resolvedDate };
}

app.get("/daily-poster/:businessSlug/:posterType/:dateOrToday", async (c) => {
  const rawDate = c.req.param("dateOrToday");
  const wantsJson = rawDate.endsWith(".json");
  const dateOrToday = wantsJson ? rawDate.slice(0, -5) : rawDate;
  const result = await loadPublicPacket(
    c.req.param("businessSlug"),
    c.req.param("posterType"),
    dateOrToday,
    c.env,
  );
  if ("error" in result) {
    if (wantsJson) return jsonError(c, result.status, result.error);
    return c.html(
      renderErrorPage(result.status, "Poster packet unavailable", result.error),
      result.status,
    );
  }

  const base = baseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
  const explicitPath = `/daily-poster/${result.brand.businessSlug}/${result.packet.posterType}/${result.resolvedDate}`;
  c.header("X-Robots-Tag", "noindex, nofollow");
  c.header("Cache-Control", "public, max-age=60");
  if (wantsJson) {
    return c.json({
      businessBrandSystem: result.brand,
      dailyPosterPacket: result.packet,
      resolvedDate: result.resolvedDate,
      publicPageUrl: `${base}${explicitPath}`,
      finalChatGPTInstruction: buildFinalInstruction(
        result.brand,
        result.packet,
      ),
    });
  }
  return c.html(
    renderPosterPage({
      brand: result.brand,
      packet: result.packet,
      resolvedDate: result.resolvedDate,
      publicPageUrl: `${base}${explicitPath}`,
      jsonUrl: `${base}${explicitPath}.json`,
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
  const validated = validatePacket(
    body.value,
    { businessSlug, posterType: posterTypeValue, date: resolvedDate },
    brand,
    existing,
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
