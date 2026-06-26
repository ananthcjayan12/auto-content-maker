import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { normalizeGenerationSettings } from "../src/gemini-models";
import { automationIsDue, runAutomationHeartbeat } from "../src/automation";
import {
  buildImagePrompt,
  imageGenerationConfig,
  imageUrlToBase64,
} from "../src/orchestrator";
import { defaultPromptSettings } from "../src/prompt-settings";
import type {
  Bindings,
  AutomationRun,
  AutomationSettings,
  BusinessBrandSystem,
  ContentCalendarEntry,
  ContentSourceSettings,
  DailyPosterPacket,
  GenerationSettings,
  GeneratedPoster,
  PosterStore,
  PosterPromptSettings,
  PosterTemplatePattern,
  PosterType,
  PosterTypeReference,
} from "../src/types";
import { todayInTimezone } from "../src/date";
import {
  findTodaySheetContent,
  googleSheetCsvUrl,
  resolveAwarenessContent,
} from "../src/content-sources";

class MemoryStore implements PosterStore {
  brands = new Map<string, BusinessBrandSystem>();
  packets = new Map<string, DailyPosterPacket>();
  typeReferences = new Map<string, PosterTypeReference>();
  generationSettings = new Map<string, GenerationSettings>();
  contentSourceSettings = new Map<string, ContentSourceSettings>();
  automationSettings = new Map<string, AutomationSettings>();
  automationRuns = new Map<string, AutomationRun>();
  calendarEntries = new Map<string, ContentCalendarEntry>();
  templatePatterns = new Map<string, PosterTemplatePattern>();
  promptSettings = new Map<string, PosterPromptSettings>();
  generatedPosters = new Map<string, GeneratedPoster>();

  private packetKey(slug: string, type: PosterType, date: string) {
    return `${slug}:${type}:${date}`;
  }

  private generatedPosterKey(
    slug: string,
    type: PosterType,
    date: string,
    languageCode = "en",
  ) {
    return `${slug}:${type}:${date}:${languageCode}`;
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

  async getContentSourceSettings(slug: string) {
    return this.contentSourceSettings.get(slug) ?? null;
  }

  async upsertContentSourceSettings(settings: ContentSourceSettings) {
    const saved = { ...settings, updatedAt: new Date().toISOString() };
    this.contentSourceSettings.set(settings.businessSlug, saved);
    return saved;
  }

  async getAutomationSettings(slug: string) {
    return this.automationSettings.get(slug) ?? null;
  }

  async upsertAutomationSettings(settings: AutomationSettings) {
    const saved = { ...settings, updatedAt: new Date().toISOString() };
    this.automationSettings.set(settings.businessSlug, saved);
    return saved;
  }

  async getCalendarEntry(slug: string, date: string) {
    return this.calendarEntries.get(`${slug}:${date}`) ?? null;
  }

  async listCalendarEntries(
    slug: string,
    options: { month?: string; from?: string; to?: string },
  ) {
    return [...this.calendarEntries.values()]
      .filter((entry) => {
        if (entry.businessSlug !== slug) return false;
        if (options.month) return entry.date.startsWith(options.month);
        if (options.from && entry.date < options.from) return false;
        if (options.to && entry.date > options.to) return false;
        return true;
      })
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async upsertCalendarEntry(entry: ContentCalendarEntry) {
    const saved = { ...entry, updatedAt: new Date().toISOString() };
    this.calendarEntries.set(`${entry.businessSlug}:${entry.date}`, saved);
    return saved;
  }

  async deleteCalendarEntry(slug: string, date: string) {
    this.calendarEntries.delete(`${slug}:${date}`);
  }

  private templatePatternKey(slug: string, templateId: string) {
    return `${slug}:${templateId}`;
  }

  async getTemplatePattern(slug: string, templateId: string) {
    return (
      this.templatePatterns.get(this.templatePatternKey(slug, templateId)) ??
      null
    );
  }

  async listTemplatePatterns(slug: string) {
    return [...this.templatePatterns.values()]
      .filter((pattern) => pattern.businessSlug === slug)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async upsertTemplatePattern(pattern: PosterTemplatePattern) {
    const saved = { ...pattern, updatedAt: new Date().toISOString() };
    this.templatePatterns.set(
      this.templatePatternKey(pattern.businessSlug, pattern.templateId),
      saved,
    );
    return saved;
  }

  async deleteTemplatePattern(slug: string, templateId: string) {
    this.templatePatterns.delete(this.templatePatternKey(slug, templateId));
  }

  async claimAutomationRun(slug: string, type: PosterType, date: string) {
    const key = this.packetKey(slug, type, date);
    if (this.automationRuns.has(key)) return false;
    this.automationRuns.set(key, {
      businessSlug: slug,
      posterType: type,
      date,
      status: "processing",
      deliveryStatus: "pending",
      imageUrl: null,
      providerMessageId: null,
      error: null,
    });
    return true;
  }

  async updateAutomationRun(run: AutomationRun) {
    const saved = { ...run, updatedAt: new Date().toISOString() };
    this.automationRuns.set(
      this.packetKey(run.businessSlug, run.posterType, run.date),
      saved,
    );
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

  async getGeneratedPoster(
    slug: string,
    type: PosterType,
    date: string,
    languageCode = "en",
  ) {
    return (
      this.generatedPosters.get(
        this.generatedPosterKey(slug, type, date, languageCode),
      ) ?? null
    );
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
      this.generatedPosterKey(
        poster.businessSlug,
        poster.posterType,
        poster.date,
        poster.languageCode ?? "en",
      ),
      saved,
    );
    return saved;
  }

  async deleteGeneratedPostersForDate(slug: string, date: string) {
    const deleted = [...this.generatedPosters.entries()]
      .filter(
        ([, poster]) => poster.businessSlug === slug && poster.date === date,
      )
      .map(([key, poster]) => {
        this.generatedPosters.delete(key);
        return poster;
      });
    return deleted;
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

  it("evaluates dashboard schedules in the business timezone", () => {
    const settings: AutomationSettings = {
      businessSlug: brand.businessSlug,
      enabled: true,
      localTime: "08:30",
      posterTypes: ["awareness"],
      forceGeneration: false,
      emailEnabled: false,
      recipientEmails: [],
    };
    expect(
      automationIsDue(
        settings,
        "Asia/Kolkata",
        new Date("2026-06-18T02:59:00.000Z"),
      ),
    ).toBe(false);
    expect(
      automationIsDue(
        settings,
        "Asia/Kolkata",
        new Date("2026-06-18T03:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("finds today's row in a shared Google Sheet CSV", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            'Date,Headline,Supporting Text\n18/06/2026,"Brush before bed","A small habit, every night"\n19/06/2026,Tomorrow,Later',
            { status: 200 },
          ),
        ),
    );
    expect(
      googleSheetCsvUrl(
        "https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=42",
      ),
    ).toBe(
      "https://docs.google.com/spreadsheets/d/sheet-id/gviz/tq?tqx=out:csv&gid=42",
    );
    await expect(
      findTodaySheetContent(
        "https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=42",
        today,
      ),
    ).resolves.toEqual({
      Date: "18/06/2026",
      Headline: "Brush before bed",
      "Supporting Text": "A small habit, every night",
    });
  });

  it("reports the exact reason when Google Sheets falls back to AI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unavailable", { status: 400 })),
    );
    await expect(
      resolveAwarenessContent(
        {
          businessSlug: brand.businessSlug,
          awarenessMode: "sheet_first",
          googleSheetUrl:
            "https://docs.google.com/spreadsheets/d/sheet-id/edit?usp=sharing",
        },
        today,
      ),
    ).resolves.toMatchObject({
      row: null,
      source: "ai_generated",
      reason: "sheet_fetch_failed",
      warning: expect.stringContaining("HTTP 400"),
    });
  });

