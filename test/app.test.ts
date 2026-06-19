import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { normalizeGenerationSettings } from "../src/gemini-models";
import { imageGenerationConfig } from "../src/orchestrator";
import { defaultPromptSettings } from "../src/prompt-settings";
import type {
  Bindings,
  BusinessBrandSystem,
  DailyPosterPacket,
  GenerationSettings,
  GeneratedPoster,
  PosterStore,
  PosterPromptSettings,
  PosterType,
  PosterTypeReference,
} from "../src/types";
import { todayInTimezone } from "../src/date";

class MemoryStore implements PosterStore {
  brands = new Map<string, BusinessBrandSystem>();
  packets = new Map<string, DailyPosterPacket>();
  typeReferences = new Map<string, PosterTypeReference>();
  generationSettings = new Map<string, GenerationSettings>();
  promptSettings = new Map<string, PosterPromptSettings>();
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

  async getGenerationSettings(slug: string) {
    return this.generationSettings.get(slug) ?? null;
  }

  async upsertGenerationSettings(settings: GenerationSettings) {
    const saved = { ...settings, updatedAt: new Date().toISOString() };
    this.generationSettings.set(settings.businessSlug, saved);
    return saved;
  }

  async getPromptSettings(slug: string) {
    return this.promptSettings.get(slug) ?? null;
  }

