import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import type {
  Bindings,
  BusinessBrandSystem,
  DailyPosterPacket,
  PosterStore,
  PosterType,
} from "../src/types";
import { todayInTimezone } from "../src/date";

class MemoryStore implements PosterStore {
  brands = new Map<string, BusinessBrandSystem>();
  packets = new Map<string, DailyPosterPacket>();

  private packetKey(slug: string, type: PosterType, date: string) {
    return `${slug}:${type}:${date}`;
  }

  async getBrand(slug: string) {
    return this.brands.get(slug) ?? null;
  }

  async upsertBrand(brand: BusinessBrandSystem) {
    const saved = { ...brand, updatedAt: new Date().toISOString() };
    this.brands.set(brand.businessSlug, saved);
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
    env = {
      DB: {} as D1Database,
      TEST_STORE: store,
      POSTER_ADMIN_TOKEN: "test-secret",
      PUBLIC_BASE_URL: "https://poster.example.com",
      BUSINESS_TIMEZONE: "Asia/Kolkata",
    };
  });

  it("resolves today in Asia/Kolkata", () => {
    expect(
      todayInTimezone("Asia/Kolkata", new Date("2026-06-17T20:00:00.000Z")),
    ).toBe("2026-06-18");
  });

  it("renders the public page with visible packet context", async () => {
    const response = await app.request(
      `/daily-poster/${brand.businessSlug}/awareness/today`,
      {},
      env,
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(brand.businessName);
    expect(html).toContain("A Cleaner Smile Starts Here");
    expect(html).toContain("<img");
    expect(html).toContain("Final ChatGPT Task Instruction");
    expect(html).toContain("noindex, nofollow");
  });

  it("returns combined brand and packet JSON", async () => {
    const response = await app.request(
      `/daily-poster/${brand.businessSlug}/awareness/today.json`,
      {},
      env,
    );
    const body = (await response.json()) as {
      businessBrandSystem: BusinessBrandSystem;
      dailyPosterPacket: DailyPosterPacket;
      resolvedDate: string;
    };
    expect(response.status).toBe(200);
    expect(body.businessBrandSystem.businessSlug).toBe(brand.businessSlug);
    expect(body.dailyPosterPacket.headline).toBe("A Cleaner Smile Starts Here");
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

  it("shows a warning when the production reference is missing", async () => {
    store.packets.set(
      `${brand.businessSlug}:awareness:${today}`,
      packet(today, null),
    );
    const response = await app.request(
      `/daily-poster/${brand.businessSlug}/awareness/today`,
      {},
      env,
    );
    expect(await response.text()).toContain(
      "production reference image URL is missing",
    );
  });
});
