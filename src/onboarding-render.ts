import type {
  AutomationSettings,
  BusinessBrandSystem,
  ContentCalendarEntry,
  GeneratedPoster,
} from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function checked(value: boolean): string {
  return value ? " checked" : "";
}

const businessCategories = [
  "Clinic",
  "Restaurant",
  "Salon",
  "Gym",
  "Real estate",
  "Retail store",
  "Consultant",
  "Software service",
  "Design service",
  "Other small business",
];

function selected(value: string, current: string): string {
  return value === current ? " selected" : "";
}

function categoryOptions(current = ""): string {
  return [
    `<option value="">Choose category</option>`,
    ...businessCategories.map(
      (category) =>
        `<option value="${escapeHtml(category)}"${selected(category, current)}>${escapeHtml(category)}</option>`,
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
  
  /* Main Container */
  .shell {
    max-width: 1180px;
    margin: 32px auto 72px;
    padding: 0 20px;
  }

  .onboarding-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 32px;
    align-items: start;
  }
  
  /* Cards */
  .card {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    padding: 32px;
    border: 1px solid var(--border-color);
  }

  .progress-card { 
    position: sticky; 
    top: 100px; 
    padding: 24px;
    box-shadow: var(--shadow-sm);
  }

  .step-list { display: grid; gap: 12px; margin-top: 24px; }
  .mobile-progress { display: none; }
  .step-item {
    color: inherit;
    text-decoration: none;
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background: var(--bg-color);
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .step-item:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    border-color: #d1d5db;
    color: inherit;
  }
  .step-item.active {
    background: var(--brand-light);
    border-color: #bae6fd;
    box-shadow: var(--shadow-md);
  }
  .step-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 800;
    color: var(--text-muted);
    background: var(--card-bg);
    border: 2px solid var(--border-color);
  }
  .step-item.active .step-dot {
    background: var(--brand-primary);
    color: #fff;
    border-color: var(--brand-primary);
  }
  .step-title { margin: 0; font-weight: 800; font-size: 1.05rem; color: var(--text-primary); }
  .step-meta { margin: 2px 0 0; color: var(--text-secondary); font-size: 0.85rem; font-weight: 500; }
  
  h1 {
    font-size: 2.2rem;
    font-weight: 800;
    margin: 0 0 8px 0;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }
  h2 { font-size: 1.35rem; font-weight: 800; margin: 0 0 16px; color: var(--text-primary); }
  h3 { font-size: 1.1rem; font-weight: 700; margin: 24px 0 12px; }
  .lead {
    color: var(--text-secondary);
    font-size: 1.05rem;
    font-weight: 500;
    margin: 0 0 28px;
    max-width: 640px;
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
  .button:hover, button:hover { background: #000; }
  .button.secondary, button.secondary {
    background: var(--bg-color);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  .button.secondary:hover, button.secondary:hover { background: #e5e7eb; }
  .button.small { padding: 8px 14px; font-size: 0.85rem; }
  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 32px;
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
  input[type=color] { height: 48px; padding: 4px; }
  .color-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
  }
  .color-field {
    min-width: 0;
  }
  .color-field label {
    margin-top: 12px;
    font-size: 0.82rem;
  }
  
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
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
  .callout {
    padding: 18px;
    border-radius: var(--radius-md);
    background: var(--brand-light);
    color: #0369a1;
    font-weight: 600;
    font-size: 0.95rem;
    margin: 24px 0;
    border: 1px solid #bae6fd;
  }
  
  .preview-grid {
    display: grid;
    grid-template-columns: minmax(240px, 320px) 1fr;
    gap: 32px;
    align-items: start;
  }
  
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
    text-align: center;
    color: var(--text-muted);
    font-weight: 700;
    padding: 24px;
  }
  .poster-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  /* Task List */
  .task-list { display: flex; flex-direction: column; gap: 12px; }
  .task-item {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 16px;
    display: grid;
    grid-template-columns: 86px 1fr;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow-sm);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .task-item:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    border-color: #d1d5db;
  }
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
    text-align: center;
  }
  .task-item strong {
    font-weight: 800;
    font-size: 1.05rem;
    color: var(--text-primary);
    display: block;
    margin-bottom: 2px;
  }
  .mini { color: var(--text-secondary); font-size: 0.85rem; font-weight: 500; margin: 0; }
  
  .switch {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    margin-top: 24px;
    cursor: pointer;
  }
  .switch input { width: 20px; height: 20px; margin: 0; }
  
  @media (max-width: 820px) {
    body {
      background: var(--card-bg);
      font-size: 14px;
    }
    .topbar {
      box-shadow: none;
    }
    .topbar-inner {
      padding: 12px 14px;
    }
    .topbar .avatar {
      width: 30px;
      height: 30px;
      font-size: 0.95rem;
    }
    .brand-name {
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.96rem;
    }
    .topbar-actions .badge {
      display: none;
    }
    .topbar-actions {
      gap: 8px;
    }
    .button.small {
      padding: 7px 10px;
      font-size: 0.8rem;
    }
    .shell {
      margin: 0 auto 32px;
      padding: 0;
    }
    .onboarding-grid, .preview-grid, .fields {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .progress-card {
      position: static;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      padding: 14px 16px 10px;
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
    }
    .progress-card > .brand-info,
    .step-list {
      display: none;
    }
    .mobile-progress {
      display: block;
    }
    .mobile-progress-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 8px;
    }
    .mobile-progress-title {
      margin: 0;
      font-weight: 800;
      font-size: 0.95rem;
      color: var(--text-primary);
    }
    .mobile-progress-count {
      color: var(--text-muted);
      font-weight: 800;
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .mobile-progress-track {
      height: 6px;
      border-radius: 999px;
      background: var(--bg-color);
      overflow: hidden;
    }
    .mobile-progress-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--brand-primary);
    }
    .card {
      border: 0;
      border-radius: 0;
      box-shadow: none;
      padding: 22px 16px 30px;
    }
    h1 {
      font-size: 1.55rem;
      line-height: 1.15;
      margin-bottom: 7px;
    }
    h2 {
      font-size: 1.08rem;
      margin-bottom: 10px;
    }
    h3 {
      font-size: 1rem;
      margin: 24px 0 10px;
    }
    .lead {
      font-size: 0.93rem;
      line-height: 1.45;
      margin-bottom: 14px;
      font-weight: 500;
    }
    .mobile-secondary {
      display: none;
    }
    .mobile-helper {
      display: none;
    }
    .color-grid {
      grid-template-columns: 1fr 1fr;
      gap: 0 12px;
    }
    label {
      margin: 11px 0 6px;
      font-size: 0.84rem;
    }
    input, select, textarea {
      min-height: 46px;
      padding: 11px 12px;
      font-size: 16px;
      background: #fff;
    }
    textarea {
      min-height: 92px;
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin-top: 22px;
    }
    .button, button {
      width: 100%;
      min-height: 46px;
      padding: 12px 14px;
    }
    .callout, .alert {
      padding: 12px 13px;
      margin: 16px 0;
      font-size: 0.88rem;
      border-radius: var(--radius-sm);
    }
    .poster-preview {
      max-width: 220px;
      margin: 0 auto 20px;
      box-shadow: var(--shadow-sm);
      padding: 18px;
    }
    .task-list {
      gap: 8px;
    }
    .task-item {
      grid-template-columns: 56px 1fr;
      gap: 10px;
      padding: 12px;
      box-shadow: none;
      background: #fff;
    }
    .task-item strong {
      font-size: 0.94rem;
    }
    .mini {
      font-size: 0.8rem;
      line-height: 1.4;
    }
    .badge {
      font-size: 0.68rem;
      padding: 4px 6px;
    }
    .switch {
      margin-top: 16px;
      padding: 13px;
      align-items: flex-start;
    }
    .switch input {
      flex: 0 0 auto;
      margin-top: 1px;
    }
  }
