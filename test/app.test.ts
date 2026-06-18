import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import type {
  Bindings,
  BusinessBrandSystem,
  DailyPosterPacket,
  GeneratedPoster,
  PosterStore,
  PosterType,
  PosterTypeReference,
} from "../src/types";
import { todayInTimezone } from "../src/date";

class MemoryStore implements PosterStore {
  brands = new Map<string, BusinessBrandSystem>();
  packets = new Map<string, DailyPosterPacket>();
  typeReferences = new Map<string, PosterTypeReference>();
  generatedPosters = new Map<string, GeneratedPoster>();

  private packetKey(slug: string, type: PosterType, date: string) {
    return `${slug}:${type}:${date}`;
  }

  private typeReferenceKey(slug: string, type: PosterType) {
    return `${slug}:${type}`;
  }

  async listBrands() {
    return [...this.brands.values()].sort((left, right) =>
      left.businessName.localeCompare(right.businessName),
    );
  }

  async getBrand(slug: string) {
    return this.brands.get(slug) ?? null;
  }

  async upsertBrand(brand: BusinessBrandSystem) {
    const saved = { ...brand, updatedAt: new Date().toISOString() };
    this.brands.set(brand.businessSlug, saved);
    return saved;
  }

  async getTypeReference(slug: string, type: PosterType) {
    return this.typeReferences.get(this.typeReferenceKey(slug, type)) ?? null;
  }

  async upsertTypeReference(reference: PosterTypeReference) {
    const saved = { ...reference, updatedAt: new Date().toISOString() };
    this.typeReferences.set(
      this.typeReferenceKey(reference.businessSlug, reference.posterType),
      saved,
    );
    return saved;
  }

  async getPacket(slug: string, type: PosterType, date: string) {
    return this.packets.get(this.packetKey(slug, type, date)) ?? null;
  }

  async upsertPacket(packet: DailyPosterPacket) {
    const saved = { ...packet, updatedAt: new Date().toISOString() };
    this.packets.set(
      this.packetKey(packet.businessSlug, packet.posterType, packet.date),
      saved,
    );
    return saved;
  }

  async getGeneratedPoster(slug: string, type: PosterType, date: string) {
    return this.generatedPosters.get(this.packetKey(slug, type, date)) ?? null;
  }

  async upsertGeneratedPoster(poster: GeneratedPoster) {
    const saved = { ...poster, updatedAt: new Date().toISOString() };
    this.generatedPosters.set(
      this.packetKey(poster.businessSlug, poster.posterType, poster.date),
      saved,
    );
    return saved;
  }
}

const brand: BusinessBrandSystem = {
  businessSlug: "dr-poojas-smile-craft",
  businessName: "Dr Pooja’s Smile Craft Dental Clinic",
  phone: "7907006842",
  websiteUrl: "https://drpoojassmilecraftdental.com/",
  logoUrl: "https://example.com/logo.png",
  brandReferenceBoardUrl: "https://example.com/brand-board.png",
  colors: {
    primary: "#0EA5A4",
    secondary: "#F7E7CE",
    accent: "#FFFFFF",
    darkText: "#123333",
    mutedText: "#5F6F6F",
  },
  typography: {
    headingStyle: "modern premium sans-serif",
    bodyStyle: "clean readable sans-serif",
    fontMood: "premium, soft, clinical, friendly",
  },
  visualStyle: {
    mood: "modern and warm",
    layout: "minimal",
    photoStyle: "bright photography",
    avoid: ["crowded flyer look"],
  },
  defaultPosterRules: ["Keep text readable on mobile"],
};

function packet(
  date: string,
  image: string | null = "https://example.com/ref.jpg",
): DailyPosterPacket {
  return {
    businessSlug: brand.businessSlug,
    posterType: "awareness" as const,
    date,
    status: image ? "ready" : "draft",
    headline: "A Cleaner Smile Starts Here",
    subheadline: "Gentle dental cleaning",
    cta: "Book today",
    offer: null,
    campaignGoal: "Awareness",
    targetAudience: "Local families",
    requiredText: [brand.businessName, brand.phone],
    productionReferenceImageUrl: image,
    additionalReferenceImages: [],
    specialInstructions: ["Keep it premium"],
    chatgptImagePrompt: "Create the poster.",
  };
}

