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
  if (status === "poster_ready") return "Completed";
  if (status === "needs_message") return "Needs Input";
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
  :root {
    --bg-color: #f9fafb;
    --card-bg: #ffffff;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;
    --brand-primary: #0284c7;
    --brand-hover: #0369a1;
    --brand-light: #e0f2fe;
    --success-bg: #d1fae5;
    --success-text: #059669;
    --warning-bg: #fef3c7;
    --warning-text: #d97706;
    --danger-bg: #fee2e2;
    --danger-text: #dc2626;
    --border-color: #e5e7eb;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
  }
  
  * {
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }
  
  body {
    margin: 0;
    background-color: var(--bg-color);
    color: var(--text-primary);
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 15px;
    line-height: 1.5;
  }
  
  a {
    color: var(--brand-primary);
    text-decoration: none;
    transition: color 0.15s ease;
  }
  a:hover {
    color: var(--brand-hover);
  }
  
  /* Topbar (Sticky Header) */
  .topbar {
    background: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: var(--shadow-sm);
  }
  
  .topbar-inner {
    max-width: 1180px;
    margin: 0 auto;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .brand-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--brand-light);
    color: var(--brand-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.1rem;
  }
  
  .brand-name {
    font-weight: 800;
    font-size: 1.1rem;
    letter-spacing: -0.01em;
  }
  
  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  /* Navigation */
  .nav {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .nav::-webkit-scrollbar {
    display: none;
  }
  
  .nav a {
    padding: 12px 16px;
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-secondary);
    border-bottom: 3px solid transparent;
    white-space: nowrap;
  }
  
  /* Pure CSS Tab Visibility */
  .view-panel { display: none; }
  
  #today { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  body:has(#calendar:target) #today { display: none; }
  body:has(#inspiration:target) #today { display: none; }
  body:has(#templates:target) #today { display: none; }
  body:has(#settings:target) #today { display: none; }
  body:has(#history:target) #today { display: none; }
  body:has(details.drawer:target) #today { display: none; }
  
  #calendar:target, #inspiration:target, #templates:target, #settings:target, #history:target { display: block !important; }
  body:has(details.drawer:target) #calendar { display: block !important; }
  #today:target { display: grid !important; }
  
  body:not(:has(:target)) .nav a[href="#today"],
  body:has(#today:target) .nav a[href="#today"],
  body:has(#calendar:target) .nav a[href="#calendar"],
  body:has(#inspiration:target) .nav a[href="#inspiration"],
  body:has(#templates:target) .nav a[href="#templates"],
  body:has(#settings:target) .nav a[href="#settings"],
  body:has(#history:target) .nav a[href="#history"] {
    color: var(--brand-primary);
    border-bottom-color: var(--brand-primary);
  }
  
  /* Main Container */
  .shell {
    max-width: 1180px;
    margin: 32px auto 72px;
    padding: 0 20px;
  }
  
  .page-header {
    margin-bottom: 32px;
  }
  .page-header h1 {
    font-size: 2.2rem;
    font-weight: 800;
    margin: 0 0 6px 0;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }
  .page-header p {
    color: var(--text-secondary);
    margin: 0;
    font-size: 1.05rem;
    font-weight: 500;
  }
  
  /* Cards */
  .card {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    padding: 24px;
    margin-bottom: 24px;
    border: 1px solid var(--border-color);
  }
  
  h2 {
    font-size: 1.35rem;
    font-weight: 800;
    margin: 0 0 16px 0;
    color: var(--text-primary);
  }
  
  h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 20px 0 12px 0;
  }
  
  /* Structured Lists (Tasks) */
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .task-item {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 16px;
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: center;
    gap: 12px;
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .task-item:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    border-color: #d1d5db;
  }
  
  .status-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .status-icon.poster_ready {
    background: var(--success-bg);
    color: var(--success-text);
  }
  .status-icon.empty, .status-icon.planned {
    border: 2px solid var(--border-color);
    background: var(--bg-color);
    color: var(--text-muted);
  }
  .status-icon.needs_message {
    background: var(--warning-bg);
    color: var(--warning-text);
  }
  
  .task-content .title {
    font-weight: 800;
    font-size: 1.05rem;
    margin: 0 0 2px 0;
    color: var(--text-primary);
  }
  .task-content .meta {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
    margin: 0;
  }
  
  .task-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
  }
  
  /* Buttons */
  .button, button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-sm);
    padding: 10px 18px;
    background: var(--text-primary);
    color: #fff;
    font: inherit;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .button:hover, button:hover {
    background: #000;
  }
  
  .button.secondary, button.secondary {
    background: var(--bg-color);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  .button.secondary:hover, button.secondary:hover {
    background: #e5e7eb;
  }
  
  button.danger {
    background: var(--danger-bg);
    color: var(--danger-text);
    border: 1px solid #fecaca;
  }
  button.danger:hover {
    background: #fee2e2;
  }
  
  .button.small, button.small {
    padding: 8px 14px;
    font-size: 0.85rem;
  }
  
  /* Forms */
  label {
    display: block;
    font-weight: 700;
    margin: 16px 0 8px 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  input, select, textarea {
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    background: var(--bg-color);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.95rem;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  
  input:focus, select:focus, textarea:focus {
    outline: none;
    background: var(--card-bg);
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 3px var(--brand-light);
  }
  
  textarea { min-height: 100px; resize: vertical; }
  
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
  }
  
  /* Drawers (Details) */
  details.drawer {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--card-bg);
    margin-bottom: 16px;
    box-shadow: var(--shadow-sm);
  }
  details.drawer summary {
    padding: 16px;
    font-weight: 800;
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  details.drawer summary::-webkit-details-marker { display: none; }
  details.drawer summary::after {
    content: '+';
    font-size: 1.4rem;
    color: var(--brand-primary);
  }
  details.drawer[open] { border-color: var(--brand-primary); }
  details.drawer[open] summary { border-bottom: 1px solid var(--border-color); }
  details.drawer[open] summary::after { content: '−'; }
  details.drawer form { padding: 16px; background: #fafafa; }
  
  /* Poster Previews */
  .poster-preview {
    width: 100%;
    aspect-ratio: 9/16;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-md);
  }
  .poster-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .brand-preview {
    width: 100%;
    height: 140px;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 10px;
  }
  .brand-preview img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  .thumb {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
  }
  
  /* Badges & Metrics */
  .badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }
  
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }
  .metric-box {
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 16px;
    text-align: center;
  }
  .metric-box .label {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .metric-box .value {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--text-primary);
  }
  
  .message-box {
    background: var(--brand-light);
    border: 1px solid #bae6fd;
    padding: 18px;
    border-radius: var(--radius-md);
    color: #0369a1;
    font-weight: 600;
    font-size: 0.95rem;
    white-space: pre-wrap;
    margin: 16px 0;
  }
  
  .alert {
    padding: 14px 18px;
    border-radius: var(--radius-sm);
    background: var(--success-bg);
    color: var(--success-text);
    font-weight: 700;
    margin-bottom: 24px;
    border: 1px solid #a7f3d0;
  }
  .alert.error {
    background: var(--danger-bg);
    color: var(--danger-text);
    border-color: #fecaca;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(17, 24, 39, 0.62);
  }
  .modal-overlay.is-open {
    display: flex;
  }
  .modal-panel {
    width: min(560px, 100%);
    max-height: min(760px, calc(100vh - 40px));
    overflow-y: auto;
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
  }
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 20px 0;
  }
  .modal-header h2 {
    margin-bottom: 4px;
  }
  .modal-body {
    padding: 0 20px 20px;
  }
  .modal-close {
    width: 38px;
    height: 38px;
    padding: 0;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .modal-panel textarea {
    min-height: 150px;
  }
  
  /* Pulse Animation */
  .pulse-dot, .pulse-dot-paused {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
  .pulse-dot {
    background-color: var(--success-text);
    box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.7);
    animation: pulse-green 1.5s infinite;
  }
  .pulse-dot-paused {
    background-color: var(--warning-text);
    box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.7);
    animation: pulse-orange 1.5s infinite;
  }
  @keyframes pulse-green {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(5, 150, 105, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(5, 150, 105, 0); }
  }
  @keyframes pulse-orange {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(217, 119, 6, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0); }
  }
  
  /* Mobile Overrides */
  @media (max-width: 768px) {
    #today { grid-template-columns: 1fr; }
    .task-item {
      grid-template-columns: 32px 1fr;
    }
    .task-actions {
      grid-column: 1 / -1;
      justify-content: flex-start;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color);
    }
    .fields { grid-template-columns: 1fr; }
    .metric-grid { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .metric-box { padding: 12px 8px; }
    .metric-box .value { font-size: 1.4rem; }
    .shell { margin: 24px auto 72px; }
    .page-header h1 { font-size: 1.8rem; }
    .modal-overlay {
      align-items: flex-end;
      padding: 0;
    }
    .modal-panel {
      width: 100%;
      max-height: 88vh;
      border-radius: 20px 20px 0 0;
      border-bottom: 0;
    }
    .modal-header {
      padding: 18px 16px 0;
    }
    .modal-body {
      padding: 0 16px 18px;
    }
    .modal-panel textarea {
      min-height: 180px;
      font-size: 16px;
    }
    .modal-body .task-actions {
      border-top: 0;
      padding-top: 0;
    }
    .modal-body button {
      width: 100%;
    }
  }
`;

function document(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>${styles}</style></head><body>${body}<script>
  function copyText(id, btn) {
    const text = document.getElementById(id).innerText;
    navigator.clipboard.writeText(text).then(() => {
      const old = btn.innerHTML;
      btn.innerHTML = '<svg style="width:14px;height:14px;margin-right:4px;vertical-align:middle;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> <span>Copied!</span>';
      setTimeout(() => { btn.innerHTML = old; }, 1500);
    });
  }
  function openTargetDrawer() {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (target && target.tagName === 'DETAILS') {
      target.open = true;
      target.scrollIntoView({ block: 'start' });
    }
  }
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    const field = modal.querySelector('textarea, input, select, button');
    if (field) setTimeout(() => field.focus(), 50);
  }
  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.is-open').forEach((modal) => closeModal(modal.id));
    }
  });
  window.addEventListener('DOMContentLoaded', openTargetDrawer);
  window.addEventListener('hashchange', openTargetDrawer);
</script></body></html>`;
}

function getCheckmarkIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
}

function getEmptyCircle(): string {
  return `<div style="width:14px;height:14px;border-radius:50%;border:2px solid currentColor;"></div>`;
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
    <summary><strong>${entry ? "Edit Task" : "Add Task"} <span class="badge" style="margin-left:8px;">${escapeHtml(date.slice(5))}</span></strong></summary>
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
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Leave this on Auto choose unless you want a specific saved template pattern for this date.</p>
      <div class="fields">
        <div><label>Status</label><select name="status">
          <option value="planned"${selected("planned", status)}>Planned</option>
          <option value="needs_message"${selected("needs_message", status)}>Needs message</option>
          <option value="skipped"${selected("skipped", status)}>Skipped</option>
          <option value="poster_ready"${selected("poster_ready", status)}>Completed (Poster ready)</option>
        </select></div>
        <div><label>Inspiration image</label><input name="inspirationImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div>
      </div>
      ${
        entry?.inspirationImageUrl
          ? `<p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Current inspiration image saved. Upload a new one only to replace it.</p><input type="hidden" name="existingInspirationImageUrl" value="${escapeHtml(entry.inspirationImageUrl)}">`
          : ""
      }
      <label>Notes</label><textarea name="notes" placeholder="Optional guidance: style, do/don't copy, offer terms, audience, etc.">${escapeHtml(entry?.notes ?? "")}</textarea>
      <div class="task-actions" style="margin-top: 24px; justify-content: flex-start;">
        <button type="submit">Save Task</button>
        <button class="secondary" type="submit" formaction="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster">Generate Poster Now</button>
      </div>
    </form>
    <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/edit-poster" style="border-top: 1px solid var(--border-color); margin-top: 22px; padding-top: 18px;">
      <input type="hidden" name="date" value="${escapeHtml(date)}">
      <input type="hidden" name="posterType" value="${escapeHtml(posterType)}">
      <label>Edit existing poster with custom instruction</label>
      <textarea name="editInstruction" required placeholder="Example: Keep the same design, but make the headline shorter, change the CTA to Book an appointment, and make the background more premium."></textarea>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Uses the current generated poster image for this date as the source. It will preserve clinic branding and apply your requested changes.</p>
      <div class="task-actions" style="margin-top: 16px; justify-content: flex-start;">
        <button type="submit">Edit Poster Image</button>
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
  const readyPercentage = Math.round((readyCount / dates.length) * 100);
  
  const todayImage =
    todayPoster?.status === "ready" && todayPoster.imageUrl
      ? `<img src="${escapeHtml(todayPoster.imageUrl)}" alt="Today's generated poster">`
      : `<div style="padding: 40px; text-align: center; color: var(--text-muted); font-weight: 600;">No poster ready.<br><span style="font-weight:400; font-size:0.9rem;">Generate it now or wait for automation.</span></div>`;
      
  const todayDateObj = new Date();
  const dateFormatted = todayDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const brandInitial = brand.businessName.charAt(0).toUpperCase();

  const calendarRows = dates
    .map((date) => {
      const entry = entryByDate.get(date) ?? null;
      const displayStatus = entry?.status ?? "empty";
      const icon = displayStatus === "poster_ready" ? getCheckmarkIcon() : getEmptyCircle();
      
      return `<div class="task-item">
        <div class="status-icon ${escapeHtml(displayStatus)}">${icon}</div>
        <div class="task-content">
          <p class="title">${escapeHtml(entry?.topic ?? "No content planned")} <span class="badge" style="margin-left: 8px;">${escapeHtml(date.slice(5))}</span></p>
          <p class="meta">${escapeHtml(entry ? `${modeLabel(entry.posterMode)} · ${entry.posterType}` : "Add manually or generate the month with AI")}</p>
          ${entry?.message ? `<p class="meta" style="color: var(--text-primary); margin-top: 4px;">${escapeHtml(entry.message)}</p>` : ""}
        </div>
        <div class="task-actions">
          ${entry?.inspirationImageUrl ? `<img class="thumb" src="${escapeHtml(entry.inspirationImageUrl)}" alt="Inspiration">` : ""}
          <a class="button secondary small" href="#edit-${escapeHtml(date)}">Edit</a>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-poster">
            <input type="hidden" name="date" value="${escapeHtml(date)}">
            <button class="small" type="submit">Generate</button>
          </form>
        </div>
      </div>${entryForm({ brand, entry, date, templatePatterns })}`;
    })
    .join("");
    
  const nextHtml = nextEntries.length
    ? nextEntries
        .map((entry) => {
          const icon = entry.status === "poster_ready" ? getCheckmarkIcon() : getEmptyCircle();
          return `<div class="task-item">
            <div class="status-icon ${escapeHtml(entry.status)}">${icon}</div>
            <div class="task-content">
              <p class="title">${escapeHtml(entry.topic)} <span class="badge" style="margin-left: 8px;">${escapeHtml(entry.date.slice(5))}</span></p>
              <p class="meta">${escapeHtml(modeLabel(entry.posterMode))} · ${escapeHtml(statusLabel(entry.status))}</p>
            </div>
          </div>`;
        })
        .join("")
    : `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-weight: 600; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">No upcoming tasks planned yet.</div>`;
    
  const recentHtml = recentPosters.length
    ? `<div class="task-list">${recentPosters
        .map((poster) => {
          return `<div class="task-item">
            <div class="status-icon poster_ready">${getCheckmarkIcon()}</div>
            <div class="task-content">
              <p class="title">${escapeHtml(poster.angle || poster.posterType)} <span class="badge" style="margin-left: 8px;">${escapeHtml(poster.date.slice(5))}</span></p>
              <p class="meta">${escapeHtml(poster.posterType)}</p>
            </div>
            <div class="task-actions">
            ${
              poster.imageUrl
                ? `<a class="button secondary small" href="${escapeHtml(poster.imageUrl)}" target="_blank" rel="noopener">Download</a>`
                : `<span class="badge">${escapeHtml(poster.status)}</span>`
            }
            </div>
          </div>`;
        })
        .join("")}</div>`
    : `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-weight: 600; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">Generated posters will appear here.</div>`;
    
  return document(
    `${brand.businessName} — Dashboard`,
    `<header class="topbar">
      <div class="topbar-inner">
        <div class="brand-info">
          <div class="avatar">${escapeHtml(brandInitial)}</div>
          <span class="brand-name">${escapeHtml(brand.businessName)}</span>
        </div>
        <div class="topbar-actions">
          ${
            automationSettings.enabled
              ? `<span class="pulse-dot" title="Automation Active"></span>`
              : `<span class="pulse-dot-paused" title="Automation Paused"></span>`
          }
          <a class="button secondary small" href="/admin/${escapeHtml(brand.businessSlug)}">Admin ↗</a>
        </div>
      </div>
      <nav class="nav">
        <a href="#today">Dashboard</a>
        <a href="#calendar">Tasks</a>
        <a href="#inspiration">Inspiration</a>
        <a href="#templates">Brand</a>
        <a href="#settings">Settings</a>
        <a href="#history">History</a>
      </nav>
    </header>

    <main class="shell">
      <div class="page-header">
        <h1>Good Morning!</h1>
        <p>${escapeHtml(dateFormatted)}. Your brand at a glance.</p>
      </div>

      ${message ? `<div class="alert">${escapeHtml(message)}</div>` : ""}
      ${error ? `<div class="alert error">${escapeHtml(error)}</div>` : ""}
      
      <!-- VIEW: TODAY'S DASHBOARD -->
      <section class="view-panel" id="today">
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <article class="card" style="margin-bottom:0;">
            <h2>Task Categories</h2>
            <div class="metric-grid">
              <div class="metric-box"><span class="label">Planned</span><span class="value">${plannedCount}</span></div>
              <div class="metric-box"><span class="label">Ready</span><span class="value" style="color: var(--success-text);">${readyCount}</span></div>
              <div class="metric-box"><span class="label">Empty</span><span class="value" style="color: var(--warning-text);">${missingCount}</span></div>
            </div>
            
            <div style="background: var(--bg-color); border-radius: var(--radius-md); border: 1px solid var(--border-color); padding: 20px;">
              <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 0.9rem; margin-bottom: 10px; text-transform: uppercase; color: var(--text-secondary);">
                <span>Monthly Goal</span>
                <span style="color: var(--brand-primary);">${readyPercentage}%</span>
              </div>
              <div style="width: 100%; height: 12px; background: #e5e7eb; border-radius: 99px; overflow: hidden;">
                <div style="width: ${readyPercentage}%; height: 100%; background: var(--brand-primary); border-radius: 99px;"></div>
              </div>
            </div>
          </article>
          
          <article class="card" style="margin-bottom:0; flex-grow: 1;">
            <h2>Upcoming Tasks</h2>
            <div class="task-list">${nextHtml}</div>
          </article>
        </div>

        <article class="card" style="margin-bottom:0; display: flex; flex-direction: column;">
          <h2>Today's Deliverable</h2>
          <div class="poster-preview" style="margin-bottom: 24px;">${todayImage}</div>
          
          <div>
            <h3 style="margin-top:0;">${escapeHtml(todayEntry?.topic ?? "No topic planned for today")}</h3>
            <div class="message-box" id="today-message-text">${escapeHtml(todayEntry?.message ?? "No custom message written. Automation will use a brand-safe educational post prompt automatically.")}</div>
            
            ${
              todayEntry?.message
                ? `<button class="button secondary small" style="margin-bottom: 24px;" onclick="copyText('today-message-text', this)">
                    <svg style="width:14px;height:14px;margin-right:6px;vertical-align:middle;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                    <span>Copy Caption</span>
                  </button>`
                : ""
            }
            
            <div class="task-actions" style="justify-content: flex-start; margin-top: auto;">
              ${todayPoster?.imageUrl ? `<a class="button" href="${escapeHtml(todayPoster.imageUrl)}" target="_blank" rel="noopener">Download File</a>` : ""}
              <a class="button secondary" href="#edit-${escapeHtml(today)}">Edit Details</a>
              <button class="secondary" type="button" onclick="openModal('regenerate-modal')">Regenerate</button>
            </div>
          </div>
        </article>
      </section>

      <div class="modal-overlay" id="regenerate-modal" role="dialog" aria-modal="true" aria-labelledby="regenerate-modal-title" onclick="if (event.target === this) closeModal('regenerate-modal')">
        <div class="modal-panel">
          <div class="modal-header">
            <div>
              <h2 id="regenerate-modal-title">Regenerate Poster</h2>
              <p style="color: var(--text-secondary); margin: 0;">Add custom instructions for the new version.</p>
            </div>
            <button class="secondary modal-close" type="button" aria-label="Close" onclick="closeModal('regenerate-modal')">x</button>
          </div>
          <div class="modal-body">
            <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/edit-poster">
              <input type="hidden" name="date" value="${escapeHtml(today)}">
              <input type="hidden" name="posterType" value="${escapeHtml(todayPoster?.posterType ?? todayEntry?.posterType ?? "general")}">
              <label>Custom regeneration instruction</label>
              <textarea name="editInstruction" required placeholder="Example: Keep the same layout, make the headline shorter, use a softer premium background, and make the CTA more visible."></textarea>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">The current poster image will be used as the source, then regenerated according to your instruction while keeping the brand logo, colors, and contact details consistent.</p>
              <div class="task-actions" style="justify-content: flex-start; margin-top: 18px;">
                <button type="submit">Regenerate with instruction</button>
                <button class="secondary" type="button" onclick="closeModal('regenerate-modal')">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      <!-- VIEW: TASKS (CONTENT CALENDAR) -->
      <section class="card view-panel" id="calendar">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
          <div>
            <h2>Daily Tasks</h2>
            <p style="color: var(--text-secondary); margin: 0;">${escapeHtml(month)}. Manage your monthly content pipeline.</p>
          </div>
          <form method="get" action="/app/${escapeHtml(brand.businessSlug)}">
            <input type="month" name="month" value="${escapeHtml(month)}" onchange="this.form.submit()" style="width: auto; padding: 8px 12px; font-weight: 600;">
          </form>
        </div>

        <details class="drawer">
          <summary><strong>Generate tasks with AI</strong></summary>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/calendar/generate-month">
            <input type="hidden" name="month" value="${escapeHtml(month)}">
            <div class="fields">
              <div><label>Posting frequency</label><select name="frequency"><option value="daily">Daily</option><option value="weekdays">Weekdays only</option></select></div>
              <div><label>Content style</label><select name="style"><option value="mixed">Mixed</option><option value="educational">Educational</option><option value="promotional">Promotional</option><option value="engagement">Engagement</option></select></div>
            </div>
            <label>Important notes</label><textarea name="notes" placeholder="Example: promote summer package in last week, avoid discount-heavy tone"></textarea>
            <div style="margin-top: 16px;"><button type="submit">Generate Pipeline</button></div>
          </form>
        </details>

        <div class="task-list">${calendarRows}</div>
      </section>
      
      <!-- VIEW: INSPIRATION POSTER -->
      <section class="card view-panel" id="inspiration">
        <h2>Inspiration Poster</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">Upload an inspiration poster, add your own message, and save it to a calendar date. The design direction is used; competitor branding, text, claims, and contact details are not copied.</p>
        ${entryForm({ brand, entry: { businessSlug: brand.businessSlug, date: today, topic: "", message: null, cta: null, posterMode: "inspiration", posterType: "reference", templateId: null, inspirationImageUrl: null, notes: null, status: "planned" }, date: today, templatePatterns })}
      </section>
      
      <!-- VIEW: TEMPLATES & BRAND -->
      <section class="card view-panel" id="templates">
        <h2>Brand Identity</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">Current brand style configuration and template assets.</p>
        
        <div class="fields" style="margin-bottom: 32px;">
          <div style="background: var(--bg-color); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <h3>Brand assets</h3>
            <label>Logo</label><div class="brand-preview" style="margin-bottom: 16px;"><img src="${escapeHtml(brand.logoUrl)}" alt="Logo"></div>
            <label>Brand board</label><div class="brand-preview"><img src="${escapeHtml(brand.brandReferenceBoardUrl)}" alt="Brand reference board"></div>
          </div>
          <div style="background: var(--bg-color); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <h3>Style Summary</h3>
            <p style="font-size: 0.9rem;"><strong>Typography:</strong><br>${escapeHtml(brand.typography.headingStyle)}</p>
            <p style="font-size: 0.9rem;"><strong>Mood:</strong><br>${escapeHtml(brand.visualStyle.mood)}</p>
            <p style="font-size: 0.9rem;"><strong>Layout:</strong><br>${escapeHtml(brand.visualStyle.layout)}</p>
            <p style="font-size: 0.9rem;"><strong>Photo style:</strong><br>${escapeHtml(brand.visualStyle.photoStyle)}</p>
            <div style="margin-top: 24px;"><a class="button secondary small" href="/admin/${escapeHtml(brand.businessSlug)}#brand">Edit Configuration</a></div>
          </div>
        </div>

        <details class="drawer">
          <summary><strong>Generate template ideas</strong></summary>
          <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/templates/generate">
            <label>What kind of templates do you want?</label>
            <textarea name="notes" placeholder="Example: premium clinic style, clean educational posts, festival greetings"></textarea>
            <div style="margin-top: 16px;"><button type="submit">Generate Ideas</button></div>
          </form>
        </details>

        <h3 style="margin-top: 32px;">Active Templates</h3>
        ${
          templatePatterns.length
            ? `<div class="task-list">${templatePatterns
                .map(
                  (pattern) => `<div class="task-item" style="grid-template-columns: 60px 1fr auto;">
                    <div>${pattern.previewImageUrl ? `<img class="thumb" style="width:60px;height:60px;" src="${escapeHtml(pattern.previewImageUrl)}" alt="">` : `<span class="badge">${escapeHtml(pattern.isActive ? "active" : "paused")}</span>`}</div>
                    <div class="task-content">
                      <p class="title">${escapeHtml(pattern.name)}</p>
                      <p class="meta" style="margin-bottom:4px;">${escapeHtml(pattern.bestFor)}</p>
                      <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">${escapeHtml(pattern.description)}</p>
                    </div>
                    <div class="task-actions">
                      <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/templates/toggle">
                        <input type="hidden" name="templateId" value="${escapeHtml(pattern.templateId)}">
                        <input type="hidden" name="isActive" value="${escapeHtml(pattern.isActive ? "false" : "true")}">
                        <button class="secondary small" type="submit">${escapeHtml(pattern.isActive ? "Pause" : "Activate")}</button>
                      </form>
                      <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/templates/delete">
                        <input type="hidden" name="templateId" value="${escapeHtml(pattern.templateId)}">
                        <button class="danger small" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>`,
                )
                .join("")}</div>`
            : `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-weight: 600; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">No template patterns yet.</div>`
        }
      </section>
      
      <!-- VIEW: AUTOMATION SETTINGS -->
      <section class="card view-panel" id="settings">
        <h2>Automation Settings</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">Configure when the poster is generated and which emails receive the completed designs daily.</p>
        <form method="post" action="/app/${escapeHtml(brand.businessSlug)}/settings" style="max-width: 600px;">
          <label style="display: flex; align-items: center; gap: 12px; font-size: 1.05rem; cursor: pointer; margin-bottom: 24px; padding: 16px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <input style="width: 20px; height: 20px; margin: 0;" type="checkbox" name="enabled"${checked(automationSettings.enabled)}> 
            <strong>Daily posters active</strong>
          </label>
          <div class="fields">
            <div><label>Daily generation time</label><input name="localTime" type="time" value="${escapeHtml(automationSettings.localTime)}"></div>
            <div><label>Delivery emails (comma-separated)</label><input name="recipientEmails" value="${escapeHtml(automationSettings.recipientEmails.join(", "))}" placeholder="owner@example.com"></div>
          </div>
          <input type="hidden" name="posterTypes" value="general">
          <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; margin-top: 24px;">
            <input style="width: 18px; height: 18px; margin: 0;" type="checkbox" name="emailEnabled"${checked(automationSettings.emailEnabled)}> 
            <span style="font-weight: 600;">Email poster automatically after generation</span>
          </label>
          <div style="margin-top: 32px;"><button type="submit">Save Configuration</button></div>
        </form>
      </section>
      
      <!-- VIEW: POSTER HISTORY -->
      <section class="card view-panel" id="history">
        <h2>Poster History</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">Browse and download the last 30 posters generated for your business.</p>
        ${recentHtml}
      </section>
    </main>`,
  );
}
