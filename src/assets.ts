import type { Bindings } from "./types";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function isUploadedFile(
  value: FormDataEntryValue | null,
): value is File {
  return value instanceof File && value.size > 0;
}

export async function uploadImage(input: {
  env: Bindings;
  file: File;
  keyPrefix: string;
  publicBaseUrl: string;
}): Promise<string> {
  const { env, file, keyPrefix, publicBaseUrl } = input;
  if (!env.ASSETS) {
    throw new Error("R2 asset storage is not configured for this Worker.");
  }
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error("Image must be PNG, JPEG, WebP, or GIF.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 12 MB or smaller.");
  }

  const key = `${keyPrefix}.${extension}`;
  await env.ASSETS.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const assetOrigin =
    env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    publicBaseUrl.replace(/\/+$/, "");
  return env.R2_PUBLIC_BASE_URL
    ? `${assetOrigin}/${key}`
    : `${assetOrigin}/assets/${key}`;
}

export function imageContentTypeForKey(key: string): string {
  const extension = key.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_CONTENT_TYPES[extension] ?? "application/octet-stream";
}
