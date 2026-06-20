import type {
  AutomationRun,
  AutomationSettings,
  BusinessBrandSystem,
  ContentSourceSettings,
  CostBreakdown,
  DailyPosterPacket,
  GenerationSettings,
  GeminiUsage,
  GeneratedPoster,
  GeneratedPosterStatus,
  ImageModelId,
  ImageResolution,
  PosterStore,
  PosterPromptSettings,
  PosterType,
  PosterTypeReference,
  TextModelId,
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

interface TypeReferenceRow {
  business_slug: string;
  poster_type: PosterType;
  production_reference_image_url: string | null;
  reference_image_urls_json: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface GenerationSettingsRow {
  business_slug: string;
  text_model: TextModelId;
  image_model: ImageModelId;
  image_resolution: ImageResolution;
  aspect_ratio: "9:16";
  created_at: string;
  updated_at: string;
}

interface PromptSettingsRow {
  business_slug: string;
  content_prompt_template: string;
  master_image_prompt_template: string;
  reference_prompt_template: string;
  poster_type_prompts_json: string;
  created_at: string;
  updated_at: string;
}

interface ContentSourceSettingsRow {
  business_slug: string;
  awareness_mode: "sheet_first" | "ai_only";
  google_sheet_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AutomationSettingsRow {
  business_slug: string;
  enabled: number;
  local_time: string;
  poster_types_json: string;
  force_generation: number;
  email_enabled: number;
  recipient_emails_json: string;
  created_at: string;
  updated_at: string;
}

interface AutomationRunRow {
  business_slug: string;
  poster_type: PosterType;
  poster_date: string;
  status: AutomationRun["status"];
  delivery_status: AutomationRun["deliveryStatus"];
  image_url: string | null;
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface GeneratedPosterRow {
  business_slug: string;
  poster_type: PosterType;
  poster_date: string;
  status: GeneratedPosterStatus;
  context_url: string;
  context_json_url: string;
  angle: string | null;
  brief_json: string | null;
  prompt: string | null;
  image_url: string | null;
  image_content_type: string | null;
  r2_key: string | null;
  gemini_text_model: string | null;
  gemini_image_model: string | null;
  image_resolution: ImageResolution | null;
  aspect_ratio: "9:16" | null;
  gemini_job_name: string | null;
  brief_usage_json: string | null;
  image_usage_json: string | null;
  cost_breakdown_json: string | null;
  validation_errors_json: string;
  failure_reason: string | null;
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

function mapTypeReference(row: TypeReferenceRow): PosterTypeReference {
  const urls = parseJson<string[]>(row.reference_image_urls_json, []);
  const referenceImageUrls =
    urls.length > 0
      ? urls
      : row.production_reference_image_url
        ? [row.production_reference_image_url]
        : [];
  return {
    businessSlug: row.business_slug,
    posterType: row.poster_type,
    productionReferenceImageUrl: row.production_reference_image_url,
    referenceImageUrls,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGenerationSettings(row: GenerationSettingsRow): GenerationSettings {
  return {
    businessSlug: row.business_slug,
    textModel: row.text_model,
    imageModel: row.image_model,
    imageResolution: row.image_resolution,
    aspectRatio: row.aspect_ratio,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPromptSettings(row: PromptSettingsRow): PosterPromptSettings {
  return {
    businessSlug: row.business_slug,
    contentPromptTemplate: row.content_prompt_template,
    masterImagePromptTemplate: row.master_image_prompt_template,
    referencePromptTemplate: row.reference_prompt_template,
    posterTypePrompts: parseJson(
      row.poster_type_prompts_json,
      {} as PosterPromptSettings["posterTypePrompts"],
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContentSourceSettings(
  row: ContentSourceSettingsRow,
): ContentSourceSettings {
  return {
    businessSlug: row.business_slug,
    awarenessMode: row.awareness_mode,
    googleSheetUrl: row.google_sheet_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAutomationSettings(row: AutomationSettingsRow): AutomationSettings {
  return {
    businessSlug: row.business_slug,
    enabled: Boolean(row.enabled),
    localTime: row.local_time,
    posterTypes: parseJson<PosterType[]>(row.poster_types_json, ["awareness"]),
    forceGeneration: Boolean(row.force_generation),
    emailEnabled: Boolean(row.email_enabled),
    recipientEmails: parseJson<string[]>(row.recipient_emails_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAutomationRun(row: AutomationRunRow): AutomationRun {
  return {
    businessSlug: row.business_slug,
    posterType: row.poster_type,
    date: row.poster_date,
    status: row.status,
    deliveryStatus: row.delivery_status,
    imageUrl: row.image_url,
    providerMessageId: row.provider_message_id,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGeneratedPoster(row: GeneratedPosterRow): GeneratedPoster {
  return {
    businessSlug: row.business_slug,
    posterType: row.poster_type,
    date: row.poster_date,
    status: row.status,
    contextUrl: row.context_url,
    contextJsonUrl: row.context_json_url,
    angle: row.angle,
    briefJson: row.brief_json,
    prompt: row.prompt,
    imageUrl: row.image_url,
    imageContentType: row.image_content_type,
    r2Key: row.r2_key,
    geminiTextModel: row.gemini_text_model,
    geminiImageModel: row.gemini_image_model,
    imageResolution: row.image_resolution,
    aspectRatio: row.aspect_ratio,
    geminiJobName: row.gemini_job_name,
    briefUsage: parseJson<GeminiUsage | null>(
      row.brief_usage_json ?? "null",
      null,
    ),
    imageUsage: parseJson<GeminiUsage | null>(
      row.image_usage_json ?? "null",
      null,
    ),
    costBreakdown: parseJson<CostBreakdown | null>(
      row.cost_breakdown_json ?? "null",
      null,
    ),
    validationErrors: parseJson(row.validation_errors_json, []),
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1PosterStore implements PosterStore {
  constructor(private readonly db: D1Database) {}

  async listBrands(): Promise<BusinessBrandSystem[]> {
    const result = await this.db
      .prepare("SELECT * FROM business_brand_systems ORDER BY business_name")
      .all<BrandRow>();
    return (result.results ?? []).map(mapBrand);
  }

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

  async getTypeReference(
    businessSlug: string,
    posterType: PosterType,
  ): Promise<PosterTypeReference | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM poster_type_references
         WHERE business_slug = ? AND poster_type = ?
         LIMIT 1`,
      )
      .bind(businessSlug, posterType)
      .first<TypeReferenceRow>();
    return row ? mapTypeReference(row) : null;
  }

  async upsertTypeReference(
    reference: PosterTypeReference,
  ): Promise<PosterTypeReference> {
    await this.db
      .prepare(
        `INSERT INTO poster_type_references (
          business_slug, poster_type, production_reference_image_url,
          reference_image_urls_json, notes
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(business_slug, poster_type) DO UPDATE SET
          production_reference_image_url = excluded.production_reference_image_url,
          reference_image_urls_json = excluded.reference_image_urls_json,
          notes = excluded.notes,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        reference.businessSlug,
        reference.posterType,
        reference.productionReferenceImageUrl,
        JSON.stringify(reference.referenceImageUrls),
        reference.notes,
      )
      .run();

    return (await this.getTypeReference(
      reference.businessSlug,
      reference.posterType,
    ))!;
  }

  async getGenerationSettings(
    businessSlug: string,
  ): Promise<GenerationSettings | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM poster_generation_settings
         WHERE business_slug = ?
         LIMIT 1`,
      )
      .bind(businessSlug)
      .first<GenerationSettingsRow>();
    return row ? mapGenerationSettings(row) : null;
  }

  async upsertGenerationSettings(
    settings: GenerationSettings,
  ): Promise<GenerationSettings> {
    await this.db
      .prepare(
        `INSERT INTO poster_generation_settings (
          business_slug, text_model, image_model, image_resolution, aspect_ratio
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(business_slug) DO UPDATE SET
          text_model = excluded.text_model,
          image_model = excluded.image_model,
          image_resolution = excluded.image_resolution,
          aspect_ratio = excluded.aspect_ratio,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        settings.businessSlug,
        settings.textModel,
        settings.imageModel,
        settings.imageResolution,
        settings.aspectRatio,
      )
      .run();

    return (await this.getGenerationSettings(settings.businessSlug))!;
  }

  async getContentSourceSettings(
    businessSlug: string,
  ): Promise<ContentSourceSettings | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM poster_content_source_settings WHERE business_slug = ? LIMIT 1",
      )
      .bind(businessSlug)
      .first<ContentSourceSettingsRow>();
    return row ? mapContentSourceSettings(row) : null;
  }

  async upsertContentSourceSettings(
    settings: ContentSourceSettings,
  ): Promise<ContentSourceSettings> {
    await this.db
      .prepare(
        `INSERT INTO poster_content_source_settings (business_slug, awareness_mode, google_sheet_url)
        VALUES (?, ?, ?)
        ON CONFLICT(business_slug) DO UPDATE SET awareness_mode = excluded.awareness_mode,
          google_sheet_url = excluded.google_sheet_url,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        settings.businessSlug,
        settings.awarenessMode,
        settings.googleSheetUrl,
      )
      .run();
    return (await this.getContentSourceSettings(settings.businessSlug))!;
  }

  async getAutomationSettings(
    businessSlug: string,
  ): Promise<AutomationSettings | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM poster_automation_settings WHERE business_slug = ? LIMIT 1",
      )
      .bind(businessSlug)
      .first<AutomationSettingsRow>();
    return row ? mapAutomationSettings(row) : null;
  }

  async upsertAutomationSettings(
    settings: AutomationSettings,
  ): Promise<AutomationSettings> {
    await this.db
      .prepare(
        `INSERT INTO poster_automation_settings (
          business_slug, enabled, local_time, poster_types_json,
          force_generation, email_enabled, recipient_emails_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_slug) DO UPDATE SET
          enabled = excluded.enabled,
          local_time = excluded.local_time,
          poster_types_json = excluded.poster_types_json,
          force_generation = excluded.force_generation,
          email_enabled = excluded.email_enabled,
          recipient_emails_json = excluded.recipient_emails_json,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        settings.businessSlug,
        Number(settings.enabled),
        settings.localTime,
        JSON.stringify(settings.posterTypes),
        Number(settings.forceGeneration),
        Number(settings.emailEnabled),
        JSON.stringify(settings.recipientEmails),
      )
      .run();
    return (await this.getAutomationSettings(settings.businessSlug))!;
  }

  async claimAutomationRun(
    businessSlug: string,
    posterType: PosterType,
    date: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        `INSERT OR IGNORE INTO poster_automation_runs (
          business_slug, poster_type, poster_date, status, delivery_status
        ) VALUES (?, ?, ?, 'processing', 'pending')`,
      )
      .bind(businessSlug, posterType, date)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  async updateAutomationRun(run: AutomationRun): Promise<AutomationRun> {
    await this.db
      .prepare(
        `UPDATE poster_automation_runs SET
          status = ?, delivery_status = ?, image_url = ?,
          provider_message_id = ?, error = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE business_slug = ? AND poster_type = ? AND poster_date = ?`,
      )
      .bind(
        run.status,
        run.deliveryStatus,
        run.imageUrl,
        run.providerMessageId,
        run.error,
        run.businessSlug,
        run.posterType,
        run.date,
      )
      .run();
    const row = await this.db
      .prepare(
        `SELECT * FROM poster_automation_runs
         WHERE business_slug = ? AND poster_type = ? AND poster_date = ?`,
      )
      .bind(run.businessSlug, run.posterType, run.date)
      .first<AutomationRunRow>();
    return row ? mapAutomationRun(row) : run;
  }

  async getPromptSettings(
    businessSlug: string,
  ): Promise<PosterPromptSettings | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM poster_prompt_settings WHERE business_slug = ? LIMIT 1`,
      )
      .bind(businessSlug)
      .first<PromptSettingsRow>();
    return row ? mapPromptSettings(row) : null;
  }

  async upsertPromptSettings(
    settings: PosterPromptSettings,
  ): Promise<PosterPromptSettings> {
    await this.db
      .prepare(
        `INSERT INTO poster_prompt_settings (
          business_slug, content_prompt_template, master_image_prompt_template,
          reference_prompt_template, poster_type_prompts_json
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(business_slug) DO UPDATE SET
          content_prompt_template = excluded.content_prompt_template,
          master_image_prompt_template = excluded.master_image_prompt_template,
          reference_prompt_template = excluded.reference_prompt_template,
          poster_type_prompts_json = excluded.poster_type_prompts_json,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        settings.businessSlug,
        settings.contentPromptTemplate,
        settings.masterImagePromptTemplate,
        settings.referencePromptTemplate,
        JSON.stringify(settings.posterTypePrompts),
      )
      .run();
    return (await this.getPromptSettings(settings.businessSlug))!;
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

  async getGeneratedPoster(
    businessSlug: string,
    posterType: PosterType,
    date: string,
  ): Promise<GeneratedPoster | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM generated_posters
         WHERE business_slug = ? AND poster_type = ? AND poster_date = ?
         LIMIT 1`,
      )
      .bind(businessSlug, posterType, date)
      .first<GeneratedPosterRow>();
    return row ? mapGeneratedPoster(row) : null;
  }

  async listGeneratedPosters(
    businessSlug: string,
    options?: { posterType?: PosterType; limit?: number },
  ): Promise<GeneratedPoster[]> {
    const limit = Math.max(1, Math.min(options?.limit ?? 24, 100));
    if (options?.posterType) {
      const result = await this.db
        .prepare(
          `SELECT * FROM generated_posters
           WHERE business_slug = ? AND poster_type = ?
           ORDER BY poster_date DESC, updated_at DESC
           LIMIT ?`,
        )
        .bind(businessSlug, options.posterType, limit)
        .all<GeneratedPosterRow>();
      return (result.results ?? []).map(mapGeneratedPoster);
    }
    const result = await this.db
      .prepare(
        `SELECT * FROM generated_posters
         WHERE business_slug = ?
         ORDER BY poster_date DESC, updated_at DESC
         LIMIT ?`,
      )
      .bind(businessSlug, limit)
      .all<GeneratedPosterRow>();
    return (result.results ?? []).map(mapGeneratedPoster);
  }

  async upsertGeneratedPoster(
    poster: GeneratedPoster,
  ): Promise<GeneratedPoster> {
    await this.db
      .prepare(
        `INSERT INTO generated_posters (
          business_slug, poster_type, poster_date, status, context_url,
          context_json_url, angle, brief_json, prompt, image_url,
          image_content_type, r2_key, gemini_text_model, gemini_image_model,
          image_resolution, aspect_ratio, gemini_job_name, brief_usage_json,
          image_usage_json, cost_breakdown_json, validation_errors_json,
          failure_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_slug, poster_type, poster_date) DO UPDATE SET
          status = excluded.status,
          context_url = excluded.context_url,
          context_json_url = excluded.context_json_url,
          angle = excluded.angle,
          brief_json = excluded.brief_json,
          prompt = excluded.prompt,
          image_url = excluded.image_url,
          image_content_type = excluded.image_content_type,
          r2_key = excluded.r2_key,
          gemini_text_model = excluded.gemini_text_model,
          gemini_image_model = excluded.gemini_image_model,
          image_resolution = excluded.image_resolution,
          aspect_ratio = excluded.aspect_ratio,
          gemini_job_name = excluded.gemini_job_name,
          brief_usage_json = excluded.brief_usage_json,
          image_usage_json = excluded.image_usage_json,
          cost_breakdown_json = excluded.cost_breakdown_json,
          validation_errors_json = excluded.validation_errors_json,
          failure_reason = excluded.failure_reason,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        poster.businessSlug,
        poster.posterType,
        poster.date,
        poster.status,
        poster.contextUrl,
        poster.contextJsonUrl,
        poster.angle,
        poster.briefJson,
        poster.prompt,
        poster.imageUrl,
        poster.imageContentType,
        poster.r2Key,
        poster.geminiTextModel,
        poster.geminiImageModel,
        poster.imageResolution,
        poster.aspectRatio,
        poster.geminiJobName,
        poster.briefUsage ? JSON.stringify(poster.briefUsage) : null,
        poster.imageUsage ? JSON.stringify(poster.imageUsage) : null,
        poster.costBreakdown ? JSON.stringify(poster.costBreakdown) : null,
        JSON.stringify(poster.validationErrors),
        poster.failureReason,
      )
      .run();

    return (await this.getGeneratedPoster(
      poster.businessSlug,
      poster.posterType,
      poster.date,
    ))!;
  }
}
