import { todayInTimezone } from "./date";
import { runPosterOrchestratorForLanguages } from "./orchestrator";
import type {
  AutomationRun,
  AutomationSettings,
  Bindings,
  GeneratedPoster,
  PosterStore,
  PosterType,
} from "./types";

export const AUTOMATABLE_POSTER_TYPES: PosterType[] = [
  "awareness",
  "offer",
  "festival",
  "anniversary",
  "general",
];

export function defaultAutomationSettings(
  businessSlug: string,
): AutomationSettings {
  return {
    businessSlug,
    enabled: true,
    localTime: "08:30",
    posterTypes: ["awareness"],
    forceGeneration: false,
    emailEnabled: false,
    recipientEmails: [],
  };
}

export function isValidLocalTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours! >= 0 && hours! <= 23 && minutes! >= 0 && minutes! <= 59;
}

function minutesInTimezone(timezone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return Number(value.hour) * 60 + Number(value.minute);
}

export function automationIsDue(
  settings: AutomationSettings,
  timezone: string,
  now = new Date(),
): boolean {
  if (!settings.enabled || !isValidLocalTime(settings.localTime)) return false;
  const [hours, minutes] = settings.localTime.split(":").map(Number);
  return minutesInTimezone(timezone, now) >= hours! * 60 + minutes!;
}