`;

function document(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>${styles}</style></head><body>${body}</body></html>`;
}

function progress(input: {
  step: number;
  businessSlug?: string;
  businessName?: string;
}): string {
  const { step, businessSlug } = input;
  const name = input.businessName ?? "New customer";
  const avatar = input.businessName
    ? input.businessName.charAt(0).toUpperCase()
    : "N";
  const items = [
    ["Business", "Name, category, contact", "business"],
    ["Brand", "Logo, color, style", "brand"],
    ["Sample", "First poster moment", "sample"],
    ["Monthly Plan", "Next 30 days", "plan"],
    ["Activate", "Delivery and schedule", "activate"],
  ] as const;
  const currentTitle = items[step - 1]?.[0] ?? "Setup";
  const progressPercent = Math.max(20, Math.min(100, step * 20));
  return `<aside class="card progress-card">
    <div class="brand-info" style="margin-bottom: 24px;">
      <div class="avatar">${escapeHtml(avatar)}</div>
      <span class="brand-name">${escapeHtml(name)}</span>
    </div>
    <div class="mobile-progress" aria-label="Onboarding progress">
      <div class="mobile-progress-top">
        <p class="mobile-progress-title">${escapeHtml(currentTitle)}</p>
        <span class="mobile-progress-count">Step ${escapeHtml(step)} of 5</span>
      </div>
      <div class="mobile-progress-track">
        <div class="mobile-progress-fill" style="width:${escapeHtml(progressPercent)}%;"></div>
      </div>
    </div>
    <div class="step-list">
      ${items
        .map(
          (
            [title, meta, slug],
            index,
          ) => `${businessSlug ? `<a href="/onboarding/${escapeHtml(businessSlug)}/${escapeHtml(slug)}"` : `<div`} class="step-item ${index + 1 === step ? "active" : ""}">
            <div class="step-dot">${index + 1}</div>
            <div>
              <p class="step-title">${escapeHtml(title)}</p>
              <p class="step-meta">${escapeHtml(meta)}</p>
            </div>
          ${businessSlug ? `</a>` : `</div>`}`,
        )
        .join("")}
    </div>
  </aside>`;
}