  it("renders SaaS-style signup and login options on the homepage", async () => {
    const response = await app.request("/", {}, env);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Sign up");
    expect(html).toContain("Existing customer login");
    expect(html).toContain('name="businessSlug"');
    expect(html).toContain('name="token"');
    expect(html).not.toContain(`<option value="${brand.businessSlug}"`);
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
    expect(dashboard).toContain("Content studio");
    expect(dashboard).toContain("Save brand system");
    expect(dashboard).toContain("Save Awareness references");
    expect(dashboard).toContain("Save generation settings");
    expect(dashboard).toContain("Editable generation prompts");
    expect(dashboard).toContain("Daily generation flow");
    expect(dashboard).toContain("Create awareness poster");
    expect(dashboard).toContain("Awareness poster gallery");
    expect(dashboard).toContain("posterType=offer");
    expect(dashboard).toContain("posterType=review");
    expect(dashboard).toContain("posterType=reference");
    expect(dashboard).toContain(
      "References, prompts, gallery, and generation stay scoped",
    );

    const offerDashboardResponse = await app.request(
      `/admin/${brand.businessSlug}?posterType=offer&date=${today}`,
      { headers: { Cookie: cookie?.split(";")[0] ?? "" } },
      env,
    );
    const offerDashboard = await offerDashboardResponse.text();
    expect(offerDashboard).toContain("Working on: Offer");
    expect(offerDashboard).toContain("Save Offer references");
    expect(offerDashboard).toContain('name="posterType" value="offer"');
    expect(offerDashboard).toContain('class="card wide content-panel" hidden');

    const referenceDashboardResponse = await app.request(
      `/admin/${brand.businessSlug}?posterType=reference&date=${today}`,
      { headers: { Cookie: cookie?.split(";")[0] ?? "" } },
      env,
    );
    const referenceDashboard = await referenceDashboardResponse.text();
    expect(referenceDashboard).toContain("Working on: Reference remake");
    expect(referenceDashboard).toContain("Upload source poster");
    expect(referenceDashboard).toContain(
      "It controls layout, fonts, hierarchy, spacing, and visual treatment",
    );
  });

