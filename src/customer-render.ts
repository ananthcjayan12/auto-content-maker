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
  :root{--ink:#142526;--muted:#6b7b7b;--line:#dfe8e6;--soft:#f5f8f7;--card:#fff;--teal:#087f7d;--teal2:#dff4f1;--good:#157347;--warn:#9a5b00;--bad:#a0392c;--shadow:0 18px 50px rgba(20,37,38,.07)}
  *{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#eef7f5 0,#f8faf9 260px);color:var(--ink);font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--teal)}
  .shell{width:min(1180px,calc(100% - 28px));margin:22px auto 64px}.hero,.card{background:var(--card);border:1px solid var(--line);border-radius:24px;box-shadow:var(--shadow)}.hero{padding:26px;display:flex;justify-content:space-between;gap:20px;align-items:center}.eyebrow{margin:0 0 4px;color:var(--teal);font-size:.74rem;text-transform:uppercase;letter-spacing:.12em;font-weight:900}.hero h1{margin:0;font-size:clamp(1.65rem,4vw,2.55rem);letter-spacing:-.045em}.help{margin:5px 0 0;color:var(--muted)}.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .button,button{border:0;border-radius:13px;padding:11px 15px;background:var(--ink);color:#fff;font:inherit;font-weight:850;text-decoration:none;cursor:pointer}.button.secondary,button.secondary{background:var(--teal2);color:var(--ink)}button.danger{background:#fff0ed;color:var(--bad);border:1px solid #f0c7c0}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;margin-top:18px}.card{padding:22px}.wide{grid-column:1/-1}h2{margin:0 0 8px;font-size:1.28rem;letter-spacing:-.02em}h3{margin:20px 0 8px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.stat{border:1px solid var(--line);border-radius:16px;padding:15px;background:#fbfdfd}.stat strong{display:block;font-size:1.25rem}.pill{display:inline-flex;padding:5px 10px;border-radius:999px;background:#eef4f3;color:var(--ink);font-size:.78rem;font-weight:850;text-transform:capitalize}.ready,.poster_ready{background:#dcf8ec;color:var(--good)}.planned{background:#eaf3ff;color:#24538a}.needs_message{background:#fff5d7;color:var(--warn)}.skipped{background:#f4e7e4;color:var(--bad)}
  .today{display:grid;grid-template-columns:260px 1fr;gap:18px;align-items:start}.poster-preview{width:100%;min-height:280px;display:grid;place-items:center;background:#f6faf9;border:1px dashed #bdd2cf;border-radius:18px;overflow:hidden}.poster-preview img{width:100%;height:100%;object-fit:contain}.empty{padding:28px;text-align:center;color:var(--muted)}.next-list,.calendar-list{display:grid;gap:10px}.next-item,.calendar-row{display:grid;grid-template-columns:96px 1fr auto;gap:12px;align-items:center;border:1px solid var(--line);border-radius:16px;background:#fbfdfd;padding:12px}.date{font-weight:900}.topic{font-weight:850}.mini{font-size:.86rem;color:var(--muted)}label{display:block;font-weight:800;margin:13px 0 6px}input,select,textarea{width:100%;border:1px solid #bfd1cf;border-radius:12px;padding:10px 12px;background:#fff;color:var(--ink);font:inherit}textarea{min-height:90px;resize:vertical}.fields{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.drawer{border:1px solid var(--line);border-radius:18px;padding:16px;background:#fbfdfd;margin-top:12px}.message{padding:12px 14px;border-radius:14px;background:#dcf8ec;color:#126444;font-weight:800;margin:14px 0}.message.error{background:#fff0ed;color:var(--bad)}.nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.nav a{padding:8px 12px;border-radius:999px;background:#e7f2f0;color:var(--ink);text-decoration:none;font-weight:800;font-size:.86rem}.calendar-tools{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap}.row-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.row-actions button,.row-actions .button{padding:8px 10px;border-radius:10px;font-size:.86rem}.thumb{width:52px;height:72px;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:#fff}
  @media(max-width:860px){.hero,.today{grid-template-columns:1fr;display:grid}.grid,.stats{grid-template-columns:1fr}.wide{grid-column:auto}.calendar-row,.next-item{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.row-actions{justify-content:flex-start}}
`;

function document(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${body}</body></html>`;
}

function entryForm(input: {
  brand: BusinessBrandSystem;
  entry: ContentCalendarEntry | null;
  date: string;
  templatePatterns: PosterTemplatePattern[];
}): string {
  const { brand, entry, date, templatePatterns } = input;
  const mode = entry?.posterMode ?? "normal";
  const status = entry?.status ?? "planned";
  const posterType = entry?.posterType ?? "general";
  return `<details class="drawer" id="edit-${escapeHtml(date)}">
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
      <div class="actions">
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
  const todayImage =
    todayPoster?.status === "ready" && todayPoster.imageUrl
      ? `<img src="${escapeHtml(todayPoster.imageUrl)}" alt="Today's generated poster">`
      : `<div class="empty">No ready poster yet.<br><span class="mini">Generate it now or let automation create it at the scheduled time.</span></div>`;
  const calendarRows = dates
    .map((date) => {
      const entry = entryByDate.get(date) ?? null;
      return `<div class="calendar-row">
        <div><div class="date">${escapeHtml(date.slice(5))}</div><span class="pill ${escapeHtml(entry?.status ?? "needs_message")}">${escapeHtml(entry ? statusLabel(entry.status) : "empty")}</span></div>
        <div>
          <div class="topic">${escapeHtml(entry?.topic ?? "No content planned")}</div>
          <div class="mini">${escapeHtml(entry ? `${modeLabel(entry.posterMode)} · ${entry.posterType}` : "Add manually or generate the month with AI")}</div>
          ${entry?.message ? `<div class="mini">${escapeHtml(entry.message)}</div>` : ""}
        </div>
        <div class="row-actions">
          ${entry?.inspirationImageUrl ? `<img class="thumb" src="${escapeHtml(entry.inspirationImageUrl)}" alt="Inspiration">` : ""}
          <a class="button secondary" href="#edit-${escapeHtml(date)}">Edit</a>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster">
            <input type="hidden" name="date" value="${escapeHtml(date)}">
            <button type="submit">Generate</button>
          </form>
        </div>
      </div>${entryForm({ brand, entry, date, templatePatterns })}`;
    })
    .join("");
  const nextHtml = nextEntries.length
    ? nextEntries
        .map(
          (entry) => `<div class="next-item">
            <div class="date">${escapeHtml(entry.date.slice(5))}</div>
            <div><div class="topic">${escapeHtml(entry.topic)}</div><div class="mini">${escapeHtml(modeLabel(entry.posterMode))}</div></div>
            <span class="pill ${escapeHtml(entry.status)}">${escapeHtml(statusLabel(entry.status))}</span>
          </div>`,
        )
        .join("")
    : `<div class="empty">No upcoming content planned yet.</div>`;
  const recentHtml = recentPosters.length
    ? `<div class="calendar-list">${recentPosters
        .map(
          (poster) => `<div class="next-item">
            <div class="date">${escapeHtml(poster.date.slice(5))}</div>
            <div><div class="topic">${escapeHtml(poster.angle || poster.posterType)}</div><div class="mini">${escapeHtml(poster.posterType)} · ${escapeHtml(poster.status)}</div></div>
            ${
              poster.imageUrl
                ? `<a class="button secondary" href="${escapeHtml(poster.imageUrl)}" target="_blank" rel="noopener">Download</a>`
                : `<span class="pill">${escapeHtml(poster.status)}</span>`
            }
          </div>`,
        )
        .join("")}</div>`
    : `<div class="empty">Generated posters will appear here.</div>`;
  return document(
    `${brand.businessName} — Daily Poster`,
    `<main class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Daily Poster</p>
          <h1>Plan your month once. Get a branded poster every day.</h1>
          <p class="help">${escapeHtml(brand.businessName)} · ${escapeHtml(automationSettings.enabled ? `Active at ${automationSettings.localTime}` : "Automation paused")}</p>
          <nav class="nav"><a href="#today">Today</a><a href="#calendar">Calendar</a><a href="#inspiration">Inspiration</a><a href="#templates">Brand & Templates</a><a href="#settings">Settings</a><a href="/admin/${escapeHtml(brand.businessSlug)}">Admin studio</a></nav>
        </div>
        <div class="actions">
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster"><input type="hidden" name="date" value="${escapeHtml(today)}"><button type="submit">Generate today</button></form>
          <a class="button secondary" href="#calendar">Plan month</a>
        </div>
      </header>
      ${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}
      ${error ? `<p class="message error">${escapeHtml(error)}</p>` : ""}
      <section class="grid" id="today">
        <article class="card wide today">
          <div class="poster-preview">${todayImage}</div>
          <div>
            <p class="eyebrow">Today</p>
            <h2>${escapeHtml(todayEntry?.topic ?? "No topic planned for today")}</h2>
            <p class="help">${escapeHtml(todayEntry?.message ?? "Add today's message, generate a poster now, or let the daily automation use a safe AI fallback.")}</p>
            <div class="actions" style="margin-top:16px">
              ${todayPoster?.imageUrl ? `<a class="button" href="${escapeHtml(todayPoster.imageUrl)}" target="_blank" rel="noopener">Download poster</a>` : ""}
              <a class="button secondary" href="#edit-${escapeHtml(today)}">Edit today’s message</a>
              <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster"><input type="hidden" name="date" value="${escapeHtml(today)}"><input type="hidden" name="force" value="true"><button class="secondary" type="submit">Create another</button></form>
            </div>
          </div>
        </article>
        <article class="card">
          <h2>Calendar health</h2>
          <div class="stats">
            <div class="stat"><span class="mini">Planned</span><strong>${plannedCount}</strong></div>
            <div class="stat"><span class="mini">Ready</span><strong>${readyCount}</strong></div>
            <div class="stat"><span class="mini">Empty</span><strong>${missingCount}</strong></div>
          </div>
        </article>
        <article class="card">
          <h2>Next 7 days</h2>
          <div class="next-list">${nextHtml}</div>
        </article>
      </section>
      <section class="card wide" id="calendar" style="margin-top:18px">
        <div class="calendar-tools">
          <div><p class="eyebrow">Monthly calendar</p><h2>${escapeHtml(month)}</h2><p class="help">Edit manually, generate the month with AI, or upload inspiration for a specific day.</p></div>
          <form method="get" action="/app/${escapeHtml(brand.businessSlug)}"><label>Month</label><input type="month" name="month" value="${escapeHtml(month)}" onchange="this.form.submit()"></form>
        </div>
        <details class="drawer" open>
          <summary><strong>Generate calendar with AI</strong> <span class="mini">fills empty or existing dates for the selected month</span></summary>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-month">
            <input type="hidden" name="month" value="${escapeHtml(month)}">
            <div class="fields">
              <div><label>Posting frequency</label><select name="frequency"><option value="daily">Daily</option><option value="weekdays">Weekdays only</option></select></div>
              <div><label>Content style</label><select name="style"><option value="mixed">Mixed</option><option value="educational">Educational</option><option value="promotional">Promotional</option><option value="engagement">Engagement</option></select></div>
            </div>
            <label>Important offers, events, or notes</label><textarea name="notes" placeholder="Example: promote summer package in last week, avoid discount-heavy tone"></textarea>
            <div class="actions"><button type="submit">Generate this month’s calendar</button></div>
          </form>
        </details>
        <div class="calendar-list" style="margin-top:14px">${calendarRows}</div>
      </section>
      <section class="card wide" id="inspiration" style="margin-top:18px">
        <p class="eyebrow">Inspiration poster</p>
        <h2>Create from a poster you like</h2>
        <p class="help">Upload an inspiration poster, add your own message, and save it to a calendar date. The design direction is used; competitor branding, text, claims, and contact details are not copied.</p>
        ${entryForm({ brand, entry: { businessSlug: brand.businessSlug, date: today, topic: "", message: null, cta: null, posterMode: "inspiration", posterType: "reference", templateId: null, inspirationImageUrl: null, notes: null, status: "planned" }, date: today, templatePatterns })}
      </section>
      <section class="card wide" id="templates" style="margin-top:18px">
        <p class="eyebrow">Brand & Templates</p>
        <h2>Current brand style</h2>
        <p class="help">This explains why posters currently look the way they do. Normal daily users can ignore this section.</p>
        <div class="grid" style="margin-top:14px">
          <div class="card" style="box-shadow:none">
            <h3>Brand assets</h3>
            <div class="fields">
              <div><label>Logo</label><div class="poster-preview" style="min-height:160px"><img src="${escapeHtml(brand.logoUrl)}" alt="Logo"></div></div>
              <div><label>Brand board</label><div class="poster-preview" style="min-height:160px"><img src="${escapeHtml(brand.brandReferenceBoardUrl)}" alt="Brand reference board"></div></div>
            </div>
          </div>
          <div class="card" style="box-shadow:none">
            <h3>Style summary</h3>
            <p><strong>Typography:</strong> ${escapeHtml(brand.typography.headingStyle)} · ${escapeHtml(brand.typography.fontMood)}</p>
            <p><strong>Mood:</strong> ${escapeHtml(brand.visualStyle.mood)}</p>
            <p><strong>Layout:</strong> ${escapeHtml(brand.visualStyle.layout)}</p>
            <p><strong>Photo style:</strong> ${escapeHtml(brand.visualStyle.photoStyle)}</p>
            <div class="actions"><a class="button secondary" href="/admin/${escapeHtml(brand.businessSlug)}#brand">Edit advanced brand system</a></div>
          </div>
        </div>
        <details class="drawer" open>
          <summary><strong>Generate template ideas with AI</strong> <span class="mini">creates visual pattern cards, not final posters</span></summary>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/templates/generate">
            <label>What kind of templates do you want?</label>
            <textarea name="notes" placeholder="Example: premium clinic style, clean educational posts, festival greetings, bold offers, minimal typography"></textarea>
            <div class="actions"><button type="submit">Generate template ideas</button></div>
          </form>
        </details>
        ${
          templatePatterns.length
            ? `<div class="calendar-list" style="margin-top:14px">${templatePatterns
                .map(
                  (pattern) => `<div class="calendar-row">
                    <div>${pattern.previewImageUrl ? `<img class="thumb" src="${escapeHtml(pattern.previewImageUrl)}" alt="">` : `<span class="pill">${escapeHtml(pattern.isActive ? "active" : "paused")}</span>`}</div>
                    <div>
                      <div class="topic">${escapeHtml(pattern.name)}</div>
                      <div class="mini">${escapeHtml(pattern.bestFor)}</div>
                      <p class="mini">${escapeHtml(pattern.description)}</p>
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
      <section class="card wide" id="settings" style="margin-top:18px">
        <p class="eyebrow">Settings</p>
        <h2>Simple automation settings</h2>
        <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/settings">
          <label><input style="width:auto" type="checkbox" name="enabled"${checked(automationSettings.enabled)}> Daily posters active</label>
          <div class="fields">
            <div><label>Daily generation time</label><input name="localTime" type="time" value="${escapeHtml(automationSettings.localTime)}"></div>
            <div><label>Delivery emails</label><input name="recipientEmails" value="${escapeHtml(automationSettings.recipientEmails.join(", "))}" placeholder="owner@example.com"></div>
          </div>
          <input type="hidden" name="posterTypes" value="general">
          <label><input style="width:auto" type="checkbox" name="emailEnabled"${checked(automationSettings.emailEnabled)}> Email poster after generation</label>
          <div class="actions"><button type="submit">Save settings</button></div>
        </form>
      </section>
      <section class="card wide" style="margin-top:18px">
        <h2>Poster history</h2>
        ${recentHtml}
      </section>
    </main>`,
  );
}
