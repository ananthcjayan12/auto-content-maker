import {
  POSTER_TYPES,
  type BusinessBrandSystem,
  type DailyPosterPacket,
  type PosterType,
} from "./types";
import { isValidDate } from "./date";

export interface ValidationResult<T> {
  value?: T;
  errors: string[];
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexPattern = /^#[0-9A-Fa-f]{6}$/;

export function isValidSlug(value: string): boolean {
  return slugPattern.test(value);
}

export function isPosterType(value: string): value is PosterType {
  return POSTER_TYPES.includes(value as PosterType);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(
  value: unknown,
  name: string,
  errors: string[],
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    errors.push(`${name} must be a string or null`);
    return null;
  }
  return value.trim();
}

function mergedOptionalString(
  input: Record<string, unknown>,
  key: string,
  name: string,
  errors: string[],
  existing: string | null,
): string | null {
  return key in input ? optionalString(input[key], name, errors) : existing;
}

function requiredString(
  value: unknown,
  name: string,
  errors: string[],
): string {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${name} is required and must be a non-empty string`);
    return "";
  }
  return value.trim();
}

function stringArray(
  value: unknown,
  name: string,
  errors: string[],
  fallback: string[] = [],
): string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${name} must be an array of strings`);
    return fallback;
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function validatePublicUrl(
  value: string | null,
  name: string,
  errors: string[],
  required = false,
): void {
  if (!value) {
    if (required) errors.push(`${name} is required`);
    return;
  }
  try {
    const url = new URL(value, "https://relative.example");
    if (
      !value.startsWith("/") &&
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      errors.push(`${name} must be an http(s) URL or a root-relative path`);
    }
  } catch {
    errors.push(`${name} must be a valid URL`);
  }
}

export function validateBrand(
  input: unknown,
  pathSlug: string,
  existing?: BusinessBrandSystem | null,
): ValidationResult<BusinessBrandSystem> {
  const errors: string[] = [];
  if (!isObject(input))
    return { errors: ["Request body must be a JSON object"] };

  if (input.businessSlug !== undefined && input.businessSlug !== pathSlug) {
    errors.push("businessSlug in the body must match the URL");
  }

  const colorsInput = isObject(input.colors) ? input.colors : existing?.colors;
  const typographyInput = isObject(input.typography)
    ? input.typography
    : existing?.typography;
  const visualInput = isObject(input.visualStyle)
    ? input.visualStyle
    : existing?.visualStyle;
  const languageTypographyInput = isObject(input.languageTypography)
    ? input.languageTypography
    : existing?.languageTypography;
  const rawLanguageProfiles =
    isObject(languageTypographyInput) &&
    Array.isArray(languageTypographyInput.profiles)
      ? languageTypographyInput.profiles
      : existing?.languageTypography?.profiles;
  const languageProfiles = Array.isArray(rawLanguageProfiles)
    ? rawLanguageProfiles
        .filter((profile): profile is Record<string, unknown> =>
          isObject(profile),
        )
        .map((profile, index) => ({
          language:
            typeof profile.language === "string" && profile.language.trim()
              ? profile.language.trim().slice(0, 80)
              : index === 0
                ? "English"
                : "",
          role:
            profile.role === "primary"
              ? ("primary" as const)
              : ("secondary" as const),
          referenceImageUrl:
            typeof profile.referenceImageUrl === "string"
              ? profile.referenceImageUrl.trim() || null
              : null,
          styleProfile:
            typeof profile.styleProfile === "string"
              ? profile.styleProfile.trim().slice(0, 1600) || null
              : null,
          enabled: profile.enabled !== false,
        }))
        .filter((profile) => profile.language)
        .slice(0, 8)
    : [];
  const primaryLanguageProfile =
    languageProfiles.find((profile) => profile.role === "primary") ??
    languageProfiles[0] ??
    null;

  if (!colorsInput) errors.push("colors is required and must be an object");
  if (!typographyInput)
    errors.push("typography is required and must be an object");
  if (!visualInput)
    errors.push("visualStyle is required and must be an object");

  const colors = {
    primary: requiredString(colorsInput?.primary, "colors.primary", errors),
    secondary: requiredString(
      colorsInput?.secondary,
      "colors.secondary",
      errors,
    ),
    accent: requiredString(colorsInput?.accent, "colors.accent", errors),
    darkText: requiredString(colorsInput?.darkText, "colors.darkText", errors),
    mutedText: requiredString(
      colorsInput?.mutedText,
      "colors.mutedText",
      errors,
    ),
  };
  for (const [key, value] of Object.entries(colors)) {
    if (value && !hexPattern.test(value)) {
      errors.push(`colors.${key} must be a six-digit hex color`);
    }
  }

  const logoUrl =
    mergedOptionalString(
      input,
      "logoUrl",
      "logoUrl",
      errors,
      existing?.logoUrl ?? null,
    ) ?? "";
  const brandReferenceBoardUrl =
    mergedOptionalString(
      input,
      "brandReferenceBoardUrl",
      "brandReferenceBoardUrl",
      errors,
      existing?.brandReferenceBoardUrl ?? null,
    ) ?? "";
  validatePublicUrl(logoUrl, "logoUrl", errors, true);
  validatePublicUrl(
    brandReferenceBoardUrl,
    "brandReferenceBoardUrl",
    errors,
    true,
  );

  const value: BusinessBrandSystem = {
    businessSlug: pathSlug,
    businessName:
      mergedOptionalString(
        input,
        "businessName",
        "businessName",
        errors,
        existing?.businessName ?? null,
      ) ?? "",
    phone:
      mergedOptionalString(
        input,
        "phone",
        "phone",
        errors,
        existing?.phone ?? null,
      ) ?? "",
    websiteUrl: mergedOptionalString(
      input,
      "websiteUrl",
      "websiteUrl",
      errors,
      existing?.websiteUrl ?? null,
    ),
    logoUrl,
    brandReferenceBoardUrl,
    colors,
    typography: {
      headingStyle: requiredString(
        typographyInput?.headingStyle,
        "typography.headingStyle",
        errors,
      ),
      bodyStyle: requiredString(
        typographyInput?.bodyStyle,
        "typography.bodyStyle",
        errors,
      ),
      fontMood: requiredString(
        typographyInput?.fontMood,
        "typography.fontMood",
        errors,
      ),
    },
    visualStyle: {
      mood: requiredString(visualInput?.mood, "visualStyle.mood", errors),
      layout: requiredString(visualInput?.layout, "visualStyle.layout", errors),
      photoStyle: requiredString(
        visualInput?.photoStyle,
        "visualStyle.photoStyle",
        errors,
      ),
      avoid: stringArray(
        visualInput?.avoid,
        "visualStyle.avoid",
        errors,
        existing?.visualStyle.avoid,
      ),
    },
    defaultPosterRules: stringArray(
      input.defaultPosterRules,
      "defaultPosterRules",
      errors,
      existing?.defaultPosterRules,
    ),
    languageTypography: {
      enabled:
        isObject(languageTypographyInput) &&
        typeof languageTypographyInput.enabled === "boolean"
          ? languageTypographyInput.enabled
          : (existing?.languageTypography?.enabled ?? false),
      primaryLanguage:
        primaryLanguageProfile?.language ??
        (isObject(languageTypographyInput) &&
        typeof languageTypographyInput.primaryLanguage === "string" &&
        languageTypographyInput.primaryLanguage.trim()
          ? languageTypographyInput.primaryLanguage.trim().slice(0, 80)
          : (existing?.languageTypography?.primaryLanguage ?? "English")),
      additionalLanguages: languageProfiles.length
        ? languageProfiles
            .filter(
              (profile) =>
                profile.language !==
                (primaryLanguageProfile?.language ?? "English"),
            )
            .map((profile) => profile.language)
        : stringArray(
            isObject(languageTypographyInput)
              ? languageTypographyInput.additionalLanguages
              : undefined,
            "languageTypography.additionalLanguages",
            errors,
            existing?.languageTypography?.additionalLanguages ?? [],
          )
            .map((language) => language.slice(0, 80))
            .slice(0, 8),
      typographyReferenceImageUrl:
        primaryLanguageProfile?.referenceImageUrl ??
        (isObject(languageTypographyInput) &&
        typeof languageTypographyInput.typographyReferenceImageUrl === "string"
          ? languageTypographyInput.typographyReferenceImageUrl.trim() || null
          : (existing?.languageTypography?.typographyReferenceImageUrl ??
            null)),
      typographyStyleProfile:
        primaryLanguageProfile?.styleProfile ??
        (isObject(languageTypographyInput) &&
        typeof languageTypographyInput.typographyStyleProfile === "string"
          ? languageTypographyInput.typographyStyleProfile
              .trim()
              .slice(0, 1600) || null
          : (existing?.languageTypography?.typographyStyleProfile ?? null)),
      useReferenceForAllPosters:
        isObject(languageTypographyInput) &&
        typeof languageTypographyInput.useReferenceForAllPosters === "boolean"
          ? languageTypographyInput.useReferenceForAllPosters
          : (existing?.languageTypography?.useReferenceForAllPosters ?? false),
      profiles: languageProfiles,
    },
  };

  if (!value.businessName) errors.push("businessName is required");
  if (!value.phone) errors.push("phone is required");
  validatePublicUrl(value.websiteUrl, "websiteUrl", errors);
  validatePublicUrl(
    value.languageTypography?.typographyReferenceImageUrl ?? null,
    "languageTypography.typographyReferenceImageUrl",
    errors,
  );
  for (const [index, profile] of (
    value.languageTypography?.profiles ?? []
  ).entries()) {
    validatePublicUrl(
      profile.referenceImageUrl,
      `languageTypography.profiles.${index}.referenceImageUrl`,
      errors,
    );
  }

  return errors.length ? { errors } : { errors, value };
}

export function validatePacket(
  input: unknown,
  identity: {
    businessSlug: string;
    posterType: PosterType;
    date: string;
  },
  brand: BusinessBrandSystem,
  existing?: DailyPosterPacket | null,
  options: { requireProductionReference?: boolean } = {},
): ValidationResult<DailyPosterPacket> {
  const errors: string[] = [];
  if (!isObject(input))
    return { errors: ["Request body must be a JSON object"] };

  if (
    input.businessSlug !== undefined &&
    input.businessSlug !== identity.businessSlug
  ) {
    errors.push("businessSlug in the body must match the URL");
  }
  if (
    input.posterType !== undefined &&
    input.posterType !== identity.posterType
  ) {
    errors.push("posterType in the body must match the URL");
  }
  if (input.date !== undefined && input.date !== identity.date) {
    errors.push("date in the body must match the URL");
  }
  if (!isValidDate(identity.date)) errors.push("date must be YYYY-MM-DD");

  const status =
    mergedOptionalString(
      input,
      "status",
      "status",
      errors,
      existing?.status ?? "ready",
    ) ?? "";
  const headline =
    mergedOptionalString(
      input,
      "headline",
      "headline",
      errors,
      existing?.headline ?? null,
    ) ?? "";
  const productionReferenceImageUrl = mergedOptionalString(
    input,
    "productionReferenceImageUrl",
    "productionReferenceImageUrl",
    errors,
    existing?.productionReferenceImageUrl ?? null,
  );
  const requiredText = stringArray(
    input.requiredText,
    "requiredText",
    errors,
    existing?.requiredText ?? [brand.businessName, brand.phone],
  );

  if (!headline) errors.push("headline is required");
  if (
    options.requireProductionReference !== false &&
    status === "ready" &&
    !productionReferenceImageUrl
  ) {
    errors.push("productionReferenceImageUrl is required when status is ready");
  }
  validatePublicUrl(
    productionReferenceImageUrl,
    "productionReferenceImageUrl",
    errors,
  );

  const additionalReferenceImages = stringArray(
    input.additionalReferenceImages,
    "additionalReferenceImages",
    errors,
    existing?.additionalReferenceImages,
  );
  additionalReferenceImages.forEach((url, index) =>
    validatePublicUrl(url, `additionalReferenceImages[${index}]`, errors, true),
  );

  const generatedPrompt = `Create a 9:16 Instagram story poster for ${brand.businessName} using the full context on this page. Follow the brand system, color palette, logo reference, brand reference board, and today's production reference image. Include the required text exactly: ${requiredText.join(" · ")}. Keep the design modern, clean, premium, and suitable for a dental clinic. Do not create a crowded flyer. If the logo or reference image cannot be accessed, report the issue instead of generating.`;

  const value: DailyPosterPacket = {
    businessSlug: identity.businessSlug,
    posterType: identity.posterType,
    date: identity.date,
    status,
    headline,
    subheadline: mergedOptionalString(
      input,
      "subheadline",
      "subheadline",
      errors,
      existing?.subheadline ?? null,
    ),
    cta: mergedOptionalString(
      input,
      "cta",
      "cta",
      errors,
      existing?.cta ?? null,
    ),
    offer: mergedOptionalString(
      input,
      "offer",
      "offer",
      errors,
      existing?.offer ?? null,
    ),
    campaignGoal: mergedOptionalString(
      input,
      "campaignGoal",
      "campaignGoal",
      errors,
      existing?.campaignGoal ?? null,
    ),
    targetAudience: mergedOptionalString(
      input,
      "targetAudience",
      "targetAudience",
      errors,
      existing?.targetAudience ?? null,
    ),
    requiredText,
    productionReferenceImageUrl,
    additionalReferenceImages,
    specialInstructions: stringArray(
      input.specialInstructions,
      "specialInstructions",
      errors,
      existing?.specialInstructions,
    ),
    chatgptImagePrompt:
      optionalString(input.chatgptImagePrompt, "chatgptImagePrompt", errors) ??
      existing?.chatgptImagePrompt ??
      generatedPrompt,
  };

  return errors.length ? { errors } : { errors, value };
}