  it("shows logout and future tasks by default in the customer app", async () => {
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
    await store.upsertCalendarEntry({
      businessSlug: brand.businessSlug,
      date: "2026-06-10",
      topic: "Past task",
      message: "Past message",
      cta: null,
      posterMode: "normal",
      posterType: "general",
      templateId: null,
      inspirationImageUrl: null,
      notes: null,
      status: "planned",
    });
    await store.upsertCalendarEntry({
      businessSlug: brand.businessSlug,
      date: "2026-06-20",
      topic: "Future task",
      message: "Future message",
      cta: null,
      posterMode: "normal",
      posterType: "general",
      templateId: null,
      inspirationImageUrl: null,
      notes: null,
      status: "planned",
    });
    await store.upsertCalendarEntry({
      businessSlug: brand.businessSlug,
      date: today,
      topic: "Today task",
      message: "Today message",
      cta: null,
      posterMode: "normal",
      posterType: "general",
      templateId: null,
      inspirationImageUrl: null,
      notes: null,
      status: "poster_ready",
    });
    await store.upsertGeneratedPoster({
      businessSlug: brand.businessSlug,
      posterType: "general",
      date: today,
      languageCode: "ml",
      languageName: "Malayalam",
      status: "ready",
      contextUrl: "https://poster.example.com/daily-poster/context",
      contextJsonUrl: "https://poster.example.com/daily-poster/context.json",
      angle: "Today task",
      briefJson: null,
      prompt: null,
      imageUrl: "https://poster.example.com/today-poster-ml.png",
      imageContentType: "image/png",
      r2Key: null,
      geminiTextModel: null,
      geminiImageModel: null,
      imageResolution: null,
      aspectRatio: "9:16",
      geminiJobName: null,
      briefUsage: null,
      imageUsage: null,
      costBreakdown: null,
      validationErrors: [],
      failureReason: null,
    });
    await store.upsertGeneratedPoster({
      businessSlug: brand.businessSlug,
      posterType: "general",
      date: today,
      languageCode: "hi",
      languageName: "Hindi",
      status: "ready",
      contextUrl: "https://poster.example.com/daily-poster/context",
      contextJsonUrl: "https://poster.example.com/daily-poster/context.json",
      angle: "Today task",
      briefJson: null,
      prompt: null,
      imageUrl: "https://poster.example.com/today-poster-hi.png",
      imageContentType: "image/png",
      r2Key: null,
      geminiTextModel: null,
      geminiImageModel: null,
      imageResolution: null,
      aspectRatio: "9:16",
      geminiJobName: null,
      briefUsage: null,
      imageUsage: null,
      costBreakdown: null,
      validationErrors: [],
      failureReason: null,
    });
    await store.upsertGeneratedPoster({
      businessSlug: brand.businessSlug,
      posterType: "general",
      date: "2026-06-20",
      languageCode: "ml",
      languageName: "Malayalam",
      status: "ready",
      contextUrl: "https://poster.example.com/daily-poster/context",
      contextJsonUrl: "https://poster.example.com/daily-poster/context.json",
      angle: "Future task",
      briefJson: null,
      prompt: null,
      imageUrl: "https://poster.example.com/future-poster.png",
      imageContentType: "image/png",
      r2Key: null,
      geminiTextModel: null,
      geminiImageModel: null,
      imageResolution: null,
      aspectRatio: "9:16",
      geminiJobName: null,
      briefUsage: null,
      imageUsage: null,
      costBreakdown: null,
      validationErrors: [],
      failureReason: null,
    });
    await store.upsertGeneratedPoster({
      businessSlug: brand.businessSlug,
      posterType: "general",
      date: "2026-06-20",
      languageCode: "hi",
      languageName: "Hindi",
      status: "ready",
      contextUrl: "https://poster.example.com/daily-poster/context",
      contextJsonUrl: "https://poster.example.com/daily-poster/context.json",
      angle: "Future task",
      briefJson: null,
      prompt: null,
      imageUrl: "https://poster.example.com/future-poster-hi.png",
      imageContentType: "image/png",
      r2Key: null,
      geminiTextModel: null,
      geminiImageModel: null,
      imageResolution: null,
      aspectRatio: "9:16",
      geminiJobName: null,
      briefUsage: null,
      imageUsage: null,
      costBreakdown: null,
      validationErrors: [],
      failureReason: null,
    });

    const response = await app.request(
      `/app/${brand.businessSlug}?month=2026-06`,
      { headers: { Cookie: cookie } },
      env,
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Logout");
    expect(html).toContain("Future tasks");
    expect(html).toContain("Download Malayalam");
    expect(html).toContain("Download Hindi");
    expect(html).toContain("today-poster-hi.png");
    const taskSection =
      html.split("<!-- VIEW: TASKS")[1]?.split("<!-- VIEW: INSPIRATION")[0] ??
      "";
    expect(taskSection).toContain("Future task");
    expect(taskSection).not.toContain("Past message");
    expect(taskSection).toContain("Preview poster");
    expect(taskSection).toContain("Share poster");
    expect(taskSection).toContain("Regenerate poster");
    expect(taskSection).toContain("Delete");
    expect(taskSection).toContain("WhatsApp");
    expect(taskSection).toContain("Facebook");
    expect(taskSection).toContain("Malayalam");
    expect(taskSection).toContain("Hindi");
    expect(taskSection).toContain("future-poster-hi.png");

    const allResponse = await app.request(
      `/app/${brand.businessSlug}?month=2026-06&taskFilter=all`,
      { headers: { Cookie: cookie } },
      env,
    );
    const allHtml = await allResponse.text();
    const allTaskSection =
      allHtml
        .split("<!-- VIEW: TASKS")[1]
        ?.split("<!-- VIEW: INSPIRATION")[0] ?? "";
    expect(allTaskSection).toContain("Future task");
    expect(allTaskSection).toContain("Past message");
  });

  it("can generate period content, regenerate existing task content, and delete all tasks", async () => {
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

    const pageResponse = await app.request(
      `/app/${brand.businessSlug}?month=2026-06#calendar`,
      { headers: { Cookie: cookie } },
      env,
    );
    const html = await pageResponse.text();
    expect(html).toContain("Generate Content");
    expect(html).toContain("Regenerate Existing Content");
    expect(html).toContain("Delete All Tasks");

    const generateResponse = await app.request(
      `/app/${brand.businessSlug}/calendar/generate-period`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          fromDate: "2026-06-20",
          toDate: "2026-06-22",
          frequency: "daily",
          style: "educational",
          notes: "period focus",
          mode: "generate",
        }).toString(),
      },
      env,
    );
    expect(generateResponse.status).toBe(303);
    expect(generateResponse.headers.get("location")).toContain("#calendar");
    expect(
      await store.listCalendarEntries(brand.businessSlug, {
        from: "2026-06-20",
        to: "2026-06-22",
      }),
    ).toHaveLength(3);

    await store.upsertGeneratedPoster({
      businessSlug: brand.businessSlug,
      posterType: "general",
      date: "2026-06-20",
      languageCode: "en",
      languageName: "English",
      status: "ready",
      contextUrl: "https://poster.example.com/daily-poster/context",
      contextJsonUrl: "https://poster.example.com/daily-poster/context.json",
      angle: "Old poster",
      briefJson: null,
      prompt: null,
      imageUrl: "https://poster.example.com/old-poster.png",
      imageContentType: "image/png",
      r2Key: null,
      geminiTextModel: null,
      geminiImageModel: null,
      imageResolution: null,
      aspectRatio: "9:16",
      geminiJobName: null,
      briefUsage: null,
      imageUsage: null,
      costBreakdown: null,
      validationErrors: [],
      failureReason: null,
    });
    const beforePoster = await store.getGeneratedPoster(
      brand.businessSlug,
      "general",
      "2026-06-20",
    );