function shell(input: {
  title: string;
  step: number;
  body: string;
  businessSlug?: string;
  businessName?: string;
  message?: string;
  error?: string;
}): string {
  const name = input.businessName ?? "New customer";
  return document(
    input.title,
    `<header class="topbar">
      <div class="topbar-inner">
        <div class="brand-info">
          <div class="avatar">${escapeHtml(name.charAt(0).toUpperCase() || "N")}</div>
          <span class="brand-name">${escapeHtml(name)}</span>
        </div>
        <div class="topbar-actions">
          <span class="badge" style="margin-right: 12px; font-weight: 800; border: none; background: var(--brand-light); color: var(--brand-primary);">ONBOARDING</span>
          <a class="button secondary small" href="/">Login</a>
        </div>
      </div>
    </header>
    <main class="shell">
      ${input.message ? `<div class="alert">${escapeHtml(input.message)}</div>` : ""}
      ${input.error ? `<div class="alert error">${escapeHtml(input.error)}</div>` : ""}
      <div class="onboarding-grid">
        ${progress({
          step: input.step,
          businessName: input.businessName,
          businessSlug: input.businessSlug,
        })}
        <section class="card" style="box-shadow: var(--shadow-lg);">${input.body}</section>
      </div>
    </main>`,
  );
}

