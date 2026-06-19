import type {
  CostBreakdown,
  GeminiUsage,
  ImageModelId,
  ImageResolution,
  TextModelId,
} from "./types";

const TEXT_PRICING_PER_MILLION: Record<
  TextModelId,
  { input: number; output: number }
> = {
  "gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini-3.1-pro-preview": { input: 2, output: 12 },
  "gemini-3-flash-preview": { input: 0.5, output: 3 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
};

const IMAGE_INPUT_PER_MILLION: Record<ImageModelId, number> = {
  "gemini-3.1-flash-image": 0.5,
  "gemini-3-pro-image": 2,
  "gemini-2.5-flash-image": 0.3,
};

const IMAGE_OUTPUT_USD: Record<
  ImageModelId,
  Partial<Record<ImageResolution, number>>
> = {
  "gemini-3.1-flash-image": {
    "512": 0.045,
    "1K": 0.067,
    "2K": 0.101,
    "4K": 0.151,
  },
  "gemini-3-pro-image": {
    "1K": 0.134,
    "2K": 0.134,
    "4K": 0.24,
  },
  "gemini-2.5-flash-image": {
    "1K": 0.039,
  },
};

export function usageFromResponse(
  response: Record<string, unknown>,
): GeminiUsage {
  const metadata =
    typeof response.usageMetadata === "object" && response.usageMetadata
      ? (response.usageMetadata as Record<string, unknown>)
      : {};
  const number = (key: string): number =>
    key in metadata && typeof metadata[key] === "number"
      ? metadata[key]
      : 0;
  return {
    promptTokens: number("promptTokenCount"),
    outputTokens: number("candidatesTokenCount"),
    thoughtTokens: number("thoughtsTokenCount"),
    totalTokens: number("totalTokenCount"),
  };
}

export function estimateGenerationCost(input: {
  textModel: TextModelId;
  imageModel: ImageModelId;
  imageResolution: ImageResolution;
  briefUsage: GeminiUsage;
  imageUsage: GeminiUsage;
}): CostBreakdown {
  const textPricing = TEXT_PRICING_PER_MILLION[input.textModel];
  const briefInputUsd =
    (input.briefUsage.promptTokens / 1_000_000) * textPricing.input;
  const briefOutputUsd =
    ((input.briefUsage.outputTokens + input.briefUsage.thoughtTokens) /
      1_000_000) *
    textPricing.output;
  const imageInputUsd =
    (input.imageUsage.promptTokens / 1_000_000) *
    IMAGE_INPUT_PER_MILLION[input.imageModel];
  const imageOutputUsd =
    IMAGE_OUTPUT_USD[input.imageModel][input.imageResolution] ??
    IMAGE_OUTPUT_USD[input.imageModel]["1K"] ??
    0;
  const totalUsd =
    briefInputUsd + briefOutputUsd + imageInputUsd + imageOutputUsd;
  return {
    briefInputUsd,
    briefOutputUsd,
    imageInputUsd,
    imageOutputUsd,
    totalUsd,
    note:
      "Estimated Standard paid-tier API cost from Gemini usage metadata and published pricing; actual billing may differ.",
  };
}
