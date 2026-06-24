import type {
  AutomationSettings,
  BusinessBrandSystem,
  CalendarEntryStatus,
  CalendarPosterMode,
  ContentCalendarEntry,
  GeneratedPoster,
  PosterTemplatePattern,
  PosterType,
} from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selected(value: string, current: string): string {
  return value === current ? " selected" : "";
}

function checked(value: boolean): string {
  return value ? " checked" : "";
}

function pageNumber(value: number | undefined): number {
  return Math.max(1, Math.floor(value ?? 1));
}

function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

function pageItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (pageNumber(page) - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function queryString(
  params: Record<string, string | number | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value) !== "") {
      query.set(key, String(value));
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function statusLabel(status: CalendarEntryStatus): string {
  return status.replaceAll("_", " ");
}

function modeLabel(mode: CalendarPosterMode): string {
  if (mode === "exact_message") return "Custom poster";
  if (mode === "inspiration") return "Inspiration poster";
  return "Calendar poster";
}

function posterTypeOptions(current: PosterType): string {
  const options: Array<[PosterType, string]> = [
    ["general", "General"],
    ["awareness", "Awareness / tip"],
    ["offer", "Offer"],
    ["festival", "Festival / special day"],
    ["anniversary", "Anniversary / milestone"],
    ["reference", "Inspired by image"],
  ];
  return options
    .map(
      ([value, label]) =>
        `<option value="${value}"${selected(value, current)}>${escapeHtml(label)}</option>`,
    )
    .join("");
}

function historyPosterTypeOptions(current: string): string {
  const options: Array<[string, string]> = [
    ["all", "All types"],
    ["general", "General"],
    ["awareness", "Awareness / tip"],
    ["offer", "Offer"],
    ["festival", "Festival / special day"],
    ["anniversary", "Anniversary / milestone"],
    ["review", "Review"],
    ["reference", "Inspired by image"],
  ];
  return options
    .map(
      ([value, label]) =>
        `<option value="${value}"${selected(value, current)}>${escapeHtml(label)}</option>`,
    )
    .join("");
}

function historyStatusOptions(current: string): string {
  const options: Array<[string, string]> = [
    ["all", "All statuses"],
    ["ready", "Ready"],
    ["processing", "Processing"],
    ["pending", "Pending"],
    ["needs_review", "Needs review"],
    ["failed", "Failed"],
  ];
  return options
    .map(
      ([value, label]) =>
        `<option value="${value}"${selected(value, current)}>${escapeHtml(label)}</option>`,
    )
    .join("");
}

function templateOptions(
  patterns: PosterTemplatePattern[],
  current: string | null,
): string {
  return [
    `<option value="">Auto choose</option>`,
    ...patterns
      .filter((pattern) => pattern.isActive)
      .map(
        (pattern) =>
          `<option value="${escapeHtml(pattern.templateId)}"${selected(pattern.templateId, current ?? "")}>${escapeHtml(pattern.name)}</option>`,
      ),
  ].join("");
}

const styles = `
  :root {
    --ink: #102f30;
    --muted: #647776;
    --line: #dce7e5;
    --soft: #f4f8f7;
    --card: #ffffff;
    --teal: #087f7d;
    --teal-hover: #056765;
    --teal-light: #e5f4f3;
    --good-bg: #eafaf1;
    --good-text: #0f5132;
    --planned-bg: #edf7ff;
    --planned-text: #075985;
    --warn-bg: #fffbf0;
    --warn-text: #b45309;
    --bad-bg: #fff0ed;
    --bad-text: #9b392c;
    --shadow-premium: 0 16px 40px rgba(16, 47, 48, 0.05);
    --shadow-card: 0 4px 20px rgba(16, 47, 48, 0.02);
    --radius-lg: 20px;
    --radius-md: 12px;
  }
  
  * {
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }
  
  body {
    margin: 0;
    background-color: var(--soft);
    color: var(--ink);
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 15px;
    line-height: 1.6;
  }
  
  a {
    color: var(--teal);
    text-decoration: none;
    transition: color 0.15s ease;
  }
  a:hover {
    color: var(--teal-hover);
  }
  
  .shell {
    width: min(1180px, calc(100% - 32px));
    margin: 28px auto 72px;
  }
  
  .hero {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-premium);
    padding: 30px;
    margin-bottom: 24px;
  }
  
  .hero-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  
  .eyebrow {
    margin: 0 0 6px;
    color: var(--teal);
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 800;
  }
  
  .hero h1 {
    margin: 0;
    font-size: clamp(1.6rem, 3.5vw, 2.3rem);
    letter-spacing: -0.035em;
    font-weight: 800;
    line-height: 1.25;
  }
  
  .help {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 0.94rem;
  }
  
  /* Tab Navigation */
  .nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 20px;
    border-top: 1px solid var(--line);
    padding-top: 20px;
  }
  
  .nav a {
    padding: 8px 16px;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    text-decoration: none;
    font-weight: 700;
    font-size: 0.88rem;
    transition: all 0.2s ease;
  }
  
  .nav a:hover {
    background: var(--teal-light);
    color: var(--teal);
  }
  
  /* Pure CSS Tab Visibility Toggle */
  .view-panel {
    display: none;
  }
  
  /* Default View (Today) */
  #today {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 20px;
  }
  
  body:has(#calendar:target) #today { display: none; }
  body:has(#inspiration:target) #today { display: none; }
  body:has(#templates:target) #today { display: none; }
  body:has(#settings:target) #today { display: none; }
  body:has(#history:target) #today { display: none; }
  
  #calendar:target,
  #inspiration:target,
  #templates:target,
  #settings:target,
  #history:target {
    display: block !important;
  }
  
  #today:target {
    display: grid !important;
  }
  
  /* Active tab styles based on targeted sections */
  body:not(:has(:target)) .nav a[href="#today"],
  body:has(#today:target) .nav a[href="#today"],
  body:has(#calendar:target) .nav a[href="#calendar"],
  body:has(#inspiration:target) .nav a[href="#inspiration"],
  body:has(#templates:target) .nav a[href="#templates"],
  body:has(#settings:target) .nav a[href="#settings"],
  body:has(#history:target) .nav a[href="#history"] {
    background: var(--ink);
    color: #fff;
  }
  
  /* Card Styling */
  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: 26px;
    margin-bottom: 20px;
  }
  
  .card.wide {
    width: 100%;
  }
  
  h2 {
    margin: 0 0 10px;
    font-size: 1.35rem;
    letter-spacing: -0.02em;
    font-weight: 800;
  }
  
  h3 {
    margin: 24px 0 12px;
    font-size: 1.1rem;
    font-weight: 750;
  }
  
  /* Buttons */
  .button, button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-md);
    padding: 11px 18px;
    background: var(--ink);
    color: #fff;
    font: inherit;
    font-weight: 750;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.12s ease;
  }
  .button:hover, button:hover {
    background: #194344;
    transform: translateY(-1px);
  }
  .button:active, button:active {
    transform: translateY(0);
  }
  
  .button.secondary, button.secondary {
    background: var(--teal-light);
    color: var(--teal);
  }
  .button.secondary:hover, button.secondary:hover {
    background: #d4eae8;
  }
  
  button.danger {
    background: var(--bad-bg);
    color: var(--bad-text);
    border: 1px solid #ebcbc6;
  }
  button.danger:hover {
    background: #ffd9d2;
  }
  
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .segmented {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: #f8fbfb;
  }
  .segmented label {
    margin: 0;
    padding: 8px 12px;
    border-radius: 8px;
    color: var(--muted);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .segmented input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .segmented label:has(input:checked) {
    background: var(--ink);
    color: #fff;
  }
  
  /* Stats panel */
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .stat {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 16px;
    background: #fbfdfd;
    text-align: center;
  }
  .stat span {
    display: block;
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .stat strong {
    font-size: 1.5rem;
    font-weight: 800;
  }
  
  /* Pills */
  .pill {
    display: inline-flex;
    padding: 4px 10px;
    border-radius: 999px;
    background: #eef4f3;
    color: var(--ink);
    font-size: 0.76rem;
    font-weight: 750;
    text-transform: capitalize;
  }
  .ready, .poster_ready {
    background: var(--good-bg);
    color: var(--good-text);
  }
  .planned {
    background: var(--planned-bg);
    color: var(--planned-text);
  }
  .needs_message {
    background: var(--warn-bg);
    color: var(--warn-text);
  }
  .skipped {
    background: var(--bad-bg);
    color: var(--bad-text);
  }
  
  /* Poster Frame styling */
  .today-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 26px;
    align-items: start;
  }
  
  .poster-container {
    perspective: 1000px;
  }
  
  .poster-preview {
    width: 100%;
    aspect-ratio: 9/16;
    background: #fafcfc;
    border: 1px solid var(--line);
    border-radius: 20px;
    box-shadow: 0 15px 35px rgba(16, 47, 48, 0.08);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  
  .poster-preview:hover {
    transform: translateY(-4px) rotateY(-2deg);
    box-shadow: 0 22px 45px rgba(16, 47, 48, 0.12);
  }
  
  .poster-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .empty {
    padding: 30px;
    text-align: center;
    color: var(--muted);
    font-weight: 600;
  }
  
  /* Timeline Lists */
  .next-list, .calendar-list {
    display: grid;
    gap: 12px;
  }

  .calendar-board {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 10px;
  }

  .weekday {
    color: var(--muted);
    font-size: 0.76rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .day-card {
    min-height: 126px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: #fbfdfd;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .day-card.empty-day {
    background: transparent;
    border-style: dashed;
    opacity: 0.35;
  }

  .day-card .topic {
    font-size: 0.88rem;
    line-height: 1.35;
  }

  .view-switch .calendar-list-view {
    display: none;
  }

  .view-switch:has(#calendar-view-list:checked) .calendar-grid-view {
    display: none;
  }

  .view-switch:has(#calendar-view-list:checked) .calendar-list-view {
    display: block;
  }
  
  .next-item, .calendar-row {
    display: grid;
    grid-template-columns: 100px 1fr auto;
    gap: 16px;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: #fbfdfd;
    padding: 14px 18px;
    transition: background 0.15s ease;
  }
  
  .next-item:hover, .calendar-row:hover {
    background: #f4f8f7;
  }
  
  .date {
    font-weight: 800;
    color: var(--teal);
    font-size: 1.05rem;
  }
  
  .topic {
    font-weight: 750;
    font-size: 0.98rem;
  }
  
  .mini {
    font-size: 0.84rem;
    color: var(--muted);
    font-weight: 500;
  }
  
  label {
    display: block;
    font-weight: 750;
    margin: 14px 0 6px;
    font-size: 0.9rem;
  }
  
  input, select, textarea {
    width: 100%;
    border: 1px solid #bfd3d1;
    border-radius: 10px;
    padding: 10px 14px;
    background: #fff;
    color: var(--ink);
    font-family: inherit;
    font-size: 0.92rem;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--teal);
    box-shadow: 0 0 0 3px rgba(8, 127, 125, 0.12);
  }
  
  textarea {
    min-height: 100px;
    resize: vertical;
  }
  
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
  }
  
  /* Details forms as Drawers */
  details.drawer {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: #fdfefe;
    margin-top: -6px;
    margin-bottom: 12px;
    overflow: hidden;
    box-shadow: var(--shadow-card);
  }
  
  details.drawer summary {
    padding: 14px 18px;
    font-weight: 750;
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  details.drawer summary::-webkit-details-marker {
    display: none;
  }
  
  details.drawer[open] {
    border-color: var(--teal);
    background: #fff;
  }
  
  details.drawer[open] summary {
    border-bottom: 1px solid var(--line);
  }
  
  details.drawer form {
    padding: 18px;
  }
  
  .message {
    padding: 12px 16px;
    border-radius: var(--radius-md);
    background: var(--good-bg);
    color: var(--good-text);
    font-weight: 750;
    margin: 14px 0;
  }
  .message.error {
    background: var(--bad-bg);
    color: var(--bad-text);
  }
  
  .calendar-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  
  .row-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  
  .row-actions button, .row-actions .button {
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.84rem;
  }
  
  .thumb {
    width: 48px;
    height: 64px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: #fff;
  }

  .rework-panel {
    display: none;
    margin-top: 18px;
  }

  .rework-panel:target {
    display: block;
  }

  .filter-bar {
    display: grid;
    grid-template-columns: repeat(3, minmax(160px, 1fr)) auto;
    gap: 12px;
    align-items: end;
    margin: 18px 0 22px;
  }

  .gallery {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .poster-card {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: #fbfdfd;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .poster-card figure {
    margin: 0;
    aspect-ratio: 9 / 16;
    background: #eef4f3;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .poster-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .poster-card-body {
    padding: 12px;
    display: grid;
    gap: 8px;
  }

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 18px;
  }
  
  @media (max-width: 900px) {
    .today-grid {
      grid-template-columns: 1fr;
    }
    #today {
      grid-template-columns: 1fr;
    }
    .poster-preview {
      max-width: 260px;
    }
    .calendar-row, .next-item {
      grid-template-columns: 1fr;
      text-align: left;
      gap: 10px;
    }
    .row-actions {
      justify-content: flex-start;
      margin-top: 10px;
    }
    .fields {
      grid-template-columns: 1fr;
    }
    .calendar-board {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .weekday {
      display: none;
    }
    .filter-bar {
      grid-template-columns: 1fr;
    }
    .gallery {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    .gallery {
      grid-template-columns: 1fr;
    }
    .calendar-board {
      grid-template-columns: 1fr;
    }
  }
`;

function document(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>${styles}</style></head><body>${body}</body></html>`;
}

function entryForm(input: {
  brand: BusinessBrandSystem;
  entry: ContentCalendarEntry | null;
  date: string;
  templatePatterns: PosterTemplatePattern[];
  open?: boolean;
}): string {
  const { brand, entry, date, templatePatterns, open = false } = input;
  const mode = entry?.posterMode ?? "normal";
  const status = entry?.status ?? "planned";
  const posterType = entry?.posterType ?? "general";
  return `<details class="drawer" id="edit-${escapeHtml(date)}"${open ? " open" : ""}>
    <summary><strong>${entry ? "Edit" : "Add"} ${escapeHtml(date)}</strong> <span class="mini">topic, message, CTA, and inspiration image</span></summary>
    <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/save" enctype="multipart/form-data">
      <input type="hidden" name="date" value="${escapeHtml(date)}">
      <div class="fields">
        <div><label>Topic</label><input name="topic" value="${escapeHtml(entry?.topic ?? "")}" placeholder="Example: Summer skincare tips" required></div>
        <div><label>CTA</label><input name="cta" value="${escapeHtml(entry?.cta ?? "")}" placeholder="Book now / Call today"></div>
      </div>
      <label>Message</label><textarea name="message" placeholder="Optional. Add exact text if this is an offer, event, or announcement.">${escapeHtml(entry?.message ?? "")}</textarea>
      <div class="fields">
        <div><label>Poster mode</label><select name="posterMode">
          <option value="normal"${selected("normal", mode)}>Calendar poster</option>
          <option value="exact_message"${selected("exact_message", mode)}>Custom poster — use my message</option>
          <option value="inspiration"${selected("inspiration", mode)}>Inspiration poster</option>
        </select></div>
        <div><label>Poster type</label><select name="posterType">${posterTypeOptions(posterType)}</select></div>
      </div>
      <label>Poster style</label><select name="templateId">${templateOptions(templatePatterns, entry?.templateId ?? null)}</select>
      <p class="mini">Leave this on Auto choose unless you want a specific saved template pattern for this date.</p>
      <div class="fields">
        <div><label>Status</label><select name="status">
          <option value="planned"${selected("planned", status)}>Planned</option>
          <option value="needs_message"${selected("needs_message", status)}>Needs message</option>
          <option value="skipped"${selected("skipped", status)}>Skipped</option>
          <option value="poster_ready"${selected("poster_ready", status)}>Poster ready</option>
        </select></div>
        <div><label>Inspiration image</label><input name="inspirationImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div>
      </div>
      ${
        entry?.inspirationImageUrl
          ? `<p class="mini">Current inspiration image saved. Upload a new one only if you want to replace it.</p><input type="hidden" name="existingInspirationImageUrl" value="${escapeHtml(entry.inspirationImageUrl)}">`
          : ""
      }
      <label>Notes</label><textarea name="notes" placeholder="Optional guidance: style, do/don't copy, offer terms, audience, etc.">${escapeHtml(entry?.notes ?? "")}</textarea>
      <div class="actions" style="margin-top: 18px;">
        <button type="submit">Save calendar item</button>
        <button class="secondary" type="submit" formaction="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster">Generate poster now</button>
      </div>
    </form>
  </details>`;
}

export function renderCustomerApp(input: {
  brand: BusinessBrandSystem;
  month: string;
  today: string;
  calendarEntries: ContentCalendarEntry[];
  nextEntries: ContentCalendarEntry[];
  todayEntry: ContentCalendarEntry | null;
  todayPoster: GeneratedPoster | null;
  recentPosters: GeneratedPoster[];
  templatePatterns: PosterTemplatePattern[];
  automationSettings: AutomationSettings;
  calendarPage?: number;
  historyPage?: number;
  historyPosterType?: string;
  historyStatus?: string;
  editDate?: string;
  message?: string;
  error?: string;
}): string {
  const {
    brand,
    month,
    today,
    calendarEntries,
    nextEntries,
    todayEntry,
    todayPoster,
    recentPosters,
    templatePatterns,
    automationSettings,
    calendarPage: rawCalendarPage,
    historyPage: rawHistoryPage,
    historyPosterType = "all",
    historyStatus = "all",
    editDate,
    message,
    error,
  } = input;
  const entryByDate = new Map(
    calendarEntries.map((entry) => [entry.date, entry]),
  );
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year!, monthNumber!, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
  const readyCount = calendarEntries.filter(
    (entry) => entry.status === "poster_ready",
  ).length;
  const plannedCount = calendarEntries.filter(
    (entry) => entry.status === "planned",
  ).length;
  const missingCount = dates.length - calendarEntries.length;
  const calendarListPageSize = 8;
  const calendarPage = Math.min(
    pageNumber(rawCalendarPage),
    pageCount(dates.length, calendarListPageSize),
  );
  const pagedDates = pageItems(dates, calendarPage, calendarListPageSize);
  const firstWeekday = new Date(year!, monthNumber! - 1, 1).getDay();
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedEditDate = dates.includes(editDate ?? "") ? editDate! : null;
  const selectedEditEntry = selectedEditDate
    ? entryByDate.get(selectedEditDate) ?? null
    : null;
  const calendarEditHtml = selectedEditDate
    ? entryForm({
        brand,
        entry: selectedEditEntry,
        date: selectedEditDate,
        templatePatterns,
        open: true,
      })
    : "";
  const todayImage =
    todayPoster?.status === "ready" && todayPoster.imageUrl
      ? `<img src="${escapeHtml(todayPoster.imageUrl)}" alt="Today's generated poster">`
      : `<div class="empty">No ready poster yet.<br><span class="mini">Generate it now or let automation create it.</span></div>`;
  const calendarRows = pagedDates
    .map((date) => {
      const entry = entryByDate.get(date) ?? null;
      return `<div class="calendar-row">
        <div>
          <div class="date">${escapeHtml(date.slice(5))}</div>
          <span class="pill ${escapeHtml(entry?.status ?? "needs_message")}">${escapeHtml(entry ? statusLabel(entry.status) : "empty")}</span>
        </div>
        <div>
          <div class="topic">${escapeHtml(entry?.topic ?? "No content planned")}</div>
          <div class="mini">${escapeHtml(entry ? `${modeLabel(entry.posterMode)} · ${entry.posterType}` : "Add manually or generate the month with AI")}</div>
          ${entry?.message ? `<div class="mini" style="margin-top: 4px; color: var(--text-main); font-weight: 500;">${escapeHtml(entry.message)}</div>` : ""}
        </div>
        <div class="row-actions">
          ${entry?.inspirationImageUrl ? `<img class="thumb" src="${escapeHtml(entry.inspirationImageUrl)}" alt="Inspiration">` : ""}
          <a class="button secondary" href="/app/${escapeHtml(brand.businessSlug)}${queryString({ month, calendarPage, editDate: date })}#calendar">Edit</a>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster">
            <input type="hidden" name="date" value="${escapeHtml(date)}">
            <button type="submit">Generate</button>
          </form>
        </div>
      </div>`;
    })
    .join("");
  const calendarGrid = [
    ...weekdays.map((day) => `<div class="weekday">${day}</div>`),
    ...Array.from(
      { length: firstWeekday },
      () => `<div class="day-card empty-day" aria-hidden="true"></div>`,
    ),
    ...dates.map((date) => {
      const entry = entryByDate.get(date) ?? null;
      return `<div class="day-card">
        <div class="date">${escapeHtml(date.slice(8))}</div>
        <span class="pill ${escapeHtml(entry?.status ?? "needs_message")}">${escapeHtml(entry ? statusLabel(entry.status) : "empty")}</span>
        <div class="topic">${escapeHtml(entry?.topic ?? "No content planned")}</div>
        <div class="mini">${escapeHtml(entry ? modeLabel(entry.posterMode) : "Add or generate")}</div>
        <div class="row-actions" style="justify-content:flex-start; margin-top:auto;">
          <a class="button secondary" href="/app/${escapeHtml(brand.businessSlug)}${queryString({ month, editDate: date })}#calendar">Edit</a>
        </div>
      </div>`;
    }),
  ].join("");
  const calendarTotalPages = pageCount(dates.length, calendarListPageSize);
  const calendarPagination = `<div class="pagination">
    <a class="button secondary" href="/app/${escapeHtml(brand.businessSlug)}${queryString({ month, calendarPage: Math.max(1, calendarPage - 1) })}#calendar">Previous</a>
    <span class="mini">Page ${escapeHtml(calendarPage)} of ${escapeHtml(calendarTotalPages)}</span>
    <a class="button secondary" href="/app/${escapeHtml(brand.businessSlug)}${queryString({ month, calendarPage: Math.min(calendarTotalPages, calendarPage + 1) })}#calendar">Next</a>
  </div>`;
  const nextHtml = nextEntries.length
    ? nextEntries
        .map(
          (entry) => `<div class="next-item">
            <div class="date">${escapeHtml(entry.date.slice(5))}</div>
            <div>
              <div class="topic">${escapeHtml(entry.topic)}</div>
              <div class="mini">${escapeHtml(modeLabel(entry.posterMode))}</div>
            </div>
            <span class="pill ${escapeHtml(entry.status)}">${escapeHtml(statusLabel(entry.status))}</span>
          </div>`,
        )
        .join("")
    : `<div class="empty">No upcoming content planned yet.</div>`;
  const filteredHistory = recentPosters.filter(
    (poster) =>
      (historyPosterType === "all" ||
        poster.posterType === historyPosterType) &&
      (historyStatus === "all" || poster.status === historyStatus),
  );
  const historyPageSize = 8;
  const historyTotalPages = pageCount(filteredHistory.length, historyPageSize);
  const historyPage = Math.min(pageNumber(rawHistoryPage), historyTotalPages);
  const historyItems = pageItems(filteredHistory, historyPage, historyPageSize);
  const historyHtml = historyItems.length
    ? `<div class="gallery">${historyItems
        .map(
          (poster) => `<article class="poster-card">
            <figure>
              ${
                poster.imageUrl
                  ? `<img src="${escapeHtml(poster.imageUrl)}" alt="${escapeHtml(poster.angle || poster.posterType)} poster">`
                  : `<div class="empty">${escapeHtml(poster.status)}</div>`
              }
            </figure>
            <div class="poster-card-body">
              <div class="date">${escapeHtml(poster.date)}</div>
              <div class="topic">${escapeHtml(poster.angle || poster.posterType)}</div>
              <div class="mini">${escapeHtml(poster.posterType)} · ${escapeHtml(poster.status)}</div>
              ${
                poster.imageUrl
                  ? `<a class="button secondary" href="${escapeHtml(poster.imageUrl)}" target="_blank" rel="noopener">Download</a>`
                  : `<span class="pill">${escapeHtml(poster.status)}</span>`
              }
            </div>
          </article>`,
        )
        .join("")}</div>
      <div class="pagination">
        <a class="button secondary" href="/app/${escapeHtml(brand.businessSlug)}${queryString({ month, historyPosterType, historyStatus, historyPage: Math.max(1, historyPage - 1) })}#history">Previous</a>
        <span class="mini">Page ${escapeHtml(historyPage)} of ${escapeHtml(historyTotalPages)} · ${escapeHtml(filteredHistory.length)} posters</span>
        <a class="button secondary" href="/app/${escapeHtml(brand.businessSlug)}${queryString({ month, historyPosterType, historyStatus, historyPage: Math.min(historyTotalPages, historyPage + 1) })}#history">Next</a>
      </div>`
    : `<div class="empty">No posters match these filters yet.</div>`;
  return document(
    `${brand.businessName} — Daily Poster`,
    `<main class="shell">
      <header class="hero">
        <div class="hero-header">
          <div>
            <p class="eyebrow">Daily Poster</p>
            <h1>Plan your month once. Get a branded poster every day.</h1>
            <p class="help">${escapeHtml(brand.businessName)} · ${escapeHtml(automationSettings.enabled ? `Active at ${automationSettings.localTime}` : "Automation paused")}</p>
          </div>
          <div class="actions">
            <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster">
              <input type="hidden" name="date" value="${escapeHtml(today)}">
              <button type="submit">Generate today</button>
            </form>
            <a class="button secondary" href="#calendar">Plan month</a>
          </div>
        </div>
        <nav class="nav">
          <a href="#today">Today</a>
          <a href="#calendar">Content Calendar</a>
          <a href="#inspiration">Inspiration Poster</a>
          <a href="#templates">Templates & Brand</a>
          <a href="#settings">Automation Settings</a>
          <a href="#history">Poster History</a>
          <a href="/admin/${escapeHtml(brand.businessSlug)}" style="margin-left: auto;">Admin studio ↗</a>
        </nav>
      </header>
      ${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}
      ${error ? `<p class="message error">${escapeHtml(error)}</p>` : ""}
      
      <!-- VIEW: TODAY'S DASHBOARD -->
      <section class="view-panel" id="today">
        <article class="card wide" style="margin-bottom:0;">
          <div class="today-grid">
            <div class="poster-container">
              <div class="poster-preview">${todayImage}</div>
            </div>
            <div style="display: flex; flex-direction: column; justify-content: center; height: 100%;">
              <p class="eyebrow">Today's Content</p>
              <h2>${escapeHtml(todayEntry?.topic ?? "No topic planned for today")}</h2>
              <p style="color: var(--muted); margin-bottom: 24px;">${escapeHtml(todayEntry?.message ?? "Add today's message, generate a poster now, or let the daily automation use a safe AI fallback.")}</p>
              <div class="actions">
                ${todayPoster?.imageUrl ? `<a class="button" href="${escapeHtml(todayPoster.imageUrl)}" target="_blank" rel="noopener">Download Poster</a>` : ""}
                <a class="button secondary" href="#rework-today">Edit message</a>
                <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster">
                  <input type="hidden" name="date" value="${escapeHtml(today)}">
                  <input type="hidden" name="force" value="true">
                  <button class="secondary" type="submit">Create another</button>
                </form>
              </div>
              <div class="rework-panel" id="rework-today">
                <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster">
                  <input type="hidden" name="date" value="${escapeHtml(today)}">
                  <input type="hidden" name="force" value="true">
                  <input type="hidden" name="posterMode" value="exact_message">
                  <input type="hidden" name="posterType" value="${escapeHtml(todayEntry?.posterType ?? "general")}">
                  <input type="hidden" name="status" value="planned">
                  <input type="hidden" name="templateId" value="${escapeHtml(todayEntry?.templateId ?? "")}">
                  <label>Rework request</label>
                  <textarea name="message" required placeholder="Example: Make this poster more premium, mention painless wisdom tooth evaluation, and use a calmer headline.">${escapeHtml(todayEntry?.message ?? todayPoster?.angle ?? "")}</textarea>
                  <div class="fields">
                    <div><label>Topic</label><input name="topic" value="${escapeHtml(todayEntry?.topic ?? todayPoster?.angle ?? "Today's content")}" required></div>
                    <div><label>CTA</label><input name="cta" value="${escapeHtml(todayEntry?.cta ?? "")}" placeholder="Book now / Call today"></div>
                  </div>
                  <label>Extra notes</label>
                  <textarea name="notes" placeholder="Optional style direction, audience, words to avoid, or offer details.">${escapeHtml(todayEntry?.notes ?? "")}</textarea>
                  <div class="actions" style="margin-top: 14px;">
                    <button type="submit">Rework poster</button>
                    <a class="button secondary" href="#today">Cancel</a>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </article>
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <article class="card" style="margin-bottom:0;">
            <h2>Calendar health</h2>
            <div class="stats" style="margin-top: 14px;">
              <div class="stat"><span class="mini">Planned</span><strong>${plannedCount}</strong></div>
              <div class="stat"><span class="mini">Ready</span><strong>${readyCount}</strong></div>
              <div class="stat"><span class="mini">Empty</span><strong>${missingCount}</strong></div>
            </div>
          </article>
          <article class="card" style="margin-bottom:0; flex-grow: 1;">
            <h2>Next 7 days</h2>
            <div class="next-list" style="margin-top: 14px;">${nextHtml}</div>
          </article>
        </div>
      </section>
      
      <!-- VIEW: CONTENT CALENDAR -->
      <section class="card wide view-panel" id="calendar">
        <div class="calendar-tools">
          <div>
            <p class="eyebrow">Monthly calendar</p>
            <h2>${escapeHtml(month)}</h2>
            <p class="help">Edit manually, generate the month with AI, or upload inspiration for a specific day.</p>
          </div>
          <form method="get" action="/app/${escapeHtml(brand.businessSlug)}">
            <label style="margin-top: 0;">Select Month</label>
            <input type="month" name="month" value="${escapeHtml(month)}" onchange="this.form.submit()">
          </form>
        </div>
        <details class="drawer" style="margin-bottom: 20px;">
          <summary><strong>Generate calendar with AI</strong> <span class="mini">fills empty or existing dates for the selected month</span></summary>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-month">
            <input type="hidden" name="month" value="${escapeHtml(month)}">
            <div class="fields">
              <div><label>Posting frequency</label><select name="frequency"><option value="daily">Daily</option><option value="weekdays">Weekdays only</option></select></div>
              <div><label>Content style</label><select name="style"><option value="mixed">Mixed</option><option value="educational">Educational</option><option value="promotional">Promotional</option><option value="engagement">Engagement</option></select></div>
            </div>
            <label>Important offers, events, or notes</label><textarea name="notes" placeholder="Example: promote summer package in last week, avoid discount-heavy tone"></textarea>
            <div class="actions" style="margin-top: 14px;"><button type="submit">Generate this month’s calendar</button></div>
          </form>
        </details>
        ${calendarEditHtml}
        <div class="view-switch">
          <div class="calendar-tools" style="margin-bottom: 14px;">
            <div class="segmented">
              <label><input id="calendar-view-grid" type="radio" name="calendarView" checked> Calendar</label>
              <label><input id="calendar-view-list" type="radio" name="calendarView"> List</label>
            </div>
            <span class="mini">${escapeHtml(calendarEntries.length)} planned items this month</span>
          </div>
          <div class="calendar-grid-view">
            <div class="calendar-board">${calendarGrid}</div>
          </div>
          <div class="calendar-list-view">
            <div class="calendar-list">${calendarRows}</div>
            ${calendarPagination}
          </div>
        </div>
      </section>
      
      <!-- VIEW: INSPIRATION POSTER -->
      <section class="card wide view-panel" id="inspiration">
        <p class="eyebrow">Inspiration poster</p>
        <h2>Create from a poster you like</h2>
        <p class="help" style="margin-bottom: 24px;">Upload an inspiration poster, add your own message, and save it to a calendar date. The design direction is used; competitor branding, text, claims, and contact details are not copied.</p>
        ${entryForm({ brand, entry: { businessSlug: brand.businessSlug, date: today, topic: "", message: null, cta: null, posterMode: "inspiration", posterType: "reference", templateId: null, inspirationImageUrl: null, notes: null, status: "planned" }, date: today, templatePatterns })}
      </section>
      
      <!-- VIEW: TEMPLATES & BRAND -->
      <section class="card wide view-panel" id="templates">
        <p class="eyebrow">Brand & Templates</p>
        <h2>Current brand style</h2>
        <p class="help">This explains why posters currently look the way they do. Normal daily users can ignore this section.</p>
        <div class="grid" style="margin-top: 20px;">
          <div class="card" style="box-shadow:none; border: 1px solid var(--line); margin-bottom: 0;">
            <h3>Brand assets</h3>
            <div class="fields">
              <div><label>Logo</label><div class="poster-preview" style="max-height: 180px;"><img src="${escapeHtml(brand.logoUrl)}" alt="Logo"></div></div>
              <div><label>Brand board</label><div class="poster-preview" style="max-height: 180px;"><img src="${escapeHtml(brand.brandReferenceBoardUrl)}" alt="Brand reference board"></div></div>
            </div>
          </div>
          <div class="card" style="box-shadow:none; border: 1px solid var(--line); margin-bottom: 0;">
            <h3>Style summary</h3>
            <p><strong>Typography:</strong><br>${escapeHtml(brand.typography.headingStyle)} · ${escapeHtml(brand.typography.fontMood)}</p>
            <p><strong>Mood:</strong><br>${escapeHtml(brand.visualStyle.mood)}</p>
            <p><strong>Layout:</strong><br>${escapeHtml(brand.visualStyle.layout)}</p>
            <p><strong>Photo style:</strong><br>${escapeHtml(brand.visualStyle.photoStyle)}</p>
            <div class="actions" style="margin-top: 24px;"><a class="button secondary" href="/admin/${escapeHtml(brand.businessSlug)}#brand">Edit advanced brand system</a></div>
          </div>
        </div>
        <details class="drawer" style="margin-top: 24px; margin-bottom: 24px;">
          <summary><strong>Generate template ideas with AI</strong> <span class="mini">creates visual pattern cards, not final posters</span></summary>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/templates/generate">
            <label>What kind of templates do you want?</label>
            <textarea name="notes" placeholder="Example: premium clinic style, clean educational posts, festival greetings, bold offers, minimal typography"></textarea>
            <div class="actions" style="margin-top: 14px;"><button type="submit">Generate template ideas</button></div>
          </form>
        </details>
        ${
          templatePatterns.length
            ? `<div class="calendar-list">${templatePatterns
                .map(
                  (pattern) => `<div class="calendar-row">
                    <div>${pattern.previewImageUrl ? `<img class="thumb" src="${escapeHtml(pattern.previewImageUrl)}" alt="">` : `<span class="pill">${escapeHtml(pattern.isActive ? "active" : "paused")}</span>`}</div>
                    <div>
                      <div class="topic">${escapeHtml(pattern.name)}</div>
                      <div class="mini">${escapeHtml(pattern.bestFor)}</div>
                      <p class="mini" style="margin-top: 4px; line-height: 1.4;">${escapeHtml(pattern.description)}</p>
                    </div>
                    <div class="row-actions">
                      <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/templates/toggle">
                        <input type="hidden" name="templateId" value="${escapeHtml(pattern.templateId)}">
                        <input type="hidden" name="isActive" value="${escapeHtml(pattern.isActive ? "false" : "true")}">
                        <button class="secondary" type="submit">${escapeHtml(pattern.isActive ? "Pause" : "Activate")}</button>
                      </form>
                      <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/templates/delete">
                        <input type="hidden" name="templateId" value="${escapeHtml(pattern.templateId)}">
                        <button class="danger" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>`,
                )
                .join("")}</div>`
            : `<div class="empty">No template patterns yet. Generate ideas to create visual style cards for this business.</div>`
        }
      </section>
      
      <!-- VIEW: AUTOMATION SETTINGS -->
      <section class="card wide view-panel" id="settings">
        <p class="eyebrow">Settings</p>
        <h2>Simple automation settings</h2>
        <p class="help" style="margin-bottom: 24px;">Configure when the poster is generated and which emails receive the completed designs daily.</p>
        <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/settings">
          <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 1rem; cursor: pointer; margin-bottom: 18px;">
            <input style="width: auto; margin: 0;" type="checkbox" name="enabled"${checked(automationSettings.enabled)}> 
            <span><strong>Daily posters active</strong></span>
          </label>
          <div class="fields">
            <div><label>Daily generation time</label><input name="localTime" type="time" value="${escapeHtml(automationSettings.localTime)}"></div>
            <div><label>Delivery emails (comma-separated)</label><input name="recipientEmails" value="${escapeHtml(automationSettings.recipientEmails.join(", "))}" placeholder="owner@example.com"></div>
          </div>
          <input type="hidden" name="posterTypes" value="general">
          <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 14px;">
            <input style="width: auto; margin: 0;" type="checkbox" name="emailEnabled"${checked(automationSettings.emailEnabled)}> 
            <span>Email poster automatically after generation</span>
          </label>
          <div class="actions" style="margin-top: 24px;"><button type="submit">Save settings</button></div>
        </form>
      </section>
      
      <!-- VIEW: POSTER HISTORY -->
      <section class="card wide view-panel" id="history">
        <p class="eyebrow">Poster history</p>
        <h2>Gallery</h2>
        <p class="help">Browse, filter, and download generated posters for your business.</p>
        <form class="filter-bar" method="get" action="/app/${escapeHtml(brand.businessSlug)}#history">
          <input type="hidden" name="month" value="${escapeHtml(month)}">
          <div><label>Poster type</label><select name="historyPosterType">${historyPosterTypeOptions(historyPosterType)}</select></div>
          <div><label>Status</label><select name="historyStatus">${historyStatusOptions(historyStatus)}</select></div>
          <div><label>Page</label><input type="number" min="1" name="historyPage" value="${escapeHtml(historyPage)}"></div>
          <button type="submit">Apply filters</button>
        </form>
        ${historyHtml}
      </section>
    </main>`,
  );
}
