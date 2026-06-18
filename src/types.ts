export const POSTER_TYPES = [
  "awareness",
  "offer",
  "festival",
  "anniversary",
  "review",
  "general",
] as const;

export type PosterType = (typeof POSTER_TYPES)[number];

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

export interface PosterStore {
  getBrand(businessSlug: string): Promise<BusinessBrandSystem | null>;
  upsertBrand(brand: BusinessBrandSystem): Promise<BusinessBrandSystem>;
  getPacket(
    businessSlug: string,
    posterType: PosterType,
    date: string,
  ): Promise<DailyPosterPacket | null>;
  upsertPacket(packet: DailyPosterPacket): Promise<DailyPosterPacket>;
}

export interface Bindings {
  DB: D1Database;
  ASSETS?: R2Bucket;
  POSTER_ADMIN_TOKEN?: string;
  PUBLIC_BASE_URL?: string;
  BUSINESS_TIMEZONE?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_BASE_URL?: string;
  TEST_STORE?: PosterStore;
}
