import { todayInTimezone } from "./date";
import { runPosterOrchestrator } from "./orchestrator";
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
  const types = settings.posterTypes.filter((type) =>
    AUTOMATABLE_POSTER_TYPES.includes(type),
  );
  const results: AutomationRun[] = [];

  for (const posterType of types) {
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
      const poster = await runPosterOrchestrator({
        env,
        store,
        businessSlug,
        posterType,
        dateOrToday: date,
        requestUrl,
        force: settings.forceGeneration,
      });
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