    const regenerateResponse = await app.request(
      `/app/${brand.businessSlug}/calendar/generate-period`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          fromDate: "2026-06-20",
          toDate: "2026-06-21",
          frequency: "daily",
          style: "promotional",
          notes: "regenerate task content only",
          mode: "regenerate-existing",
        }).toString(),
      },
      env,
    );
    expect(regenerateResponse.status).toBe(303);
    const regeneratedEntries = await store.listCalendarEntries(
      brand.businessSlug,
      {
        from: "2026-06-20",
        to: "2026-06-21",
      },
    );
    expect(regeneratedEntries).toHaveLength(2);
    expect(
      regeneratedEntries.every((entry) => entry.status === "planned"),
    ).toBe(true);
    expect(
      await store.getGeneratedPoster(
        brand.businessSlug,
        "general",
        "2026-06-20",
      ),
    ).toEqual(beforePoster);

    const deleteAllResponse = await app.request(
      `/app/${brand.businessSlug}/calendar/delete-all`,
      {
        method: "POST",
        headers: { Cookie: cookie },
      },
      env,
    );
    expect(deleteAllResponse.status).toBe(303);
    expect(
      await store.listCalendarEntries(brand.businessSlug, {
        from: "0000-01-01",
        to: "9999-12-31",
      }),
    ).toHaveLength(0);
    expect(
      await store.getGeneratedPoster(
        brand.businessSlug,
        "general",
        "2026-06-20",
      ),
    ).toBeNull();
  });

  it("regenerates one task content without changing its poster", async () => {
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
    await store.upsertCalendarEntry({
      businessSlug: brand.businessSlug,
      date: "2026-06-23",
      topic: "Old weak content",
      message: "Old message",
      cta: "Call now",
      posterMode: "normal",
      posterType: "general",
      templateId: null,
      inspirationImageUrl: null,
      notes: "keep it useful",
      status: "poster_ready",
    });
    await store.upsertGeneratedPoster({
      businessSlug: brand.businessSlug,
      posterType: "general",
      date: "2026-06-23",
      languageCode: "en",
      languageName: "English",
      status: "ready",
      contextUrl: "https://poster.example.com/daily-poster/context",
      contextJsonUrl: "https://poster.example.com/daily-poster/context.json",
      angle: "Old weak content",
      briefJson: null,
      prompt: null,
      imageUrl: "https://poster.example.com/existing-poster.png",
      imageContentType: "image/png",
      r2Key: null,
      geminiTextModel: null,
      geminiImageModel: null,
      imageResolution: null,
      aspectRatio: "9:16",
      geminiJobName: null,
      briefUsage: null,
      imageUsage: null,
      costBreakdown: null,
      validationErrors: [],
      failureReason: null,
    });
    const beforePoster = await store.getGeneratedPoster(
      brand.businessSlug,
      "general",
      "2026-06-23",
    );

    const response = await app.request(
      `/app/${brand.businessSlug}/calendar/regenerate-content`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          date: "2026-06-23",
          topic: "Old weak content",
          message: "Old message",
          posterMode: "normal",
          posterType: "general",
          notes: "keep it useful",
        }).toString(),
      },
      env,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("#edit-2026-06-23");
    expect(
      await store.getCalendarEntry(brand.businessSlug, "2026-06-23"),
    ).toMatchObject({
      topic: "Useful tip for customers",
      status: "planned",
    });
    expect(
      await store.getGeneratedPoster(
        brand.businessSlug,
        "general",
        "2026-06-23",
      ),
    ).toEqual(beforePoster);
  });

  it("deletes a task together with generated poster variants for that date", async () => {
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
    await store.upsertCalendarEntry({
      businessSlug: brand.businessSlug,
      date: "2026-06-24",
      topic: "Delete me",
      message: "Delete message",
      cta: null,
      posterMode: "normal",
      posterType: "general",
      templateId: null,
      inspirationImageUrl: null,
      notes: null,
      status: "poster_ready",
    });
    for (const [languageCode, languageName] of [
      ["en", "English"],
      ["ml", "Malayalam"],
    ] as const) {
      await store.upsertGeneratedPoster({
        businessSlug: brand.businessSlug,
        posterType: "general",
        date: "2026-06-24",
        languageCode,
        languageName,
        status: "ready",
        contextUrl: "https://poster.example.com/daily-poster/context",
        contextJsonUrl: "https://poster.example.com/daily-poster/context.json",
        angle: "Delete me",
        briefJson: null,
        prompt: null,
        imageUrl: `https://poster.example.com/${languageCode}.png`,
        imageContentType: "image/png",
        r2Key: null,
        geminiTextModel: null,
        geminiImageModel: null,
        imageResolution: null,
        aspectRatio: "9:16",
        geminiJobName: null,
        briefUsage: null,
        imageUsage: null,
        costBreakdown: null,
        validationErrors: [],
        failureReason: null,
      });
    }

    const response = await app.request(
      `/app/${brand.businessSlug}/calendar/delete`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ date: "2026-06-24" }).toString(),
      },
      env,
    );

    expect(response.status).toBe(303);
    expect(
      await store.getCalendarEntry(brand.businessSlug, "2026-06-24"),
    ).toBeNull();
    expect(
      await store.getGeneratedPoster(
        brand.businessSlug,
        "general",
        "2026-06-24",
      ),
    ).toBeNull();
    expect(
      await store.getGeneratedPoster(
        brand.businessSlug,
        "general",
        "2026-06-24",
        "ml",
      ),
    ).toBeNull();
  });

  it("saves multilingual typography guidance from customer settings", async () => {
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

    const settingsPage = await app.request(
      `/app/${brand.businessSlug}`,
      {
        headers: { Cookie: cookie },
      },
      env,
    );
    expect(await settingsPage.text()).toContain("Languages & typography");

    const form = new FormData();
    form.set("enabled", "on");
    form.set("localTime", "08:30");
    form.set("recipientEmails", "");
    form.set("languageTypographyEnabled", "on");
    form.set("languageCount", "2");
    form.set("languageName_0", "Malayalam");
    form.set("languageRole_0", "primary");
    form.set("languageEnabled_0", "on");
    form.set(
      "existingLanguageReferenceImageUrl_0",
      "https://poster.example.com/assets/businesses/dr-poojas-smile-craft/brand/ml-font.png",
    );
    form.set(
      "languageStyleProfile_0",
      "Bold rounded Malayalam display lettering with thick strokes and soft curves.",
    );
    form.set("languageName_1", "Hindi");
    form.set("languageRole_1", "secondary");
    form.set("languageEnabled_1", "on");
    form.set(
      "existingLanguageReferenceImageUrl_1",
      "https://poster.example.com/assets/businesses/dr-poojas-smile-craft/brand/hi-font.png",
    );
    form.set("languageStyleProfile_1", "Clean Devanagari display lettering.");
    form.set("useReferenceForAllPosters", "on");

    const response = await app.request(
      `/app/${brand.businessSlug}/settings`,
      {
        method: "POST",
        headers: { Cookie: cookie },
        body: form,
      },
      env,
    );

    expect(response.status).toBe(303);
    expect(await store.getBrand(brand.businessSlug)).toMatchObject({
      languageTypography: {
        enabled: true,
        primaryLanguage: "Malayalam",
        additionalLanguages: ["Hindi"],
        typographyReferenceImageUrl:
          "https://poster.example.com/assets/businesses/dr-poojas-smile-craft/brand/ml-font.png",
        typographyStyleProfile:
          "Bold rounded Malayalam display lettering with thick strokes and soft curves.",
        useReferenceForAllPosters: true,
        profiles: [
          {
            language: "Malayalam",
            role: "primary",
            referenceImageUrl:
              "https://poster.example.com/assets/businesses/dr-poojas-smile-craft/brand/ml-font.png",
            styleProfile:
              "Bold rounded Malayalam display lettering with thick strokes and soft curves.",
            enabled: true,
          },
          {
            language: "Hindi",
            role: "secondary",
            referenceImageUrl:
              "https://poster.example.com/assets/businesses/dr-poojas-smile-craft/brand/hi-font.png",
            styleProfile: "Clean Devanagari display lettering.",
            enabled: true,
          },
        ],
      },
    });
  });

  it("renders customer settings when language typography JSON is partial", async () => {
    store.brands.set(brand.businessSlug, {
      ...brand,
      languageTypography: {} as BusinessBrandSystem["languageTypography"],
    });
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
      `/app/${brand.businessSlug}`,
      { headers: { Cookie: cookie } },
      env,
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Languages & typography");
    expect(html).toContain('id="language-card-grid"');
    expect(html).toContain('name="languageName_0" value="English"');
  });

  it("generates every enabled language from the customer task action", async () => {
    store.brands.set(brand.businessSlug, {
      ...brand,
      logoUrl: "https://poster.example.com/assets/logo.png",
      brandReferenceBoardUrl: "https://poster.example.com/assets/board.png",
      languageTypography: {
        enabled: true,
        primaryLanguage: "Malayalam",
        additionalLanguages: ["Hindi"],
        typographyReferenceImageUrl:
          "https://poster.example.com/assets/ml-typography.png",
        typographyStyleProfile: "Rounded Malayalam display lettering.",
        useReferenceForAllPosters: true,
        profiles: [
          {
            language: "Malayalam",
            role: "primary",
            referenceImageUrl:
              "https://poster.example.com/assets/ml-typography.png",
            styleProfile: "Rounded Malayalam display lettering.",
            enabled: true,
          },
          {
            language: "Hindi",
            role: "secondary",
            referenceImageUrl:
              "https://poster.example.com/assets/hi-typography.png",
            styleProfile: "Clean Devanagari display lettering.",
            enabled: true,
          },
        ],
      },
    });
    await store.upsertCalendarEntry({
      businessSlug: brand.businessSlug,
      date: "2026-06-20",
      topic: "Future task",
      message: "Future message",
      cta: null,
      posterMode: "normal",
      posterType: "general",
      templateId: null,
      inspirationImageUrl: null,
      notes: null,
      status: "planned",
    });
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
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "{}" }] } }],
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
                        inlineData: { mimeType: "image/png", data: "iVBORw==" },
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
              candidates: [{ content: { parts: [{ text: "{}" }] } }],
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
                        inlineData: { mimeType: "image/png", data: "iVBORw==" },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
    );

    const response = await app.request(
      `/app/${brand.businessSlug}/calendar/generate-poster`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ date: "2026-06-20" }).toString(),
      },
      env,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("generation=started");
    for (let index = 0; index < 200; index += 1) {
      await Promise.resolve();
      const poster = await store.getGeneratedPoster(
        brand.businessSlug,
        "general",
        "2026-06-20",
        "hi",
      );
      if (poster?.status === "ready") break;
    }
    expect(
      await store.getGeneratedPoster(
        brand.businessSlug,
        "general",
        "2026-06-20",
        "ml",
      ),
    ).toMatchObject({
      status: "ready",
      languageName: "Malayalam",
    });
    expect(
      await store.getGeneratedPoster(
        brand.businessSlug,
        "general",
        "2026-06-20",
        "hi",
      ),
    ).toMatchObject({
      status: "ready",
      languageName: "Hindi",
    });
    expect(put).toHaveBeenCalledTimes(2);
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

  it("onboards a new customer through brand, plan, and activation steps", async () => {
    const createResponse = await app.request(
      "/onboarding/business",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          businessName: "Glow Studio",
          category: "Software service",
          phone: "+91 99999 88888",
          websiteUrl: "@glowstudio",
          country: "India",
          timezone: "Asia/Kolkata",
          token: "test-secret",
        }).toString(),
      },
      env,
    );

    expect(createResponse.status).toBe(303);
    expect(createResponse.headers.get("location")).toContain(
      "/onboarding/glow-studio/brand",
    );
    const cookie =
      createResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    const created = await store.getBrand("glow-studio");
    expect(created).toMatchObject({
      businessName: "Glow Studio",
      phone: "+91 99999 88888",
      websiteUrl: "https://instagram.com/glowstudio",
    });
    expect(created?.defaultPosterRules).toContain(
      "Create content suitable for Software service.",
    );

    const brandForm = new FormData();
    brandForm.set("primary", "#c026d3");
    brandForm.set("secondary", "#fdf4ff");
    brandForm.set("accent", "#facc15");
    brandForm.set("darkText", "#18181b");
    brandForm.set("mutedText", "#71717a");
    brandForm.set("style", "minimal");
    brandForm.set("notes", "premium salon visuals");
    const brandResponse = await app.request(
      "/onboarding/glow-studio/brand",
      { method: "POST", headers: { Cookie: cookie }, body: brandForm },
      env,
    );
    expect(brandResponse.status).toBe(303);
    expect(brandResponse.headers.get("location")).toContain(
      "/onboarding/glow-studio/sample",
    );
    expect((await store.getBrand("glow-studio"))?.colors).toMatchObject({
      primary: "#c026d3",
      secondary: "#fdf4ff",
      accent: "#facc15",
      darkText: "#18181b",
      mutedText: "#71717a",
    });
    expect(await store.listTemplatePatterns("glow-studio")).toHaveLength(0);

    const editResponse = await app.request(
      "/onboarding/glow-studio/business",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          businessName: "Glow Studio Labs",
          category: "Design service",
          phone: "+91 99999 77777",
          websiteUrl: "glow.example",
          country: "India",
          timezone: "Asia/Kolkata",
        }).toString(),
      },
      env,
    );
    expect(editResponse.status).toBe(303);
    expect(await store.getBrand("glow-studio")).toMatchObject({
      businessName: "Glow Studio Labs",
      phone: "+91 99999 77777",
      websiteUrl: "https://glow.example",
    });
    expect((await store.getBrand("glow-studio"))?.defaultPosterRules).toContain(
      "Create content suitable for Design service.",
    );

    const sampleContentResponse = await app.request(
      "/onboarding/glow-studio/sample-content",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          date: today,
          contentStyle: "educational",
          contentNotes: "brand identity package",
        }).toString(),
      },
      env,
    );
    expect(sampleContentResponse.status).toBe(303);
    expect(await store.getCalendarEntry("glow-studio", today)).toMatchObject({
      topic: expect.stringContaining("Design"),
      posterType: "general",
    });

    const planResponse = await app.request(
      "/onboarding/glow-studio/plan",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          month: "2026-06",
          frequency: "weekdays",
          style: "mixed",
          notes: "focus on hair care and booking reminders",
        }).toString(),
      },
      env,
    );
    expect(planResponse.status).toBe(303);
    const generatedEntries = await store.listCalendarEntries("glow-studio", {
      month: "2026-06",
    });
    expect(generatedEntries).not.toHaveLength(0);
    expect(generatedEntries.every((entry) => entry.date >= today)).toBe(true);

    const activateResponse = await app.request(
      "/onboarding/glow-studio/activate",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          enabled: "on",
          localTime: "08:00",
          recipientEmails: "owner@example.com",
        }).toString(),
      },
      env,
    );
    expect(activateResponse.status).toBe(303);
    expect(activateResponse.headers.get("location")).toContain(
      "/app/glow-studio",
    );
    expect(await store.getAutomationSettings("glow-studio")).toMatchObject({
      enabled: true,
      localTime: "08:00",
      posterTypes: ["general"],
      emailEnabled: false,
      recipientEmails: ["owner@example.com"],
    });
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

  it("saves the awareness Google Sheet-first option", async () => {
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
    form.set("awarenessMode", "sheet_first");
    form.set(
      "googleSheetUrl",
      "https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=0",
    );
    const response = await app.request(
      `/admin/${brand.businessSlug}/content-sources`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );
    expect(response.status).toBe(303);
    expect(
      await store.getContentSourceSettings(brand.businessSlug),
    ).toMatchObject({
      awarenessMode: "sheet_first",
      googleSheetUrl:
        "https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=0",
    });
  });

  it("saves multi-type automation and email settings from the dashboard", async () => {
    env.RESEND_API_KEY = "re_test";
    env.POSTER_FROM_EMAIL = "Posters <posters@mail.example.com>";
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
    form.set("enabled", "on");
    form.set("localTime", "08:45");
    form.append("posterTypes", "awareness");
    form.append("posterTypes", "festival");
    form.append("posterTypes", "review");
    form.set("forceGeneration", "on");
    form.set("emailEnabled", "on");
    form.set("recipientEmails", "owner@example.com, manager@example.com");
    const response = await app.request(
      `/admin/${brand.businessSlug}/automation-settings`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );
    expect(response.status).toBe(303);
    expect(await store.getAutomationSettings(brand.businessSlug)).toMatchObject(
      {
        enabled: true,
        localTime: "08:45",
        posterTypes: ["awareness", "festival"],
        forceGeneration: true,
        emailEnabled: true,
        recipientEmails: ["owner@example.com", "manager@example.com"],
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

  it("keeps an independent reference library for every poster type", async () => {
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

    const offerForm = new FormData();
    offerForm.set("posterType", "offer");
    offerForm.set("date", today);
    offerForm.set("notes", "Offer-specific visual style.");
    offerForm.append(
      "typeReferenceFiles",
      new File(["offer"], "offer-reference.png", { type: "image/png" }),
    );
    const offerResponse = await app.request(
      `/admin/${brand.businessSlug}/type-reference`,
      { method: "POST", headers: { Cookie: cookie }, body: offerForm },
      env,
    );
    expect(offerResponse.status).toBe(303);
    expect(
      (await store.getTypeReference(brand.businessSlug, "offer"))
        ?.referenceImageUrls[0],
    ).toContain(`/types/offer/reference-`);
    expect(
      (await store.getTypeReference(brand.businessSlug, "awareness"))
        ?.referenceImageUrls,
    ).toHaveLength(2);
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

  it("skips SVG placeholders when preparing image references", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<svg></svg>", {
          status: 200,
          headers: { "content-type": "image/svg+xml; charset=utf-8" },
        }),
      ),
    );

    await expect(
      imageUrlToBase64({
        url: "/onboarding-assets/placeholder-logo.svg",
        env,
        publicBaseUrl: "https://poster.example.com",
      }),
    ).resolves.toBeNull();
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
      languageTypography: {
        enabled: true,
        primaryLanguage: "Malayalam",
        additionalLanguages: ["Hindi"],
        typographyReferenceImageUrl:
          "https://poster.example.com/assets/ml-typography.png",
        typographyStyleProfile: "Rounded Malayalam display lettering.",
        useReferenceForAllPosters: true,
        profiles: [
          {
            language: "Malayalam",
            role: "primary",
            referenceImageUrl:
              "https://poster.example.com/assets/ml-typography.png",
            styleProfile: "Rounded Malayalam display lettering.",
            enabled: true,
          },
          {
            language: "Hindi",
            role: "secondary",
            referenceImageUrl:
              "https://poster.example.com/assets/hi-typography.png",
            styleProfile: "Clean Devanagari display lettering.",
            enabled: true,
          },
        ],
      },
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
    expect(html).toContain("Language & Typography Guidance");
    expect(html).toContain("Additional languages");
    expect(html).toContain("Hindi");
    expect(html).toContain("Malayalam typography reference image base64");
    expect(html).toContain("Hindi typography reference image base64");
    expect(html).toContain("iVBORw==");
    expect(html).not.toContain("Final ChatGPT Task Instruction");
    expect(html).not.toContain("Default poster rules");
    expect(html).not.toContain("Hex palette for LLM");
    expect(html).not.toContain("Permanent awareness style reference");
    expect(html).toContain('content="noindex"');
    expect(env.ASSETS.get).toHaveBeenCalledTimes(5);
  });

  it("returns stable brand context JSON without requiring a daily packet", async () => {
    store.packets.clear();
    store.brands.set(brand.businessSlug, {
      ...brand,
      languageTypography: {
        enabled: true,
        primaryLanguage: "Malayalam",
        additionalLanguages: ["Hindi"],
        typographyReferenceImageUrl:
          "https://poster.example.com/assets/ml-typography.png",
        typographyStyleProfile: "Rounded Malayalam display lettering.",
        useReferenceForAllPosters: true,
        profiles: [
          {
            language: "Malayalam",
            role: "primary",
            referenceImageUrl:
              "https://poster.example.com/assets/ml-typography.png",
            styleProfile: "Rounded Malayalam display lettering.",
            enabled: true,
          },
          {
            language: "Hindi",
            role: "secondary",
            referenceImageUrl:
              "https://poster.example.com/assets/hi-typography.png",
            styleProfile: "Clean Devanagari display lettering.",
            enabled: true,
          },
        ],
      },
    });
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
      languageTypography: NonNullable<
        BusinessBrandSystem["languageTypography"]
      >;
    };
    expect(response.status).toBe(200);
    expect(body.business.businessSlug).toBe(brand.businessSlug);
    expect(body.posterType).toBe("awareness");
    expect(body.posterReferenceImageUrls).toEqual([
      "https://example.com/type-ref.jpg",
    ]);
    expect(body.languageTypography).toMatchObject({
      enabled: true,
      primaryLanguage: "Malayalam",
      additionalLanguages: ["Hindi"],
      profiles: [
        {
          language: "Malayalam",
          role: "primary",
          referenceImageUrl:
            "https://poster.example.com/assets/ml-typography.png",
        },
        {
          language: "Hindi",
          role: "secondary",
          referenceImageUrl:
            "https://poster.example.com/assets/hi-typography.png",
        },
      ],
    });
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
      languageTypography: {
        enabled: true,
        primaryLanguage: "Malayalam",
        additionalLanguages: ["Hindi"],
        typographyReferenceImageUrl:
          "https://poster.example.com/assets/typography-reference.png",
        typographyStyleProfile:
          "Bold rounded Malayalam display lettering with thick soft strokes.",
        useReferenceForAllPosters: true,
      },
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        angle: "Monsoon dental care Hindi",
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
      generatedPosters: GeneratedPoster[];
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.generatedPoster.status).toBe("ready");
    expect(body.generatedPoster.angle).toBe("Monsoon dental care");
    expect(body.generatedPoster.imageUrl).toMatch(
      new RegExp(
        `^https://poster\\.example\\.com/assets/businesses/${brand.businessSlug}/generated/awareness/${today}-ml-\\d{17}\\.jpg$`,
      ),
    );
    expect(body.generatedPoster.languageCode).toBe("ml");
    expect(body.generatedPosters.map((poster) => poster.languageCode)).toEqual([
      "ml",
      "hi",
    ]);
    expect(body.generatedPoster.prompt).toContain("Generation run id:");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const imageCall = fetchMock.mock.calls[1];
    expect(imageCall).toBeDefined();
    const imageCallBody = JSON.parse(String(imageCall?.[1]?.body));
    expect(String(imageCall?.[0])).toContain(
      "/v1/models/gemini-3.1-flash-image:generateContent",
    );
    expect(imageCallBody.generationConfig).toBeUndefined();
    expect(imageCallBody.contents[0].parts).toHaveLength(9);
    expect(JSON.stringify(imageCallBody.contents[0].parts)).toContain(
      "REFERENCE IMAGE: Original logo",
    );
    expect(JSON.stringify(imageCallBody.contents[0].parts)).toContain(
      "REFERENCE IMAGE: Typography reference for multilingual poster text",
    );
    expect(body.generatedPoster.prompt).toContain(
      "Primary poster language: Malayalam",
    );
    expect(JSON.stringify(imageCallBody.contents[0].parts)).toContain(
      "REFERENCE IMAGE: awareness poster style reference 1",
    );
    expect(JSON.stringify(imageCallBody.contents[0].parts)).toContain(
      "follow the editable reference-image instructions",
    );
    expect(
      (
        await store.getGeneratedPoster(
          brand.businessSlug,
          "awareness",
          today,
          "hi",
        )
      )?.languageName,
    ).toBe("Hindi");
    expect(env.ASSETS.get).toHaveBeenCalledTimes(8);
    expect(put).toHaveBeenCalledTimes(2);
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

  it("lets a source poster override brand layout and typography for reference remakes", () => {
    const prompt = buildImagePrompt({
      brand,
      posterType: "reference",
      typeReference: {
        businessSlug: brand.businessSlug,
        posterType: "reference",
        productionReferenceImageUrl: "https://example.com/source.png",
        referenceImageUrls: ["https://example.com/source.png"],
        notes: "Create a whitening consultation poster.",
      },
      date: today,
      brief: {
        headline: "A brighter smile starts with a consultation",
        cta: "Book now",
      },
      contextUrl: "https://example.com/context",
      runId: "reference-test",
      settings: normalizeGenerationSettings({
        businessSlug: brand.businessSlug,
        textModel: "gemini-3.5-flash",
        imageModel: "gemini-3.1-flash-image",
        imageResolution: "1K",
        aspectRatio: "9:16",
      }),
      promptSettings: defaultPromptSettings(brand.businessSlug),
    });

    expect(prompt).toContain("REFERENCE REMAKE MODE");
    expect(prompt).toContain(
      "uploaded reference poster is the source of truth",
    );
    expect(prompt).toContain(
      "Ignore its fonts, layout, spacing, image treatment, and composition",
    );
    expect(prompt).toContain("POSTER TYPE: REFERENCE REMAKE");
  });

  it("requires a source poster before preparing a reference remake", async () => {
    env.GEMINI_API_KEY = "gemini-secret";
    const response = await app.request(
      `/api/daily-brief/${brand.businessSlug}/reference/today`,
      {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      },
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(
      "Upload at least one source poster",
    );
  });

  it("uses the user's one-line message or falls back to the source poster idea", async () => {
    env.GEMINI_API_KEY = "gemini-secret";
    env.ASSETS = {
      get: vi.fn().mockResolvedValue({
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
        writeHttpMetadata: (headers: Headers) =>
          headers.set("content-type", "image/png"),
      }),
    } as unknown as R2Bucket;
    await store.upsertTypeReference({
      businessSlug: brand.businessSlug,
      posterType: "reference",
      productionReferenceImageUrl: `/assets/businesses/${brand.businessSlug}/types/reference/source.png`,
      referenceImageUrls: [
        `/assets/businesses/${brand.businessSlug}/types/reference/source.png`,
      ],
      notes: null,
    });
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        headline: "Comfortable root canal care",
                        cta: "Book a consultation",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
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

    const userMessageForm = new FormData();
    userMessageForm.set("posterType", "reference");
    userMessageForm.set("date", today);
    userMessageForm.set(
      "referenceMessage",
      "Promote painless root canal treatment and invite consultation bookings.",
    );
    const userMessageResponse = await app.request(
      `/admin/${brand.businessSlug}/generation-lab/brief`,
      {
        method: "POST",
        headers: { Cookie: cookie },
        body: userMessageForm,
      },
      env,
    );
    const userMessageBody = (await userMessageResponse.json()) as {
      contentSource: string;
      dailyBriefPrompt: string;
      dailyBrief: Record<string, unknown>;
    };
    expect(userMessageResponse.status).toBe(200);
    expect(userMessageBody.contentSource).toBe("user_message");
    expect(userMessageBody.dailyBrief.suppliedReferenceMessage).toContain(
      "painless root canal",
    );
    expect(userMessageBody.dailyBriefPrompt).toContain(
      "USER'S POSTER MESSAGE — PRIMARY CONTENT SOURCE",
    );
    expect(userMessageBody.dailyBriefPrompt).toContain(
      "do not replace it with an AI-chosen topic",
    );

    const fallbackForm = new FormData();
    fallbackForm.set("posterType", "reference");
    fallbackForm.set("date", today);
    const fallbackResponse = await app.request(
      `/admin/${brand.businessSlug}/generation-lab/brief`,
      {
        method: "POST",
        headers: { Cookie: cookie },
        body: fallbackForm,
      },
      env,
    );
    const fallbackBody = (await fallbackResponse.json()) as {
      contentSource: string;
      dailyBriefPrompt: string;
    };
    expect(fallbackResponse.status).toBe(200);
    expect(fallbackBody.contentSource).toBe("reference_poster");
    expect(fallbackBody.dailyBriefPrompt).toContain(
      "SOURCE POSTER CONTENT FALLBACK",
    );
    const fallbackGeminiBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    );
    expect(fallbackGeminiBody.contents[0].parts[1].inline_data.mime_type).toBe(
      "image/png",
    );
  });

  it("grounds a review brief in an uploaded customer screenshot", async () => {
    env.GEMINI_API_KEY = "gemini-secret";
    env.ASSETS = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
        writeHttpMetadata: (headers: Headers) =>
          headers.set("content-type", "image/png"),
      }),
    } as unknown as R2Bucket;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      angle: "Patient experience",
                      reviewQuote: "Wonderful and gentle care",
                      reviewAttribution: "A patient",
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
    form.set("posterType", "review");
    form.set("date", today);
    form.set(
      "reviewScreenshot",
      new File([new Uint8Array([1, 2, 3])], "review.png", {
        type: "image/png",
      }),
    );
    const response = await app.request(
      `/admin/${brand.businessSlug}/generation-lab/brief`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );
    const body = (await response.json()) as {
      dailyBrief: Record<string, unknown>;
    };
    expect(response.status).toBe(200);
    expect(body.dailyBrief.reviewQuote).toBe("");
    expect(body.dailyBrief.reviewAttribution).toBe("");
    expect(body.dailyBrief.reviewScreenshotUrl).toMatch(
      /\/assets\/businesses\/dr-poojas-smile-craft\/reviews\//,
    );
    const geminiBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(geminiBody.contents[0].parts[1].inline_data.mime_type).toBe(
      "image/png",
    );
    expect(String(geminiBody.contents[0].parts[0].text)).toContain(
      "Do not extract, transcribe, paraphrase, or repeat",
    );
    expect(String(geminiBody.contents[0].parts[0].text)).toContain(
      "Another reason to smile",
    );
    const savedReviewPrompt = String(
      (await store.getGeneratedPoster(brand.businessSlug, "review", today))
        ?.prompt,
    );
    expect(savedReviewPrompt).toContain(
      "REVIEW SCREENSHOT — PRIMARY TESTIMONIAL CONTENT",
    );
    expect(savedReviewPrompt).toContain(
      "Place the attached customer review screenshot prominently",
    );
    expect(savedReviewPrompt).toContain(
      "Add one short, warm clinic-owned social-proof headline",
    );
  });

  it("accepts a pasted review message without requiring a screenshot", async () => {
    env.GEMINI_API_KEY = "gemini-secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reviewQuote: "The doctor explained everything clearly.",
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
    form.set("posterType", "review");
    form.set("date", today);
    form.set("reviewMessage", "The doctor explained everything clearly.");
    const response = await app.request(
      `/admin/${brand.businessSlug}/generation-lab/brief`,
      { method: "POST", headers: { Cookie: cookie }, body: form },
      env,
    );
    const body = (await response.json()) as {
      dailyBrief: Record<string, unknown>;
    };
    expect(response.status).toBe(200);
    expect(body.dailyBrief.suppliedReviewMessage).toBe(
      "The doctor explained everything clearly.",
    );
    const geminiBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(geminiBody.contents[0].parts).toHaveLength(1);
    expect(geminiBody.contents[0].parts[0].text).toContain(
      "SUPPLIED CUSTOMER REVIEW MESSAGE",
    );
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

  it("emails a ready scheduled poster once and records delivery", async () => {
    const readyPoster: GeneratedPoster = {
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
    };
    await store.upsertGeneratedPoster(readyPoster);
    await store.upsertAutomationSettings({
      businessSlug: brand.businessSlug,
      enabled: true,
      localTime: "08:30",
      posterTypes: ["awareness"],
      forceGeneration: false,
      emailEnabled: true,
      recipientEmails: ["owner@example.com"],
    });
    env.RESEND_API_KEY = "re_test";
    env.POSTER_FROM_EMAIL = "Posters <posters@mail.example.com>";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await runAutomationHeartbeat({
      env,
      store,
      businessSlug: brand.businessSlug,
      requestUrl: "https://poster.example.com/__scheduled",
      now: new Date("2026-06-18T03:00:00.000Z"),
    });
    const second = await runAutomationHeartbeat({
      env,
      store,
      businessSlug: brand.businessSlug,
      requestUrl: "https://poster.example.com/__scheduled",
      now: new Date("2026-06-18T03:05:00.000Z"),
    });

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      status: "ready",
      deliveryStatus: "sent",
      providerMessageId: "email_123",
    });
    expect(second).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const resendRequest = fetchMock.mock.calls[0];
    expect(String(resendRequest?.[0])).toBe("https://api.resend.com/emails");
    const resendBody = JSON.parse(String(resendRequest?.[1]?.body));
    expect(resendBody.to).toEqual(["owner@example.com"]);
    expect(resendBody.html).toContain("Request rework");
    const reworkUrl = String(resendBody.html).match(
      /https:\/\/poster\.example\.com\/app\/[^"]+poster-rework[^"]+/,
    )?.[0];
    expect(reworkUrl).toBeTruthy();
    const reworkResponse = await app.request(
      reworkUrl!.replaceAll("&amp;", "&"),
      {},
      env,
    );
    const reworkHtml = await reworkResponse.text();
    expect(reworkResponse.status).toBe(200);
    expect(reworkHtml).toContain("Request poster rework");
    expect(reworkHtml).toContain("Correction notes");
    expect(resendBody.attachments[0]).toEqual({
      path: readyPoster.imageUrl,
      filename: `smile-craft-awareness-${today}.png`,
    });
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