  async upsertPromptSettings(settings: PosterPromptSettings) {
    const saved = { ...settings, updatedAt: new Date().toISOString() };
    this.promptSettings.set(settings.businessSlug, saved);
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

  async listGeneratedPosters(
    slug: string,
    options?: { posterType?: PosterType; limit?: number },
  ) {
    const posters = [...this.generatedPosters.values()]
      .filter(
        (poster) =>
          poster.businessSlug === slug &&
          (!options?.posterType || poster.posterType === options.posterType),
      )
      .sort((left, right) => right.date.localeCompare(left.date));
    return posters.slice(0, options?.limit ?? 24);
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
      referenceImageUrls: ["https://example.com/type-ref.jpg"],
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

  it("uses model-specific Gemini image resolution configuration", () => {
    expect(
      imageGenerationConfig("gemini-3.1-flash-image", "4K", "9:16").imageConfig,
    ).toEqual({ aspectRatio: "9:16", imageSize: "4K" });
    expect(
      imageGenerationConfig("gemini-2.5-flash-image", "4K", "9:16").imageConfig,
    ).toEqual({ aspectRatio: "9:16" });
    expect(
      normalizeGenerationSettings({
        businessSlug: brand.businessSlug,
        textModel: "gemini-3.5-flash",
        imageModel: "gemini-3-pro-image",
        imageResolution: "512",
        aspectRatio: "9:16",
      }).imageResolution,
    ).toBe("2K");
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
    expect(dashboard).toContain("Save reference images");
    expect(dashboard).toContain("Save generation settings");
    expect(dashboard).toContain("Editable generation prompts");
    expect(dashboard).toContain("Daily generation flow");
    expect(dashboard).toContain("Generation lab");
    expect(dashboard).toContain("Generated image gallery");
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

  it("saves Gemini models and image resolution from the dashboard", async () => {
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
    form.set("textModel", "gemini-3.1-pro-preview");
    form.set("imageModel", "gemini-3-pro-image");
    form.set("imageResolution", "4K");

    const response = await app.request(
      `/admin/${brand.businessSlug}/generation-settings`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );

    expect(response.status).toBe(303);
    expect(await store.getGenerationSettings(brand.businessSlug)).toMatchObject(
      {
        textModel: "gemini-3.1-pro-preview",
        imageModel: "gemini-3-pro-image",
        imageResolution: "4K",
        aspectRatio: "9:16",
      },
    );
  });

  it("saves editable prompt templates from the dashboard", async () => {
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
    const defaults = defaultPromptSettings(brand.businessSlug);
    const form = new FormData();
    form.set("selectedPosterType", "awareness");
    form.set(
      "contentPromptTemplate",
      "Custom content {{businessName}} {{posterTypePrompt}}",
    );
    form.set(
      "masterImagePromptTemplate",
      "Custom image {{businessName}} {{phone}}",
    );
    form.set("referencePromptTemplate", "Custom references {{posterType}}");
    for (const [type, prompt] of Object.entries(defaults.posterTypePrompts)) {
      form.set(
        `posterTypePrompt_${type}`,
        type === "offer" ? "Custom offer rules" : prompt,
      );
    }
    const response = await app.request(
      `/admin/${brand.businessSlug}/prompt-settings`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );
    expect(response.status).toBe(303);
    expect(await store.getPromptSettings(brand.businessSlug)).toMatchObject({
      contentPromptTemplate:
        "Custom content {{businessName}} {{posterTypePrompt}}",
      masterImagePromptTemplate: "Custom image {{businessName}} {{phone}}",
      referencePromptTemplate: "Custom references {{posterType}}",
      posterTypePrompts: { offer: "Custom offer rules" },
    });
  });

  it("uploads multiple poster-type reference images to R2 through the dashboard", async () => {
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
    form.append(
      "typeReferenceFiles",
      new File(["png"], "reference.png", { type: "image/png" }),
    );
    form.append(
      "typeReferenceFiles",
      new File(["jpg"], "reference-two.jpg", { type: "image/jpeg" }),
    );

    const response = await app.request(
      `/admin/${brand.businessSlug}/type-reference`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );
    expect(response.status).toBe(303);
    expect(put).toHaveBeenCalledTimes(2);
    const savedReference = await store.getTypeReference(
      brand.businessSlug,
      "awareness",
    );
    expect(savedReference?.productionReferenceImageUrl).toContain(
      `/assets/businesses/${brand.businessSlug}/types/awareness/reference-`,
    );
    expect(savedReference?.referenceImageUrls).toHaveLength(2);
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
      referenceImageUrls: ["https://poster.example.com/assets/ref.png"],
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
    expect(html).not.toContain("Final ChatGPT Task Instruction");
    expect(html).not.toContain("Default poster rules");
    expect(html).not.toContain("Hex palette for LLM");
    expect(html).not.toContain("Permanent awareness style reference");
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
      business: Pick<BusinessBrandSystem, "businessSlug" | "businessName">;
      posterType: PosterType;
      posterReferenceImageUrls: string[];
      resolvedDate: string;
    };
    expect(response.status).toBe(200);
    expect(body.business.businessSlug).toBe(brand.businessSlug);
    expect(body.posterType).toBe("awareness");
    expect(body.posterReferenceImageUrls).toEqual([
      "https://example.com/type-ref.jpg",
    ]);
    expect(body.resolvedDate).toBe(today);
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
      referenceImageUrls: ["https://poster.example.com/assets/ref.png"],
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
                        mimeType: "image/jpeg",
                        data: "/9j/2w==",
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
    expect(body.generatedPoster.imageUrl).toMatch(
      new RegExp(
        `^https://poster\\.example\\.com/assets/businesses/${brand.businessSlug}/generated/awareness/${today}-\\d{17}\\.jpg$`,
      ),
    );
    expect(body.generatedPoster.prompt).toContain("Generation run id:");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const imageCall = fetchMock.mock.calls[1];
    expect(imageCall).toBeDefined();
    const imageCallBody = JSON.parse(String(imageCall?.[1]?.body));
    expect(String(imageCall?.[0])).toContain(
      "/v1/models/gemini-3.1-flash-image:generateContent",
    );
    expect(imageCallBody.generationConfig).toBeUndefined();
    expect(imageCallBody.contents[0].parts).toHaveLength(7);
    expect(JSON.stringify(imageCallBody.contents[0].parts)).toContain(
      "REFERENCE IMAGE: Original logo",
    );
    expect(JSON.stringify(imageCallBody.contents[0].parts)).toContain(
      "REFERENCE IMAGE: awareness poster style reference 1",
    );
    expect(JSON.stringify(imageCallBody.contents[0].parts)).toContain(
      "follow the editable reference-image instructions",
    );
    expect(env.ASSETS.get).toHaveBeenCalledTimes(3);
    expect(put).toHaveBeenCalledOnce();
  });

  it("can manually generate the daily brief before making the poster", async () => {
    env.GEMINI_API_KEY = "gemini-secret";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      angle: "Monsoon dental care",
                      headline: "Keep your smile fresh in the rains",
                    }),
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
      `/api/daily-brief/${brand.businessSlug}/awareness/today`,
      {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      },
      env,
    );
    const body = (await response.json()) as {
      model: string;
      dailyBrief: { angle: string };
      dailyBriefPrompt: string;
      imagePrompt: string;
    };

    expect(response.status).toBe(200);
    expect(body.model).toBe("gemini-3.5-flash");
    expect(body.dailyBrief.angle).toBe("Monsoon dental care");
    expect(body.dailyBriefPrompt).toContain("POSTER TYPE: DENTAL AWARENESS");
    expect(body.imagePrompt).toContain(
      "Create one complete 9:16 Instagram Story poster",
    );
    expect(body.imagePrompt).toContain(
      "TODAY'S CONTENT — CHANGE ONLY THESE CONTENT AREAS",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("generates a dashboard brief, renders an image from the edited prompt, and reuses it as a reference", async () => {
    store.brands.set(brand.businessSlug, {
      ...brand,
      logoUrl: "https://poster.example.com/assets/logo.png",
      brandReferenceBoardUrl: "https://poster.example.com/assets/board.png",
    });
    store.typeReferences.set(`${brand.businessSlug}:awareness`, {
      businessSlug: brand.businessSlug,
      posterType: "awareness",
      productionReferenceImageUrl: "https://poster.example.com/assets/ref.png",
      referenceImageUrls: ["https://poster.example.com/assets/ref.png"],
      notes: "Permanent awareness style reference",
    });
    env.GEMINI_API_KEY = "gemini-secret";
    const put = vi.fn().mockResolvedValue(undefined);
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
            usageMetadata: {
              promptTokenCount: 1000,
              candidatesTokenCount: 300,
              totalTokenCount: 1300,
            },
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
                        mimeType: "image/jpeg",
                        data: "/9j/2w==",
                      },
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 2000,
              candidatesTokenCount: 0,
              totalTokenCount: 2000,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const briefForm = new FormData();
    briefForm.set("posterType", "awareness");
    briefForm.set("date", today);
    const briefResponse = await app.request(
      `/admin/${brand.businessSlug}/generation-lab/brief`,
      { method: "POST", headers: { Cookie: cookie }, body: briefForm },
      env,
    );
    const briefBody = (await briefResponse.json()) as { imagePrompt: string };
    expect(briefResponse.status).toBe(200);
    expect(briefBody.imagePrompt).toContain(brand.businessName);

    const imageForm = new FormData();
    imageForm.set("posterType", "awareness");
    imageForm.set("date", today);
    imageForm.set("prompt", `${briefBody.imagePrompt}\nExtra debug note.`);
    imageForm.set(
      "briefJson",
      JSON.stringify({
        angle: "Monsoon dental care",
        headline: "Protect your smile this season",
      }),
    );
    const imageResponse = await app.request(
      `/admin/${brand.businessSlug}/generation-lab/image`,
      { method: "POST", headers: { Cookie: cookie }, body: imageForm },
      env,
    );
    const imageBody = (await imageResponse.json()) as {
      generatedPoster: GeneratedPoster;
    };
    expect(imageResponse.status).toBe(200);
    expect(imageBody.generatedPoster.status).toBe("ready");
    expect(imageBody.generatedPoster.costBreakdown?.totalUsd).toBeGreaterThan(
      0,
    );

    const referenceForm = new FormData();
    referenceForm.set("posterType", "awareness");
    referenceForm.set("date", today);
    referenceForm.set("imageUrl", imageBody.generatedPoster.imageUrl ?? "");
    const referenceResponse = await app.request(
      `/admin/${brand.businessSlug}/generated-reference`,
      { method: "POST", headers: { Cookie: cookie }, body: referenceForm },
      env,
    );
    expect(referenceResponse.status).toBe(303);
    expect(
      (await store.getTypeReference(brand.businessSlug, "awareness"))
        ?.referenceImageUrls,
    ).toContain(imageBody.generatedPoster.imageUrl);
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
      geminiTextModel: "gemini-3.5-flash",
      geminiImageModel: "gemini-3.1-flash-image",
      imageResolution: "1K",
      aspectRatio: "9:16",
      geminiJobName: null,
      briefUsage: null,
      imageUsage: null,
      costBreakdown: null,
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