function extensionFor(poster: GeneratedPoster): string {
  if (poster.imageContentType?.includes("png")) return "png";
  if (poster.imageContentType?.includes("webp")) return "webp";
  return "jpg";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reworkSecret(env: Bindings): string | null {
  return (
    env.POSTER_REWORK_SECRET?.trim() || env.POSTER_ADMIN_TOKEN?.trim() || null
  );
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function tokenPayload(input: {
  businessSlug: string;
  posterType: PosterType;
  date: string;
  languageCode: string;
  expires: string;
}): string {
  return [
    input.businessSlug,
    input.posterType,
    input.date,
    input.languageCode,
    input.expires,
  ].join("|");
}

async function signReworkPayload(
  secret: string,
  payload: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
}

function signaturesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function createPosterReworkUrl(input: {
  env: Bindings;
  poster: GeneratedPoster;
  baseUrl?: string;
  now?: Date;
}): Promise<string | null> {
  const secret = reworkSecret(input.env);
  const publicBase = (input.baseUrl || input.env.PUBLIC_BASE_URL || "").trim();
  if (!secret || !publicBase) return null;
  const expires = String(
    Math.floor(
      ((input.now ?? new Date()).getTime() + 7 * 24 * 60 * 60 * 1000) / 1000,
    ),
  );
  const languageCode = input.poster.languageCode ?? "en";
  const payload = tokenPayload({
    businessSlug: input.poster.businessSlug,
    posterType: input.poster.posterType,
    date: input.poster.date,
    languageCode,
    expires,
  });
  const token = await signReworkPayload(secret, payload);
  const url = new URL(
    `/app/${input.poster.businessSlug}/poster-rework`,
    publicBase,
  );
  url.searchParams.set("posterType", input.poster.posterType);
  url.searchParams.set("date", input.poster.date);
  url.searchParams.set("languageCode", languageCode);
  url.searchParams.set("expires", expires);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function verifyPosterReworkToken(input: {
  env: Bindings;
  businessSlug: string;
  posterType: PosterType;
  date: string;
  languageCode: string;
  expires: string;
  token: string;
  now?: Date;
}): Promise<boolean> {
  const secret = reworkSecret(input.env);
  if (!secret || !input.token || !/^\d+$/.test(input.expires)) return false;
  if (
    Number(input.expires) <
    Math.floor((input.now ?? new Date()).getTime() / 1000)
  ) {
    return false;
  }
  const expected = await signReworkPayload(
    secret,
    tokenPayload({
      businessSlug: input.businessSlug,
      posterType: input.posterType,
      date: input.date,
      languageCode: input.languageCode,
      expires: input.expires,
    }),
  );
  return signaturesMatch(expected, input.token);
}

export async function sendPosterEmail(input: {
  env: Bindings;
  settings: AutomationSettings;
  poster: GeneratedPoster;
  idempotencyKey?: string;
}): Promise<string> {
  const { env, settings, poster } = input;
  if (!env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  if (!env.POSTER_FROM_EMAIL?.trim()) {
    throw new Error("POSTER_FROM_EMAIL is not configured.");
  }
  if (!settings.recipientEmails.length) {
    throw new Error("No poster recipient email is configured.");
  }
  if (!poster.imageUrl) throw new Error("Generated poster has no image URL.");
  const reworkUrl = await createPosterReworkUrl({ env, poster });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
      "Content-Type": "application/json",
      "Idempotency-Key":
        input.idempotencyKey ||
        `poster-${poster.businessSlug}-${poster.posterType}-${poster.date}`,
    },
    body: JSON.stringify({
      from: env.POSTER_FROM_EMAIL.trim(),
      to: settings.recipientEmails,
      subject: `Today's ${poster.posterType} poster is ready — ${poster.date}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#123333">
        <h1 style="font-size:24px">Your poster is ready</h1>
        <p>${escapeHtml(poster.posterType)} · ${escapeHtml(poster.date)}</p>
        <img src="${escapeHtml(poster.imageUrl)}" alt="Generated poster" style="display:block;width:100%;max-width:360px;height:auto;border-radius:12px">
        <p><a href="${escapeHtml(poster.imageUrl)}">Open the full-size poster</a></p>
        ${
          reworkUrl
            ? `<p style="margin-top:24px"><a href="${escapeHtml(reworkUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Request rework</a></p><p style="font-size:13px;color:#5f6f6f">Use this secure link to add correction notes and generate an updated poster.</p>`
            : ""
        }
      </div>`,
      attachments: [
        {
          path: poster.imageUrl,
          filename: `smile-craft-${poster.posterType}-${poster.date}.${extensionFor(poster)}`,
        },
      ],
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.message || `Resend email failed with HTTP ${response.status}.`,
    );
  }
  return payload.id || "sent";
}

export async function runAutomationHeartbeat(input: {
  env: Bindings;
  store: PosterStore;
  businessSlug: string;
  requestUrl: string;
  now?: Date;
}): Promise<AutomationRun[]> {
  const { env, store, businessSlug, requestUrl } = input;
  const timezone = env.BUSINESS_TIMEZONE || "Asia/Kolkata";
  const settings =
    (await store.getAutomationSettings(businessSlug)) ??
    defaultAutomationSettings(businessSlug);
  const now = input.now ?? new Date();
  if (!automationIsDue(settings, timezone, now)) return [];
  const date = todayInTimezone(timezone, now);
  const calendarEntry = await store.getCalendarEntry(businessSlug, date);
  if (calendarEntry?.status === "skipped") return [];
  const types = calendarEntry
    ? [calendarEntry.posterType]
    : settings.posterTypes.filter((type) =>
        AUTOMATABLE_POSTER_TYPES.includes(type),
      );
  const results: AutomationRun[] = [];

  for (const posterType of types) {
    if (
      posterType === "reference" &&
      calendarEntry?.posterMode !== "inspiration"
    ) {
      continue;
    }
    if (!(await store.claimAutomationRun(businessSlug, posterType, date))) {
      continue;
    }
    let run: AutomationRun = {
      businessSlug,
      posterType,
      date,
      status: "processing",
      deliveryStatus: settings.emailEnabled ? "pending" : "skipped",
      imageUrl: null,
      providerMessageId: null,
      error: null,
    };
    try {
      const posters = await runPosterOrchestratorForLanguages({
        env,
        store,
        businessSlug,
        posterType,
        dateOrToday: date,
        requestUrl,
        force: settings.forceGeneration,
        calendarEntry,
      });
      const readyPosters = posters.filter(
        (poster) => poster.status === "ready",
      );
      const poster =
        readyPosters[0] ??
        posters.find((item) => item.status === "needs_review") ??
        posters[0]!;
      run = {
        ...run,
        status:
          poster.status === "ready"
            ? "ready"
            : poster.status === "needs_review"
              ? "needs_review"
              : "failed",
        imageUrl: poster.imageUrl,
        error: poster.failureReason,
      };
      if (poster.status === "ready" && calendarEntry) {
        await store.upsertCalendarEntry({
          ...calendarEntry,
          status: "poster_ready",
        });
      }
      if (poster.status === "ready" && settings.emailEnabled) {
        try {
          run.providerMessageId = await sendPosterEmail({
            env,
            settings,
            poster,
          });
          run.deliveryStatus = "sent";
        } catch (error) {
          run.deliveryStatus = "failed";
          run.error = error instanceof Error ? error.message : "Email failed.";
        }
      } else if (poster.status !== "ready") {
        run.deliveryStatus = "skipped";
      }
    } catch (error) {
      run.status = "failed";
      run.deliveryStatus = "skipped";
      run.error = error instanceof Error ? error.message : "Automation failed.";
    }
    results.push(await store.updateAutomationRun(run));
  }
  return results;
}
