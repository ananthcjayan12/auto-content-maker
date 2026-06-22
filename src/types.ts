export const POSTER_TYPES = [
  "awareness",
  "offer",
  "festival",
  "anniversary",
  "review",
  "general",
  "reference",
] as const;

export type PosterType = (typeof POSTER_TYPES)[number];
export type TextModelId =
  | "gemini-3.5-flash"
  | "gemini-3.1-pro-preview"
  | "gemini-3-flash-preview"
  | "gemini-2.5-flash";
export type ImageModelId =
  | "gemini-3.1-flash-image"
  | "gemini-3-pro-image"
  | "gemini-2.5-flash-image";
export type ImageResolution = "512" | "1K" | "2K" | "4K";

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  darkText: string;
  mutedText: string;
}

export interface BrandTypography {
  headingStyle: string;
  bodyStyle: string;
  fontMood: string;
}

export interface VisualStyle {
  mood: string;
  layout: string;
  photoStyle: string;
  avoid: string[];
}

export interface BusinessBrandSystem {
  businessSlug: string;
  businessName: string;
  phone: string;
  websiteUrl: string | null;
  logoUrl: string;
  brandReferenceBoardUrl: string;
  colors: BrandColors;
  typography: BrandTypography;
  visualStyle: VisualStyle;
  defaultPosterRules: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyPosterPacket {
  businessSlug: string;
  posterType: PosterType;
  date: string;
  status: string;
  headline: string;
  subheadline: string | null;
  cta: string | null;
  offer: string | null;
  campaignGoal: string | null;
  targetAudience: string | null;
  requiredText: string[];
  productionReferenceImageUrl: string | null;
  additionalReferenceImages: string[];
  specialInstructions: string[];
  chatgptImagePrompt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PosterTypeReference {
  businessSlug: string;
  posterType: PosterType;
  productionReferenceImageUrl: string | null;
  referenceImageUrls: string[];
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerationSettings {
  businessSlug: string;
  textModel: TextModelId;
  imageModel: ImageModelId;
  imageResolution: ImageResolution;
  aspectRatio: "9:16";
  createdAt?: string;
  updatedAt?: string;
}

export type AwarenessContentMode = "sheet_first" | "ai_only";

export interface ContentSourceSettings {
  businessSlug: string;
  awarenessMode: AwarenessContentMode;
  googleSheetUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AutomationSettings {
  businessSlug: string;
  enabled: boolean;
  localTime: string;
  posterTypes: PosterType[];
  forceGeneration: boolean;
  emailEnabled: boolean;
  recipientEmails: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type AutomationRunStatus =
  | "processing"
  | "ready"
  | "failed"
  | "needs_review";
export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export interface AutomationRun {
  businessSlug: string;
  posterType: PosterType;
  date: string;
  status: AutomationRunStatus;
  deliveryStatus: DeliveryStatus;
  imageUrl: string | null;
  providerMessageId: string | null;
  error: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PosterPromptSettings {
  businessSlug: string;
  contentPromptTemplate: string;
  masterImagePromptTemplate: string;
  referencePromptTemplate: string;
  posterTypePrompts: Record<PosterType, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface GeminiUsage {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  briefInputUsd: number;
  briefOutputUsd: number;
  imageInputUsd: number;
  imageOutputUsd: number;
  totalUsd: number;
  note: string;
}

export type GeneratedPosterStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "needs_review";

export interface GeneratedPoster {
  businessSlug: string;
  posterType: PosterType;
  date: string;
  status: GeneratedPosterStatus;
  contextUrl: string;
  contextJsonUrl: string;
  angle: string | null;
  briefJson: string | null;
  prompt: string | null;
  imageUrl: string | null;
  imageContentType: string | null;
  r2Key: string | null;
  geminiTextModel: string | null;
  geminiImageModel: string | null;
  imageResolution: ImageResolution | null;
  aspectRatio: "9:16" | null;
  geminiJobName: string | null;
  briefUsage: GeminiUsage | null;
  imageUsage: GeminiUsage | null;
  costBreakdown: CostBreakdown | null;
  validationErrors: string[];
  failureReason: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PosterStore {
  listBrands(): Promise<BusinessBrandSystem[]>;
  getBrand(businessSlug: string): Promise<BusinessBrandSystem | null>;
  upsertBrand(brand: BusinessBrandSystem): Promise<BusinessBrandSystem>;
  getTypeReference(
    businessSlug: string,
    posterType: PosterType,
  ): Promise<PosterTypeReference | null>;
  upsertTypeReference(
    reference: PosterTypeReference,
  ): Promise<PosterTypeReference>;
  getGenerationSettings(
    businessSlug: string,
  ): Promise<GenerationSettings | null>;
  upsertGenerationSettings(
    settings: GenerationSettings,
  ): Promise<GenerationSettings>;
  getContentSourceSettings(
    businessSlug: string,
  ): Promise<ContentSourceSettings | null>;
  upsertContentSourceSettings(
    settings: ContentSourceSettings,
  ): Promise<ContentSourceSettings>;
  getAutomationSettings(
    businessSlug: string,
  ): Promise<AutomationSettings | null>;
  upsertAutomationSettings(
    settings: AutomationSettings,
  ): Promise<AutomationSettings>;
  claimAutomationRun(
    businessSlug: string,
    posterType: PosterType,
    date: string,
  ): Promise<boolean>;
  updateAutomationRun(run: AutomationRun): Promise<AutomationRun>;
  getPromptSettings(businessSlug: string): Promise<PosterPromptSettings | null>;
  upsertPromptSettings(
    settings: PosterPromptSettings,
  ): Promise<PosterPromptSettings>;
  getPacket(
    businessSlug: string,
    posterType: PosterType,
    date: string,
  ): Promise<DailyPosterPacket | null>;
  upsertPacket(packet: DailyPosterPacket): Promise<DailyPosterPacket>;
  getGeneratedPoster(
    businessSlug: string,
    posterType: PosterType,
    date: string,
  ): Promise<GeneratedPoster | null>;
  listGeneratedPosters(
    businessSlug: string,
    options?: { posterType?: PosterType; limit?: number },
  ): Promise<GeneratedPoster[]>;
  upsertGeneratedPoster(poster: GeneratedPoster): Promise<GeneratedPoster>;
}

export interface Bindings {
  DB: D1Database;
  ASSETS?: R2Bucket;
  GEMINI_API_KEY?: string;
  GEMINI_TEXT_MODEL?: string;
  GEMINI_IMAGE_MODEL?: string;
  GEMINI_IMAGE_RESOLUTION?: string;
  DEFAULT_BUSINESS_SLUG?: string;
  DEFAULT_POSTER_TYPE?: PosterType;
  POSTER_ADMIN_TOKEN?: string;
  PUBLIC_BASE_URL?: string;
  BUSINESS_TIMEZONE?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_BASE_URL?: string;
  RESEND_API_KEY?: string;
  POSTER_FROM_EMAIL?: string;
  TEST_STORE?: PosterStore;
}