export function renderOnboardingStart(input: {
  error?: string;
  message?: string;
  timezone: string;
  brand?: BusinessBrandSystem | null;
  category?: string;
}): string {
  const isEdit = Boolean(input.brand);
  return shell({
    title: isEdit ? "Edit Customer" : "Add New Customer",
    step: 1,
    businessSlug: input.brand?.businessSlug,
    businessName: input.brand?.businessName,
    error: input.error,
    message: input.message,
    body: `<h1>${isEdit ? "Edit customer details" : "Create a poster-ready customer"}</h1>
      <p class="lead">${isEdit ? "Update the basics that guide content, calendar ideas, and poster messaging." : "Start with the few details needed to create the business workspace. Logo, style, sample poster, monthly plan, and delivery come next."}</p>
      <form method="post" action="${isEdit ? `/onboarding/${escapeHtml(input.brand!.businessSlug)}/business` : "/onboarding/business"}">
        <div class="fields">
          <div><label>Business name</label><input name="businessName" value="${escapeHtml(input.brand?.businessName ?? "")}" placeholder="Example: Glow Studio" required></div>
          <div><label>Business category</label><select name="category" required>${categoryOptions(input.category)}</select></div>
        </div>
        <div class="fields">
          <div><label>Phone or WhatsApp</label><input name="phone" value="${escapeHtml(input.brand?.phone ?? "")}" placeholder="+91 98765 43210" required></div>
          <div><label>Website or Instagram</label><input name="websiteUrl" value="${escapeHtml(input.brand?.websiteUrl ?? "")}" placeholder="https://example.com"></div>
        </div>
        <div class="fields mobile-secondary">
          <div><label>Country</label><input name="country" value="India" required></div>
          <div><label>Timezone</label><input name="timezone" value="${escapeHtml(input.timezone)}" required></div>
        </div>
        ${
          isEdit
            ? ""
            : `<label>Admin token</label>
              <input name="token" type="password" autocomplete="current-password" required>
              <p class="mini mobile-helper" style="margin-top: 8px;">The token protects customer creation. After this, the setup continues in the same customer session.</p>`
        }
        <div class="actions">
          <button type="submit">${isEdit ? "Save and continue" : "Create my poster system"}</button>
          ${isEdit ? `<a class="button secondary" href="/onboarding/${escapeHtml(input.brand!.businessSlug)}/brand">Back to brand</a>` : ""}
        </div>
      </form>`,
  });
}

export function renderOnboardingBrand(input: {
  brand: BusinessBrandSystem;
  error?: string;
  message?: string;
}): string {
  return shell({
    title: "Brand Setup",
    step: 2,
    businessSlug: input.brand.businessSlug,
    businessName: input.brand.businessName,
    error: input.error,
    message: input.message,
    body: `<h1>Make it look like the business</h1>
      <p class="lead">Add the logo, choose the palette, and optionally let Gemini suggest colors from the uploaded logo.</p>
      <form method="post" action="/onboarding/${escapeHtml(input.brand.businessSlug)}/brand" enctype="multipart/form-data">
        <div class="fields">
          <div><label>Logo</label><input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div>
          <div><label>Optional example poster</label><input name="boardFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div>
        </div>
        <div class="color-grid">
          <div class="color-field"><label>Primary</label><input name="primary" type="color" value="${escapeHtml(input.brand.colors.primary)}"></div>
          <div class="color-field"><label>Secondary</label><input name="secondary" type="color" value="${escapeHtml(input.brand.colors.secondary)}"></div>
          <div class="color-field"><label>Accent</label><input name="accent" type="color" value="${escapeHtml(input.brand.colors.accent)}"></div>
          <div class="color-field"><label>Dark text</label><input name="darkText" type="color" value="${escapeHtml(input.brand.colors.darkText)}"></div>
          <div class="color-field"><label>Muted text</label><input name="mutedText" type="color" value="${escapeHtml(input.brand.colors.mutedText)}"></div>
        </div>
        <div class="fields">
          <div><label>Style direction</label><select name="style">
            <option value="premium">Premium and clean</option>
            <option value="friendly">Friendly and warm</option>
            <option value="bold">Bold and promotional</option>
            <option value="minimal">Minimal and elegant</option>
          </select></div>
        </div>
        <label>Any brand notes?</label>
        <textarea name="notes" placeholder="Example: avoid crowded flyers, keep it modern, use soft backgrounds"></textarea>
        <div class="callout">Tip: upload the logo, then use color suggestion to fill a usable palette. You can still adjust every color manually.</div>
        <div class="actions">
          <button type="submit">Save and continue</button>
          <button class="secondary" type="submit" formaction="/onboarding/${escapeHtml(input.brand.businessSlug)}/brand/suggest-colors">Suggest colors from logo</button>
          <a class="button secondary" href="/onboarding/${escapeHtml(input.brand.businessSlug)}/business">Back</a>
        </div>
      </form>`,
  });
}

