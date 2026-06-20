import type { ContentSourceSettings } from "./types";

export function defaultContentSourceSettings(
  businessSlug: string,
): ContentSourceSettings {
  return { businessSlug, awarenessMode: "sheet_first", googleSheetUrl: null };
}

export function googleSheetCsvUrl(value: string): string {
  const url = new URL(value);
  if (!/(^|\.)docs\.google\.com$/i.test(url.hostname)) {
    throw new Error("Google Sheet URL must use docs.google.com.");
  }
  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) throw new Error("Google Sheet URL is invalid.");
  const gid =
    url.searchParams.get("gid") || url.hash.match(/gid=(\d+)/)?.[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizedDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  return `${match[3]!}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

export async function findTodaySheetContent(
  sheetUrl: string,
  date: string,
): Promise<Record<string, string> | null> {
  const response = await fetch(googleSheetCsvUrl(sheetUrl));
  if (!response.ok)
    throw new Error(
      `Google Sheet returned HTTP ${response.status}. Make sure it is shared for anyone with the link.`,
    );
  const rows = parseCsv(await response.text());
  if (rows.length < 2) return null;
  const headers = rows[0]!.map((value) => value.trim());
  const dateIndex = headers.findIndex((value) =>
    /^(date|poster date|content date)$/i.test(value),
  );
  if (dateIndex < 0) throw new Error('Google Sheet needs a "Date" column.');
  const match = rows
    .slice(1)
    .find((row) => normalizedDate(row[dateIndex] || "") === date);
  if (!match) return null;
  return Object.fromEntries(
    headers.map((header, index) => [
      header || `column_${index + 1}`,
      match[index] || "",
    ]),
  );
}
