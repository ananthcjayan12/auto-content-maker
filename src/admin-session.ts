import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Bindings } from "./types";

const COOKIE_NAME = "poster_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

interface SessionPayload {
  businessSlug: string;
  expiresAt: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(
  businessSlug: string,
  secret: string,
): Promise<string> {
  const payload: SessionPayload = {
    businessSlug,
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
  };
  const encodedPayload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(encodedPayload),
  );
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      Uint8Array.from(fromBase64Url(encodedSignature)).buffer as ArrayBuffer,
      new TextEncoder().encode(encodedPayload),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    ) as SessionPayload;
    if (
      !payload.businessSlug ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function setAdminSession(
  c: Context<{ Bindings: Bindings }>,
  businessSlug: string,
): Promise<void> {
  const secret = c.env.POSTER_ADMIN_TOKEN;
  if (!secret) throw new Error("POSTER_ADMIN_TOKEN is not configured.");
  const token = await createSessionToken(businessSlug, secret);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearAdminSession(c: Context<{ Bindings: Bindings }>): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export async function getAdminBusinessSlug(
  c: Context<{ Bindings: Bindings }>,
): Promise<string | null> {
  const secret = c.env.POSTER_ADMIN_TOKEN;
  const token = getCookie(c, COOKIE_NAME);
  if (!secret || !token) return null;
  return (await verifySessionToken(token, secret))?.businessSlug ?? null;
}
