export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function todayInTimezone(
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return todayInTimezone(DEFAULT_TIMEZONE, now);
  }
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function resolveDate(
  dateOrToday: string,
  timezone: string,
  now = new Date(),
): string | null {
  if (dateOrToday === "today") return todayInTimezone(timezone, now);
  return isValidDate(dateOrToday) ? dateOrToday : null;
}