export function renderOnboardingSample(input: {
  brand: BusinessBrandSystem;
  today: string;
  entry?: ContentCalendarEntry | null;
  poster: GeneratedPoster | null;
  error?: string;
  message?: string;
}): string {
  const posterHtml =
    input.poster?.status === "ready" && input.poster.imageUrl
      ? `<img src="${escapeHtml(input.poster.imageUrl)}" alt="Generated sample poster">`
      : `Your first sample poster will appear here.`;
  return shell({
    title: "Sample Poster",
    step: 3,
    businessSlug: input.brand.businessSlug,
    businessName: input.brand.businessName,
    error: input.error,
    message: input.message,
    body: `<h1>Your first poster moment</h1>
      <p class="lead">Create sample content for this business, then generate the first branded poster from it.</p>
      <div class="preview-grid">
        <div class="poster-preview">${posterHtml}</div>
        <div>
          <h2 style="margin-top:0;">${escapeHtml(input.brand.businessName)}</h2>
          <p class="callout" style="margin-top:0;">The sample uses the business details, brand color, logo/reference images if uploaded, and a safe starter content idea for ${escapeHtml(input.today)}.</p>
          <form method="post" action="/onboarding/${escapeHtml(input.brand.businessSlug)}/sample">
            <input type="hidden" name="date" value="${escapeHtml(input.today)}">
            <div class="fields">
              <div><label>Content style</label><select name="contentStyle">
                <option value="mixed">Useful and simple</option>
                <option value="educational">Educational</option>
                <option value="promotional">Promotional</option>
                <option value="trust">Trust-building</option>
              </select></div>
              <div><label>Focus note</label><input name="contentNotes" placeholder="Example: website redesign, booking reminder"></div>
            </div>
            <label>Sample topic</label>
            <input name="topic" value="${escapeHtml(input.entry?.topic ?? "Helpful tip for customers")}" required>
            <label>Message</label>
            <textarea name="message">${escapeHtml(input.entry?.message ?? "A simple, useful post that introduces the business and gives customers one reason to get in touch today.")}</textarea>
            <div class="actions">
              <button type="submit">Generate sample poster</button>
              <button class="secondary" type="submit" formaction="/onboarding/${escapeHtml(input.brand.businessSlug)}/sample-content">Create sample content</button>
              <a class="button secondary" href="/onboarding/${escapeHtml(input.brand.businessSlug)}/plan">Use this style daily</a>
              <a class="button secondary" href="/onboarding/${escapeHtml(input.brand.businessSlug)}/brand">Back</a>
            </div>
          </form>
        </div>
      </div>`,
  });
}

