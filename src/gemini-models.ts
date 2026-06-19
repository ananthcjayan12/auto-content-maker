import type {
  GenerationSettings,
  ImageModelId,
  ImageResolution,
  TextModelId,
} from "./types";

export const TEXT_MODELS: ReadonlyArray<{
  id: TextModelId;
  label: string;
}> = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (stable)" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (preview)" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (stable)" },
];

export const IMAGE_MODEL_CAPABILITIES: Readonly<
  Record<
    ImageModelId,
    {
      label: string;
      resolutions: readonly ImageResolution[];
      defaultResolution: ImageResolution;
      maxInputImages: number;
      maxStyleReferences: number;
      configurableResolution: boolean;
    }
  >
> = {
  "gemini-3.1-flash-image": {
    label: "Gemini 3.1 Flash Image",
    resolutions: ["512", "1K", "2K", "4K"],
    defaultResolution: "1K",
    maxInputImages: 14,
    maxStyleReferences: 12,
    configurableResolution: true,
  },
  "gemini-3-pro-image": {
    label: "Gemini 3 Pro Image",
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "2K",
    maxInputImages: 14,
    maxStyleReferences: 3,
    configurableResolution: true,
  },
  "gemini-2.5-flash-image": {
    label: "Gemini 2.5 Flash Image",
    resolutions: ["1K"],
    defaultResolution: "1K",
    maxInputImages: 3,
    maxStyleReferences: 1,
    configurableResolution: false,
  },
};

export const IMAGE_MODELS = Object.entries(IMAGE_MODEL_CAPABILITIES).map(
  ([id, capability]) => ({
    id: id as ImageModelId,
    label: capability.label,
  }),
);

export const DEFAULT_GENERATION_SETTINGS: Omit<
  GenerationSettings,
  "businessSlug"
> = {
  textModel: "gemini-3.5-flash",
  imageModel: "gemini-3.1-flash-image",
  imageResolution: "1K",
  aspectRatio: "9:16",
};

export function isTextModel(value: string): value is TextModelId {
  return TEXT_MODELS.some((model) => model.id === value);
}

export function isImageModel(value: string): value is ImageModelId {
  return value in IMAGE_MODEL_CAPABILITIES;
}

export function isImageResolution(value: string): value is ImageResolution {
  return ["512", "1K", "2K", "4K"].includes(value);
}

export function normalizeGenerationSettings(
  settings: GenerationSettings,
): GenerationSettings {
  const capability = IMAGE_MODEL_CAPABILITIES[settings.imageModel];
  return {
    ...settings,
    imageResolution: capability.resolutions.includes(settings.imageResolution)
      ? settings.imageResolution
      : capability.defaultResolution,
    aspectRatio: "9:16",
  };
}