describe("daily poster packet worker", () => {
  let store: MemoryStore;
  let env: Bindings;
  const today = "2026-06-18";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T02:00:00.000Z"));
    store = new MemoryStore();
    store.brands.set(brand.businessSlug, brand);
    store.packets.set(
      `${brand.businessSlug}:awareness:${today}`,
      packet(today),
    );
    store.typeReferences.set(`${brand.businessSlug}:awareness`, {
      businessSlug: brand.businessSlug,
      posterType: "awareness",
      productionReferenceImageUrl: "https://example.com/type-ref.jpg",
      notes: "Permanent awareness style reference",
    });
    env = {
      DB: {} as D1Database,
      TEST_STORE: store,
      POSTER_ADMIN_TOKEN: "test-secret",
      PUBLIC_BASE_URL: "https://poster.example.com",
      BUSINESS_TIMEZONE: "Asia/Kolkata",
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("resolves today in Asia/Kolkata", () => {
    expect(
      todayInTimezone("Asia/Kolkata", new Date("2026-06-17T20:00:00.000Z")),
    ).toBe("2026-06-18");
  });

  it("renders the business-select admin login on the homepage", async () => {
    const response = await app.request("/", {}, env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Poster admin");
    expect(html).toContain(brand.businessName);
    expect(html).toContain('name="token"');
  });

  it("creates a scoped HttpOnly admin session and opens the dashboard", async () => {
    const loginResponse = await app.request(
      "/admin/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          businessSlug: brand.businessSlug,
          token: "test-secret",
        }).toString(),
      },
      env,
    );
    expect(loginResponse.status).toBe(303);
    const cookie = loginResponse.headers.get("set-cookie");
    expect(cookie).toContain("poster_admin_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");

    const dashboardResponse = await app.request(
      `/admin/${brand.businessSlug}`,
      { headers: { Cookie: cookie?.split(";")[0] ?? "" } },
      env,
    );
    const dashboard = await dashboardResponse.text();
    expect(dashboardResponse.status).toBe(200);
    expect(dashboard).toContain("Poster admin dashboard");
    expect(dashboard).toContain("Save brand system");
    expect(dashboard).toContain("Save type reference");
    expect(dashboard).toContain("How daily generation works now");
  });

  it("rejects an invalid dashboard token", async () => {
    const response = await app.request(
      "/admin/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          businessSlug: brand.businessSlug,
          token: "wrong-secret",
        }).toString(),
      },
      env,
    );
    expect(response.status).toBe(401);
    expect(await response.text()).toContain("Invalid business or admin token");
  });

  it("uploads a poster-type reference image to R2 through the dashboard", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    env.ASSETS = { put } as unknown as R2Bucket;
    const loginResponse = await app.request(
      "/admin/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          businessSlug: brand.businessSlug,
          token: "test-secret",
        }).toString(),
      },
      env,
    );
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    const form = new FormData();
    form.set("posterType", "awareness");
    form.set("date", today);
    form.set("notes", "A permanent awareness poster reference.");
    form.set(
      "typeReferenceFile",
      new File(["png"], "reference.png", { type: "image/png" }),
    );

    const response = await app.request(
      `/admin/${brand.businessSlug}/type-reference`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );
    expect(response.status).toBe(303);
    expect(put).toHaveBeenCalledOnce();
    expect(
      (await store.getTypeReference(brand.businessSlug, "awareness"))
        ?.productionReferenceImageUrl,
    ).toContain(
      `/assets/businesses/${brand.businessSlug}/types/awareness/reference-`,
    );
  });

  it("saves ready daily packet content without duplicating a reference image", async () => {
    const loginResponse = await app.request(
      "/admin/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          businessSlug: brand.businessSlug,
          token: "test-secret",
        }).toString(),
      },
      env,
    );
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    const form = new FormData();
    form.set("posterType", "awareness");
    form.set("date", today);
    form.set("status", "ready");
    form.set("headline", "Daily copy only");
    form.set("requiredText", `${brand.businessName}\n${brand.phone}`);

    const response = await app.request(
      `/admin/${brand.businessSlug}/packet`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );

    expect(response.status).toBe(303);
    const saved = await store.getPacket(brand.businessSlug, "awareness", today);
    expect(saved?.headline).toBe("Daily copy only");
    expect(saved?.productionReferenceImageUrl).toBeNull();
  });

  it("serves R2 assets with an image content type fallback", async () => {
    env.ASSETS = {
      get: vi.fn().mockResolvedValue({
        body: new Blob(["jpg"], { type: "image/jpeg" }).stream(),
        httpEtag: '"asset-etag"',
        writeHttpMetadata: vi.fn(),
      }),
    } as unknown as R2Bucket;

    const response = await app.request(
      "/assets/businesses/dr-poojas-smile-craft/brand/logo-123.jpg",
      {},
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("etag")).toBe('"asset-etag"');
  });

  it("applies the Smile Craft poster preset from the dashboard", async () => {
    const loginResponse = await app.request(
      "/admin/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          businessSlug: brand.businessSlug,
          token: "test-secret",
        }).toString(),
      },
      env,
    );
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0] ?? "";

    const response = await app.request(
      `/admin/${brand.businessSlug}/preset`,
      { method: "POST", headers: { Cookie: cookie } },
      env,
    );

    expect(response.status).toBe(303);
    const updatedBrand = await store.getBrand(brand.businessSlug);
    expect(updatedBrand?.colors.primary).toBe("#008E8C");
    expect(updatedBrand?.colors.darkText).toBe("#071529");
    expect(updatedBrand?.typography.headingStyle).toContain(
      "bold geometric sans-serif",
    );
    expect(updatedBrand?.defaultPosterRules).toContain(
      "Use deep teal as the main brand color and deep navy for high-impact text",
    );
  });

  it("renders the public page with stable brand context only", async () => {
    store.brands.set(brand.businessSlug, {
      ...brand,
      logoUrl: "https://poster.example.com/assets/logo.png",
      brandReferenceBoardUrl: "https://poster.example.com/assets/board.png",
    });
    store.typeReferences.set(`${brand.businessSlug}:awareness`, {
      businessSlug: brand.businessSlug,
      posterType: "awareness",
      productionReferenceImageUrl: "https://poster.example.com/assets/ref.png",
      notes: "Permanent awareness style reference",
    });
    env.ASSETS = {
      get: vi.fn().mockResolvedValue({
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer),
        writeHttpMetadata: (headers: Headers) => {
          headers.set("content-type", "image/png");
        },
      }),
    } as unknown as R2Bucket;

    const response = await app.request(
      `/daily-poster/${brand.businessSlug}/awareness/today`,
      {},
      env,
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(brand.businessName);
    expect(html).toContain("Poster Design Context");
    expect(html).not.toContain("Today’s Poster Content");
    expect(html).not.toContain("<img");
    expect(html).toContain("Logo image base64");
    expect(html).toContain("Brand reference board image base64");
    expect(html).toContain("awareness poster reference image base64");
    expect(html).toContain("iVBORw==");
    expect(html).toContain("Final ChatGPT Task Instruction");
    expect(html).toContain("First check what is special");
    expect(html).toContain("Hex palette for LLM");
    expect(html).toContain('content="noindex"');
    expect(env.ASSETS.get).toHaveBeenCalledTimes(3);
  });

  it("returns stable brand context JSON without requiring a daily packet", async () => {
    store.packets.clear();
    const response = await app.request(
      `/daily-poster/${brand.businessSlug}/awareness/today.json`,
      {},
      env,
    );
    const body = (await response.json()) as {
      businessBrandSystem: BusinessBrandSystem;
      posterType: PosterType;
      posterTypeReference: PosterTypeReference | null;
      posterReferenceImageUrl: string | null;
      resolvedDate: string;
      finalChatGPTInstruction: string;
      brandHexPalette: BusinessBrandSystem["colors"];
      imageColorGuidanceHex: BusinessBrandSystem["colors"];
    };
    expect(response.status).toBe(200);
    expect(body.businessBrandSystem.businessSlug).toBe(brand.businessSlug);
    expect(body.posterType).toBe("awareness");
    expect(body.posterTypeReference?.productionReferenceImageUrl).toBe(
      "https://example.com/type-ref.jpg",
    );
    expect(body.posterReferenceImageUrl).toBe(
      "https://example.com/type-ref.jpg",
    );
    expect(body.resolvedDate).toBe(today);
    expect(body.brandHexPalette.primary).toBe("#0EA5A4");
    expect(body.imageColorGuidanceHex.darkText).toBe("#123333");
    expect(body.finalChatGPTInstruction).toContain("check what is special");
  });

  it("rejects a protected update without a token", async () => {
    const response = await app.request(
      `/api/daily-poster/${brand.businessSlug}/awareness/${today}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: "Updated" }),
      },
      env,
    );
    expect(response.status).toBe(401);
  });

  it("accepts a protected daily update with a valid token", async () => {
    const response = await app.request(
      `/api/daily-poster/${brand.businessSlug}/awareness/${today}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-secret",
        },
        body: JSON.stringify({
          headline: "Updated headline",
          productionReferenceImageUrl: "https://example.com/new-ref.jpg",
        }),
      },
      env,
    );
    const body = (await response.json()) as {
      publicUrl: string;
    };
    expect(response.status).toBe(200);
    expect(body.publicUrl).toBe(
      `https://poster.example.com/daily-poster/${brand.businessSlug}/awareness/${today}`,
    );
    expect(
      (await store.getPacket(brand.businessSlug, "awareness", today))?.headline,
    ).toBe("Updated headline");
  });

  it("accepts a ready API daily update without a daily image when type reference exists", async () => {
    store.packets.set(
      `${brand.businessSlug}:awareness:${today}`,
      packet(today, null),
    );
    const response = await app.request(
      `/api/daily-poster/${brand.businessSlug}/awareness/${today}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-secret",
        },
        body: JSON.stringify({
          headline: "API copy with stable type reference",
          status: "ready",
        }),
      },
      env,
    );

    expect(response.status).toBe(200);
    const saved = await store.getPacket(brand.businessSlug, "awareness", today);
    expect(saved?.headline).toBe("API copy with stable type reference");
    expect(saved?.productionReferenceImageUrl).toBeNull();
  });

  it("rejects a ready API daily update without any reference image", async () => {
    store.typeReferences.delete(`${brand.businessSlug}:awareness`);
    store.packets.set(
      `${brand.businessSlug}:awareness:${today}`,
      packet(today, null),
    );
    const response = await app.request(
      `/api/daily-poster/${brand.businessSlug}/awareness/${today}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-secret",
        },
        body: JSON.stringify({
          headline: "Missing reference",
          status: "ready",
        }),
      },
      env,
    );
    const body = (await response.json()) as { details: string[] };

    expect(response.status).toBe(400);
    expect(body.details.join(" ")).toContain(
      "productionReferenceImageUrl is required",
    );
  });

  it("allows an update to explicitly clear optional content", async () => {
    const existing = packet(today);
    existing.offer = "Old offer";
    store.packets.set(`${brand.businessSlug}:awareness:${today}`, existing);
    const response = await app.request(
      `/api/daily-poster/${brand.businessSlug}/awareness/${today}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-secret",
        },
        body: JSON.stringify({ offer: null }),
      },
      env,
    );
    expect(response.status).toBe(200);
    expect(
      (await store.getPacket(brand.businessSlug, "awareness", today))?.offer,
    ).toBeNull();
  });

  it("runs the protected Gemini poster orchestrator and stores the image", async () => {
    store.brands.set(brand.businessSlug, {
      ...brand,
      logoUrl: "https://poster.example.com/assets/logo.png",
      brandReferenceBoardUrl: "https://poster.example.com/assets/board.png",
    });
    store.typeReferences.set(`${brand.businessSlug}:awareness`, {
      businessSlug: brand.businessSlug,
      posterType: "awareness",
      productionReferenceImageUrl: "https://poster.example.com/assets/ref.png",
      notes: "Permanent awareness style reference",
    });
    const put = vi.fn().mockResolvedValue(undefined);
    env.GEMINI_API_KEY = "gemini-secret";
    env.ASSETS = {
      get: vi.fn().mockResolvedValue({
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer),
        writeHttpMetadata: (headers: Headers) => {
          headers.set("content-type", "image/png");
        },
      }),
      put,
    } as unknown as R2Bucket;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        angle: "Monsoon dental care",
                        headline: "Protect your smile this season",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "image/png",
                        data: "iVBORw==",
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request(
      `/api/orchestrate/${brand.businessSlug}/awareness/today`,
      {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      },
      env,
    );
    const body = (await response.json()) as {
      success: boolean;
      generatedPoster: GeneratedPoster;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.generatedPoster.status).toBe("ready");
    expect(body.generatedPoster.angle).toBe("Monsoon dental care");
    expect(body.generatedPoster.imageUrl).toBe(
      `https://poster.example.com/assets/businesses/${brand.businessSlug}/generated/awareness/${today}.png`,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(env.ASSETS.get).toHaveBeenCalledTimes(3);
    expect(put).toHaveBeenCalledOnce();
  });

  it("returns generated poster status through the protected API", async () => {
    await store.upsertGeneratedPoster({
      businessSlug: brand.businessSlug,
      posterType: "awareness",
      date: today,
      status: "ready",
      contextUrl: "https://poster.example.com/daily-poster/context",
      contextJsonUrl: "https://poster.example.com/daily-poster/context.json",
      angle: "Daily dental awareness",
      briefJson: "{}",
      prompt: "Prompt",
      imageUrl: "https://poster.example.com/assets/generated.png",
      imageContentType: "image/png",
      r2Key: "generated.png",
      geminiTextModel: "gemini-2.5-flash",
      geminiImageModel: "gemini-2.5-flash-image",
      geminiJobName: null,
      validationErrors: [],
      failureReason: null,
    });

    const response = await app.request(
      `/api/generated-poster/${brand.businessSlug}/awareness/today`,
      { headers: { Authorization: "Bearer test-secret" } },
      env,
    );
    const body = (await response.json()) as {
      generatedPoster: GeneratedPoster;
    };

    expect(response.status).toBe(200);
    expect(body.generatedPoster.status).toBe("ready");
    expect(body.generatedPoster.angle).toBe("Daily dental awareness");
  });

  it("shows a warning when the production reference is missing", async () => {
    store.brands.set(brand.businessSlug, {
      ...brand,
      logoUrl: "https://poster.example.com/assets/logo.png",
      brandReferenceBoardUrl: "https://poster.example.com/assets/board.png",
    });
    env.ASSETS = {
      get: vi.fn().mockResolvedValue({
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(new Uint8Array([137, 80, 78, 71]).buffer),
        writeHttpMetadata: (headers: Headers) => {
          headers.set("content-type", "image/png");
        },
      }),
    } as unknown as R2Bucket;
    store.typeReferences.delete(`${brand.businessSlug}:awareness`);
    const response = await app.request(
      `/daily-poster/${brand.businessSlug}/awareness/today`,
      {},
      env,
    );
    expect(await response.text()).toContain(
      "No poster-type reference image is saved yet",
    );
  });
});