export function renderOnboardingPlan(input: {
  brand: BusinessBrandSystem;
  month: string;
  entries: ContentCalendarEntry[];
  error?: string;
  message?: string;
}): string {
  const visibleEntries = input.entries.slice(0, 10);
  return shell({
    title: "Monthly Plan",
    step: 4,
    businessSlug: input.brand.businessSlug,
    businessName: input.brand.businessName,
    error: input.error,
    message: input.message,
    body: `<h1>Plan the next 30 posts</h1>
      <p class="lead">Generate a simple monthly content plan. The customer can edit any day later from the main app.</p>
      <form method="post" action="/onboarding/${escapeHtml(input.brand.businessSlug)}/plan">
        <div class="fields">
          <div><label>Month</label><input type="month" name="month" value="${escapeHtml(input.month)}"></div>
          <div><label>Posting frequency</label><select name="frequency"><option value="daily">Daily</option><option value="weekdays">Weekdays only</option></select></div>
        </div>
        <div class="fields">
          <div><label>Content style</label><select name="style"><option value="mixed">Mixed</option><option value="educational">Educational</option><option value="promotional">Promotional</option><option value="engagement">Engagement</option></select></div>
          <div><label>Focus note</label><input name="notes" placeholder="Example: more educational, less discounts"></div>
        </div>
        <div class="actions"><button type="submit">Generate my calendar</button></div>
      </form>
      <h3 style="margin-top: 48px;">Calendar Preview</h3>
      ${
        visibleEntries.length
          ? `<div class="task-list">${visibleEntries
              .map(
                (entry) => `<div class="task-item">
                  <span class="badge" style="background: var(--brand-light); color: var(--brand-primary); border-color: #bae6fd;">${escapeHtml(entry.date.slice(5))}</span>
                  <div>
                    <strong>${escapeHtml(entry.topic)}</strong>
                    <p class="mini">${escapeHtml(entry.message ?? "Ready for poster generation")}</p>
                  </div>
                </div>`,
              )
              .join("")}</div>`
          : `<div class="callout">No plan yet. Generate one to preview the first few days.</div>`
      }
      <div class="actions" style="margin-top: 32px;"><a class="button" href="/onboarding/${escapeHtml(input.brand.businessSlug)}/activate">Approve calendar</a><a class="button secondary" href="/onboarding/${escapeHtml(input.brand.businessSlug)}/sample">Back</a></div>`,
  });
}

export function renderOnboardingActivate(input: {
  brand: BusinessBrandSystem;
  automationSettings: AutomationSettings;
  emailProviderConfigured: boolean;
  geminiConfigured: boolean;
  error?: string;
  message?: string;
}): string {
  return shell({
    title: "Activate Daily Posters",
    step: 5,
    businessSlug: input.brand.businessSlug,
    businessName: input.brand.businessName,
    error: input.error,
    message: input.message,
    body: `<h1>Start daily posters</h1>
      <p class="lead">Choose when the customer’s poster should be generated and where completed posters should be delivered.</p>
      ${
        input.geminiConfigured
          ? `<div class="alert">Gemini generation is configured for this workspace.</div>`
          : `<div class="alert error">Gemini generation is not configured yet. Add the Gemini API key to the Worker environment before live generation.</div>`
      }
      ${
        input.emailProviderConfigured
          ? `<div class="alert">Email delivery provider is configured.</div>`
          : `<div class="callout">Email delivery can be enabled after Resend settings are configured. The dashboard will still create and store posters.</div>`
      }
      <form method="post" action="/onboarding/${escapeHtml(input.brand.businessSlug)}/activate">
        <label class="switch">
          <input type="checkbox" name="enabled"${checked(input.automationSettings.enabled)}>
          <strong style="font-size: 1.05rem;">Daily posters active</strong>
        </label>
        <div class="fields">
          <div><label>Daily generation time</label><input name="localTime" type="time" value="${escapeHtml(input.automationSettings.localTime)}" required></div>
          <div><label>Delivery emails</label><input name="recipientEmails" value="${escapeHtml(input.automationSettings.recipientEmails.join(", "))}" placeholder="owner@example.com"></div>
        </div>
        <label class="switch" style="margin-top: 16px;">
          <input type="checkbox" name="emailEnabled"${checked(input.automationSettings.emailEnabled && input.emailProviderConfigured)}>
          <span style="font-weight: 600;">Email poster automatically after generation</span>
        </label>
        <div class="actions"><button type="submit">Start my daily posters</button><a class="button secondary" href="/onboarding/${escapeHtml(input.brand.businessSlug)}/plan">Back</a><a class="button secondary" href="/app/${escapeHtml(input.brand.businessSlug)}">Open dashboard</a></div>
      </form>`,
  });
}
