import type {
  BusinessBrandSystem,
  DailyPosterPacket,
  PosterStore,
  PosterType,
} from "./types";

interface BrandRow {
  business_slug: string;
  business_name: string;
  phone: string;
  website_url: string | null;
  logo_url: string;
  brand_reference_board_url: string;
  colors_json: string;
  typography_json: string;
  visual_style_json: string;
  default_poster_rules_json: string;
  created_at: string;
  updated_at: string;
}

interface PacketRow {
  business_slug: string;
  poster_type: PosterType;
  poster_date: string;
  status: string;
  headline: string;
  subheadline: string | null;
  cta: string | null;
  offer: string | null;
  campaign_goal: string | null;
  target_audience: string | null;
  required_text_json: string;
  production_reference_image_url: string | null;
  additional_reference_images_json: string;
  special_instructions_json: string;
  chatgpt_image_prompt: string;
  created_at: string;
  updated_at: string;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapBrand(row: BrandRow): BusinessBrandSystem {
  return {
    businessSlug: row.business_slug,
    businessName: row.business_name,
    phone: row.phone,
    websiteUrl: row.website_url,
    logoUrl: row.logo_url,
    brandReferenceBoardUrl: row.brand_reference_board_url,
    colors: parseJson(row.colors_json, {
      primary: "#0EA5A4",
      secondary: "#F7E7CE",
      accent: "#FFFFFF",
      darkText: "#123333",
      mutedText: "#5F6F6F",
    }),
    typography: parseJson(row.typography_json, {
      headingStyle: "",
      bodyStyle: "",
      fontMood: "",
    }),
    visualStyle: parseJson(row.visual_style_json, {
      mood: "",
      layout: "",
      photoStyle: "",
      avoid: [],
    }),
    defaultPosterRules: parseJson(row.default_poster_rules_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPacket(row: PacketRow): DailyPosterPacket {
  return {
    businessSlug: row.business_slug,
    posterType: row.poster_type,
    date: row.poster_date,
    status: row.status,
    headline: row.headline,
    subheadline: row.subheadline,
    cta: row.cta,
    offer: row.offer,
    campaignGoal: row.campaign_goal,
    targetAudience: row.target_audience,
    requiredText: parseJson(row.required_text_json, []),
    productionReferenceImageUrl: row.production_reference_image_url,
    additionalReferenceImages: parseJson(
      row.additional_reference_images_json,
      [],
    ),
    specialInstructions: parseJson(row.special_instructions_json, []),
    chatgptImagePrompt: row.chatgpt_image_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1PosterStore implements PosterStore {
  constructor(private readonly db: D1Database) {}

  async getBrand(businessSlug: string): Promise<BusinessBrandSystem | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM business_brand_systems WHERE business_slug = ? LIMIT 1",
      )
      .bind(businessSlug)
      .first<BrandRow>();
    return row ? mapBrand(row) : null;
  }

  async upsertBrand(brand: BusinessBrandSystem): Promise<BusinessBrandSystem> {
    await this.db
      .prepare(
        `INSERT INTO business_brand_systems (
          business_slug, business_name, phone, website_url, logo_url,
          brand_reference_board_url, colors_json, typography_json,
          visual_style_json, default_poster_rules_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_slug) DO UPDATE SET
          business_name = excluded.business_name,
          phone = excluded.phone,
          website_url = excluded.website_url,
          logo_url = excluded.logo_url,
          brand_reference_board_url = excluded.brand_reference_board_url,
          colors_json = excluded.colors_json,
          typography_json = excluded.typography_json,
          visual_style_json = excluded.visual_style_json,
          default_poster_rules_json = excluded.default_poster_rules_json,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        brand.businessSlug,
        brand.businessName,
        brand.phone,
        brand.websiteUrl,
        brand.logoUrl,
        brand.brandReferenceBoardUrl,
        JSON.stringify(brand.colors),
        JSON.stringify(brand.typography),
        JSON.stringify(brand.visualStyle),
        JSON.stringify(brand.defaultPosterRules),
      )
      .run();

    return (await this.getBrand(brand.businessSlug))!;
  }

  async getPacket(
    businessSlug: string,
    posterType: PosterType,
    date: string,
  ): Promise<DailyPosterPacket | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM daily_poster_packets
         WHERE business_slug = ? AND poster_type = ? AND poster_date = ?
         LIMIT 1`,
      )
      .bind(businessSlug, posterType, date)
      .first<PacketRow>();
    return row ? mapPacket(row) : null;
  }

  async upsertPacket(packet: DailyPosterPacket): Promise<DailyPosterPacket> {
    await this.db
      .prepare(
        `INSERT INTO daily_poster_packets (
          business_slug, poster_type, poster_date, status, headline,
          subheadline, cta, offer, campaign_goal, target_audience,
          required_text_json, production_reference_image_url,
          additional_reference_images_json, special_instructions_json,
          chatgpt_image_prompt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_slug, poster_type, poster_date) DO UPDATE SET
          status = excluded.status,
          headline = excluded.headline,
          subheadline = excluded.subheadline,
          cta = excluded.cta,
          offer = excluded.offer,
          campaign_goal = excluded.campaign_goal,
          target_audience = excluded.target_audience,
          required_text_json = excluded.required_text_json,
          production_reference_image_url = excluded.production_reference_image_url,
          additional_reference_images_json = excluded.additional_reference_images_json,
          special_instructions_json = excluded.special_instructions_json,
          chatgpt_image_prompt = excluded.chatgpt_image_prompt,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        packet.businessSlug,
        packet.posterType,
        packet.date,
        packet.status,
        packet.headline,
        packet.subheadline,
        packet.cta,
        packet.offer,
        packet.campaignGoal,
        packet.targetAudience,
        JSON.stringify(packet.requiredText),
        packet.productionReferenceImageUrl,
        JSON.stringify(packet.additionalReferenceImages),
        JSON.stringify(packet.specialInstructions),
        packet.chatgptImagePrompt,
      )
      .run();

    return (await this.getPacket(
      packet.businessSlug,
      packet.posterType,
      packet.date,
    ))!;
  }
}
