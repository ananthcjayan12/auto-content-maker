import {
  POSTER_TYPES,
  type BusinessBrandSystem,
  type ContentSourceSettings,
  type GenerationSettings,
  type GeneratedPoster,
  type PosterType,
  type PosterTypeReference,
  type PosterPromptSettings,
} from "./types";
import {
  IMAGE_MODEL_CAPABILITIES,
  IMAGE_MODELS,
  TEXT_MODELS,
} from "./gemini-models";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lines(items: string[]): string {
  return escapeHtml(items.join("\n"));
}

function selected(value: string, current: string): string {
  return value === current ? " selected" : "";
}

function formatUsd(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not available";
  return `$${value.toFixed(value >= 0.01 ? 4 : 6)}`;
}

const styles = `
  :root{--ink:#102f30;--teal:#087f7d;--teal-strong:#056765;--soft:#f4f8f7;--surface:#fff;--line:#dce7e5;--muted:#647776;--danger:#9b392c;--shadow:0 12px 34px rgba(16,47,48,.07)}
  *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--soft);color:var(--ink);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  a{color:var(--teal)}.shell{width:min(1240px,calc(100% - 32px));margin:24px auto 72px}.top,.card,.workspace{background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow)}
  .top{padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px}.top h1{margin:0;font-size:clamp(1.6rem,3vw,2.35rem);letter-spacing:-.035em}.eyebrow{margin:0 0 3px;color:var(--teal);font-size:.72rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase}
  .workspace{position:sticky;z-index:20;top:10px;margin-top:16px;padding:18px 20px}.workspace-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:12px}.workspace h2{font-size:1rem;margin:0}.workspace .help{margin:2px 0 0}.type-tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.type-tab{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#f8fbfa;color:var(--ink);font-weight:760;text-decoration:none;text-transform:capitalize}.type-tab:hover{border-color:#9bc9c6;background:#f0f8f7}.type-tab.active{background:var(--ink);border-color:var(--ink);color:#fff}.type-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#e5f2f0;color:var(--teal-strong);font-size:.72rem}.type-tab.active .type-count{background:rgba(255,255,255,.16);color:#fff}
  .section-nav{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0}.section-nav a{padding:7px 11px;border-radius:999px;background:#eaf3f2;color:var(--ink);font-size:.82rem;font-weight:750;text-decoration:none}
  .grid{display:grid;grid-template-columns:1.35fr .65fr;gap:18px;margin-top:18px}.card{padding:26px;scroll-margin-top:170px}.wide{grid-column:1/-1}.create-panel{order:1}.reference-panel{order:2}.content-panel{order:3}.gallery-panel{order:4}.brand-panel{order:5}.advanced-panel{order:6}.help-panel{order:7}h2{margin:0 0 6px;font-size:1.35rem;letter-spacing:-.015em}h3{margin:24px 0 10px}.help{margin:0 0 18px;color:var(--muted)}
  .section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.section-kicker{font-size:.72rem;color:var(--teal);font-weight:850;text-transform:uppercase;letter-spacing:.1em}.current-type{display:inline-flex;padding:7px 11px;border-radius:999px;background:#e7f3f1;color:var(--teal-strong);font-weight:800;text-transform:capitalize;white-space:nowrap}
  label{display:block;margin:14px 0 6px;font-weight:760}input,select,textarea{width:100%;border:1px solid #bfd3d1;border-radius:11px;padding:11px 12px;background:#fff;color:var(--ink);font:inherit;transition:border-color .15s,box-shadow .15s}input:focus,select:focus,textarea:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px rgba(8,127,125,.12)}textarea{min-height:105px;resize:vertical}.prompt-template{min-height:240px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}input[type=color]{height:44px;padding:4px}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.colors{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:20px}
  button,.button{border:0;border-radius:11px;padding:11px 16px;background:var(--ink);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer;transition:transform .12s,background .12s}button:hover,.button:hover{background:#1a4546;transform:translateY(-1px)}button:disabled{opacity:.5;cursor:not-allowed;transform:none}.secondary{background:#e6f1ef;color:var(--ink)}.secondary:hover{background:#d7eae7}.danger{background:transparent;color:var(--danger);border:1px solid #ebcbc6}.danger:hover{background:#fff1ef}
  .message{margin:16px 0 0;padding:12px 15px;border-radius:11px;background:#dcf8ec;color:#126444;font-weight:750}.message.error{background:#fff0ed;color:var(--danger)}.preview{max-width:100%;max-height:280px;object-fit:contain;border:1px solid var(--line);border-radius:12px;background:#f7fbfb;padding:8px}.url{font-size:.82rem;overflow-wrap:anywhere;color:var(--muted)}
  .reference-grid,.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin:16px 0}.reference-item,.gallery-item{border:1px solid var(--line);padding:10px;background:#f8fbfa;border-radius:14px}.reference-item img,.gallery-item img{width:100%;height:190px;object-fit:contain;background:#fff;border-radius:10px}.reference-item label{display:flex;align-items:center;gap:8px;margin:9px 0 0}.reference-item input[type=checkbox]{width:auto}.capability,.callout{padding:12px 14px;background:#f0f7f6;border-left:3px solid var(--teal);border-radius:0 10px 10px 0;color:var(--muted);font-size:.9rem}.empty{padding:24px;border:1px dashed #b7cecb;border-radius:14px;background:#fafcfc;text-align:center}.empty strong{display:block;margin-bottom:4px}
  .lab-grid,.stats{display:grid;grid-template-columns:1.2fr .8fr;gap:20px}.stack{display:grid;gap:12px}.stat{padding:16px;border:1px solid var(--line);border-radius:13px;background:#f8fbfa}.stat strong{display:block;font-size:1.25rem}.code{font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f7fbfb;border:1px solid var(--line);border-radius:12px;padding:12px}.mini{font-size:.86rem;color:var(--muted)}.gallery-item .meta{display:grid;gap:6px;margin-top:10px}.pill{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:#e8f3f2;color:var(--ink);font-size:.76rem;font-weight:750}.status-ready{background:#dcf8ec;color:#126444}.status-failed,.status-needs_review{background:#fff0ed;color:#8f2d20}
  details.settings{border:1px solid var(--line);border-radius:14px;background:#fbfdfd;margin-top:12px}details.settings>summary{padding:15px 17px;font-weight:800;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center}details.settings>summary:after{content:'+';font-size:1.25rem;color:var(--teal)}details.settings[open]>summary:after{content:'−'}details.settings>div{padding:0 17px 18px;border-top:1px solid var(--line)}
  .login{width:min(520px,calc(100% - 28px));margin:12vh auto}.login .card{padding:clamp(24px,6vw,44px)}.login h1{font-size:2.2rem;line-height:1.1;margin:0 0 10px}
  @media(max-width:900px){.type-tabs{grid-template-columns:repeat(3,1fr)}.grid,.lab-grid,.stats{grid-template-columns:1fr}.wide{grid-column:auto}.card{scroll-margin-top:240px}}
  @media(max-width:620px){.shell{width:min(100% - 20px,1240px);margin-top:10px}.top{padding:20px;align-items:flex-start;flex-direction:column}.workspace{position:static;padding:14px}.workspace-head{align-items:flex-start;flex-direction:column}.type-tabs{display:flex;overflow-x:auto;padding-bottom:3px}.type-tab{min-width:128px}.fields{grid-template-columns:1fr}.colors{grid-template-columns:1fr 1fr}.card{padding:20px}.section-heading{flex-direction:column}.section-nav{display:none}}
`;

function document(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${body}</body></html>`;
}

export function renderLoginPage(
  brands: BusinessBrandSystem[],
  error?: string,
): string {
  const options = brands
    .map(
      (brand) =>
        `<option value="${escapeHtml(brand.businessSlug)}">${escapeHtml(brand.businessName)}</option>`,
    )
    .join("");
  return document(
    "Daily Poster Admin",
    `<main class="login"><section class="card">
      <p class="eyebrow">Daily Poster Packet</p>
      <h1>Poster admin</h1>
      <p class="help">Choose a business and enter the admin token to manage its stable brand system, logo, and poster reference images.</p>
      ${error ? `<p class="message error" role="alert">${escapeHtml(error)}</p>` : ""}
      ${
        brands.length
          ? `<form method="post" action="/admin/login">
              <label for="businessSlug">Business</label>
              <select id="businessSlug" name="businessSlug" required>${options}</select>
              <label for="token">Admin token</label>
              <input id="token" name="token" type="password" autocomplete="current-password" required>
              <div class="actions"><button type="submit">Open dashboard</button></div>
            </form>`
          : `<p class="message error">No businesses exist yet. Seed the database or create the first brand system through the protected API.</p>`
      }
    </section></main>`,
  );
}

export function renderDashboard(input: {
  brand: BusinessBrandSystem;
  typeReference: PosterTypeReference | null;
  allTypeReferences: Record<PosterType, PosterTypeReference | null>;
  generationSettings: GenerationSettings;
  promptSettings: PosterPromptSettings;
  contentSourceSettings: ContentSourceSettings;
  generatedPoster: GeneratedPoster | null;
  recentGeneratedPosters: GeneratedPoster[];
  selectedType: PosterType;
  selectedDate: string;
  publicBaseUrl: string;
  message?: string;
  error?: string;
}): string {
  const {
    brand,
    typeReference,
    allTypeReferences,
    generationSettings,
    promptSettings,
    contentSourceSettings,
    generatedPoster,
    recentGeneratedPosters,
    selectedType,
    selectedDate,
    publicBaseUrl,
    message,
    error,
  } = input;
  const publicUrl = `${publicBaseUrl}/daily-poster/${brand.businessSlug}/${selectedType}/today`;
  const typeLabels: Record<PosterType, string> = {
    awareness: "Awareness",
    offer: "Offer",
    festival: "Festival",
    anniversary: "Anniversary",
    review: "Review",
    general: "General",
  };
  const typeGuidance: Record<PosterType, string> = {
    awareness:
      "Use today's Google Sheet row when available, or let AI create a timely dental-awareness topic.",
    offer:
      "Create from confirmed offer facts only. Review and edit the brief before generating the image.",
    festival:
      "Create a date-relevant Kerala or India greeting while keeping the clinic brand dominant.",
    anniversary:
      "Use only verified milestone details. Never allow AI to invent years, counts, or achievements.",
    review:
      "Upload a customer screenshot or paste their message below. The review is treated as factual evidence.",
    general:
      "Create a clinic update, reminder, service message, or relevant general greeting.",
  };
  const typeTabs = POSTER_TYPES.map((type) => {
    const count = allTypeReferences[type]?.referenceImageUrls.length ?? 0;
    const href = `/admin/${encodeURIComponent(brand.businessSlug)}?posterType=${type}&date=${encodeURIComponent(selectedDate)}`;
    return `<a class="type-tab${type === selectedType ? " active" : ""}" href="${escapeHtml(href)}"${type === selectedType ? ' aria-current="page"' : ""}>
      <span>${escapeHtml(typeLabels[type])}</span><span class="type-count" title="${count} saved reference image${count === 1 ? "" : "s"}">${count}</span>
    </a>`;
  }).join("");
  const textModelOptions = TEXT_MODELS.map(
    (model) =>
      `<option value="${escapeHtml(model.id)}"${selected(model.id, generationSettings.textModel)}>${escapeHtml(model.label)}</option>`,
  ).join("");
  const imageModelOptions = IMAGE_MODELS.map(
    (model) =>
      `<option value="${escapeHtml(model.id)}"${selected(model.id, generationSettings.imageModel)}>${escapeHtml(model.label)}</option>`,
  ).join("");
  const resolutionOptions = ["512", "1K", "2K", "4K"]
    .map(
      (resolution) =>
        `<option value="${resolution}"${selected(resolution, generationSettings.imageResolution)}>${resolution}</option>`,
    )
    .join("");
  const modelCapabilities = JSON.stringify(
    Object.fromEntries(
      Object.entries(IMAGE_MODEL_CAPABILITIES).map(([model, capability]) => [
        model,
        {
          resolutions: capability.resolutions,
          maxInputImages: capability.maxInputImages,
          maxStyleReferences: capability.maxStyleReferences,
          configurableResolution: capability.configurableResolution,
        },
      ]),
    ),
  ).replaceAll("<", "\\u003c");
  const referenceImages = typeReference?.referenceImageUrls ?? [];
  const currentPrompt = generatedPoster?.prompt ?? "";
  const currentBrief = generatedPoster?.briefJson ?? "";
  const currentStatus = generatedPoster?.status ?? "not_started";
  const currentCost = generatedPoster?.costBreakdown?.totalUsd ?? null;
  const galleryHtml = recentGeneratedPosters.length
    ? `<div class="gallery-grid">${recentGeneratedPosters
        .map((poster) => {
          const statusClass =
            poster.status === "ready"
              ? "status-ready"
              : poster.status === "failed" || poster.status === "needs_review"
                ? `status-${poster.status}`
                : "";
          return `<article class="gallery-item">
              ${
                poster.imageUrl
                  ? `<img src="${escapeHtml(poster.imageUrl)}" alt="${escapeHtml(poster.posterType)} generated poster for ${escapeHtml(poster.date)}">`
                  : `<div class="code">No image saved for this run yet.</div>`
              }
              <div class="meta">
                <div><span class="pill ${statusClass}">${escapeHtml(poster.status)}</span></div>
                <div><strong>${escapeHtml(poster.date)}</strong></div>
                <div class="mini">${escapeHtml(poster.posterType)} • ${escapeHtml(poster.geminiImageModel ?? "model unknown")}</div>
                <div class="mini">Cost: ${escapeHtml(formatUsd(poster.costBreakdown?.totalUsd ?? null))}</div>
                ${
                  poster.imageUrl
                    ? `<form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/generated-reference">
                        <input type="hidden" name="posterType" value="${escapeHtml(selectedType)}">
                        <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
                        <input type="hidden" name="imageUrl" value="${escapeHtml(poster.imageUrl)}">
                        <div class="actions"><button type="submit" class="secondary">Use as reference</button></div>
                      </form>`
                    : ""
                }
              </div>
            </article>`;
        })
        .join("")}</div>`
    : `<div class="empty"><strong>No ${escapeHtml(typeLabels[selectedType].toLowerCase())} posters yet</strong><span class="mini">Generate the first one from the Create poster section.</span></div>`;

  return document(
    `Admin — ${brand.businessName}`,
    `<main class="shell">
      <header class="top">
        <div><p class="eyebrow">Content studio</p><h1>${escapeHtml(brand.businessName)}</h1><p class="help" style="margin:4px 0 0">Create, review, and manage every poster type from one workspace.</p></div>
        <div class="actions">
          <a class="button secondary" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">View public context</a>
          <form method="post" action="/admin/logout"><button class="danger" type="submit">Log out</button></form>
        </div>
      </header>
      ${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}
      ${error ? `<p class="message error" role="alert">${escapeHtml(error)}</p>` : ""}
      <nav class="workspace" aria-label="Poster type workspace">
        <div class="workspace-head">
          <div><h2>Choose a poster type</h2><p class="help">References, prompts, gallery, and generation stay scoped to this selection.</p></div>
          <span class="current-type">Working on: ${escapeHtml(typeLabels[selectedType])}</span>
        </div>
        <div class="type-tabs">${typeTabs}</div>
        <div class="section-nav" aria-label="Dashboard sections">
          <a href="#create">Create poster</a><a href="#references">References</a><a href="#gallery">Gallery</a><a href="#brand">Brand</a><a href="#advanced">Advanced settings</a>
        </div>
      </nav>
      <div class="grid">
        <section class="card wide advanced-panel" id="advanced">
          <h2>Generation settings</h2>
          <p class="help">Choose the Gemini model used for the daily content brief and the model/resolution used for the final poster. Only model-supported resolutions can be saved.</p>
          <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/generation-settings">
            <div class="fields">
              <div>
                <label for="textModel">Content brief model</label>
                <select id="textModel" name="textModel">${textModelOptions}</select>
              </div>
              <div>
                <label for="imageModel">Poster image model</label>
                <select id="imageModel" name="imageModel">${imageModelOptions}</select>
              </div>
            </div>
            <label for="imageResolution">Poster resolution</label>
            <select id="imageResolution" name="imageResolution">${resolutionOptions}</select>
            <p id="modelCapability" class="capability"></p>
            <div class="actions"><button type="submit">Save generation settings</button></div>
          </form>
        </section>

        <section class="card wide content-panel"${selectedType === "awareness" ? "" : " hidden"}>
          <h2>Awareness content source</h2>
          <p class="help">Choose whether awareness posts first look for a row matching today in Google Sheets, or always start with AI. A missing sheet row automatically falls back to AI-generated content.</p>
          <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/content-sources">
            <label for="awarenessMode">Content choice</label>
            <select id="awarenessMode" name="awarenessMode">
              <option value="sheet_first"${selected("sheet_first", contentSourceSettings.awarenessMode)}>Google Sheet first, then AI fallback</option>
              <option value="ai_only"${selected("ai_only", contentSourceSettings.awarenessMode)}>Always use AI-generated content</option>
            </select>
            <label for="googleSheetUrl">Google Sheet URL</label>
            <input id="googleSheetUrl" name="googleSheetUrl" type="url" value="${escapeHtml(contentSourceSettings.googleSheetUrl)}" placeholder="https://docs.google.com/spreadsheets/d/…/edit">
            <p class="help">Share the sheet as “Anyone with the link can view.” It must contain a <strong>Date</strong> column. Only the matching date row—not the whole sheet—is passed to Gemini. Other columns such as Headline, Supporting Text, CTA, or Notes are available for careful editing.</p>
            <div class="actions"><button type="submit">Save content source</button></div>
          </form>
        </section>

        <section class="card wide advanced-panel">
          <h2>Editable generation prompts</h2>
          <p class="help">Advanced controls for how Gemini writes and designs ${escapeHtml(typeLabels[selectedType].toLowerCase())} posters. Most users can leave these unchanged.</p>
          <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/prompt-settings">
            <input type="hidden" name="selectedPosterType" value="${escapeHtml(selectedType)}">
            <label for="posterTypePrompt_${selectedType}">${escapeHtml(typeLabels[selectedType])} instructions</label>
            <textarea id="posterTypePrompt_${selectedType}" name="posterTypePrompt_${selectedType}" class="prompt-template" required>${escapeHtml(promptSettings.posterTypePrompts[selectedType])}</textarea>
            ${POSTER_TYPES.filter((type) => type !== selectedType)
              .map(
                (type) =>
                  `<input type="hidden" name="posterTypePrompt_${type}" value="${escapeHtml(promptSettings.posterTypePrompts[type])}">`,
              )
              .join("")}
            <details class="settings">
              <summary>Global prompt templates</summary>
              <div>
                <p class="help">These affect every poster type. Variables such as <code>{{businessName}}</code>, <code>{{phone}}</code>, <code>{{date}}</code>, and <code>{{posterTypePrompt}}</code> are filled automatically.</p>
                <label for="contentPromptTemplate">Content-generation prompt</label>
                <textarea id="contentPromptTemplate" name="contentPromptTemplate" class="prompt-template" required>${escapeHtml(promptSettings.contentPromptTemplate)}</textarea>
                <label for="masterImagePromptTemplate">Master image prompt</label>
                <textarea id="masterImagePromptTemplate" name="masterImagePromptTemplate" class="prompt-template" required>${escapeHtml(promptSettings.masterImagePromptTemplate)}</textarea>
                <label for="referencePromptTemplate">Reference-image instructions</label>
                <textarea id="referencePromptTemplate" name="referencePromptTemplate" class="prompt-template" required>${escapeHtml(promptSettings.referencePromptTemplate)}</textarea>
              </div>
            </details>
            <div class="actions"><button type="submit">Save prompt settings</button></div>
          </form>
        </section>

        <section class="card wide reference-panel" id="references">
          <div class="section-heading"><div><p class="section-kicker">Visual direction</p><h2>${escapeHtml(typeLabels[selectedType])} reference library</h2><p class="help">These images guide layout, typography, spacing, and visual style only for ${escapeHtml(typeLabels[selectedType].toLowerCase())} posters.</p></div><span class="current-type">${referenceImages.length} of 14 saved</span></div>
          ${
            referenceImages.length
              ? `<div class="reference-grid">${referenceImages
                  .map(
                    (url, index) =>
                      `<div class="reference-item">
                        <img src="${escapeHtml(url)}" alt="${escapeHtml(selectedType)} reference ${index + 1}">
                        <label><input type="checkbox" name="keepReferenceImageUrls" value="${escapeHtml(url)}" form="reference-form" checked> Keep reference ${index + 1}</label>
                      </div>`,
                  )
                  .join("")}</div>`
              : `<div class="empty"><strong>No ${escapeHtml(typeLabels[selectedType].toLowerCase())} references yet</strong><span class="mini">Upload one or more examples below. Other poster types keep their own separate libraries.</span></div>`
          }
          <form id="reference-form" method="post" action="/admin/${escapeHtml(brand.businessSlug)}/type-reference" enctype="multipart/form-data">
            <input type="hidden" name="posterType" value="${escapeHtml(selectedType)}">
            <label for="typeReferenceFiles">Add ${escapeHtml(typeLabels[selectedType].toLowerCase())} reference images</label><input id="typeReferenceFiles" name="typeReferenceFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>
            <p class="help">Maximum stored references: 14. Gemini 3.1 Flash Image can use up to 14 total inputs; Gemini 3 Pro Image accepts up to 3 style references; Gemini 2.5 Flash Image is limited to one poster style reference in this workflow.</p>
            <label>Reference notes</label><textarea name="notes">${escapeHtml(typeReference?.notes)}</textarea>
            <div class="actions"><button type="submit">Save ${escapeHtml(typeLabels[selectedType])} references</button><a class="button secondary" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">View public context</a></div>
          </form>
        </section>

        <section class="card wide create-panel" id="create">
          <div class="section-heading"><div><p class="section-kicker">Create</p><h2>Create ${escapeHtml(typeLabels[selectedType].toLowerCase())} poster</h2><p class="help">${escapeHtml(typeGuidance[selectedType])}</p></div><span class="current-type">${escapeHtml(typeLabels[selectedType])}</span></div>
          <div class="lab-grid">
            <div class="stack">
              <form id="lab-form">
                <div class="fields">
                  <div>
                    <label>Poster type</label>
                    <input type="hidden" id="labPosterType" name="posterType" value="${escapeHtml(selectedType)}">
                    <div class="callout"><strong>${escapeHtml(typeLabels[selectedType])}</strong><br><span class="mini">Change type using the workspace tabs above.</span></div>
                  </div>
                  <div>
                    <label for="labDate">Date</label>
                    <input id="labDate" name="date" type="date" value="${escapeHtml(selectedDate)}">
                  </div>
                </div>
                <div id="reviewScreenshotField" hidden>
                  <label for="reviewScreenshot">Customer review screenshot (option 1)</label>
                  <input id="reviewScreenshot" name="reviewScreenshot" type="file" accept="image/png,image/jpeg,image/webp">
                  <label for="reviewMessage">Paste the review message (option 2)</label>
                  <textarea id="reviewMessage" name="reviewMessage" placeholder="Paste the customer's review exactly as received"></textarea>
                  <p class="help">For review posters, provide either a screenshot or the review text. If both are supplied, the screenshot remains the primary evidence.</p>
                </div>
                <div class="actions">
                  <button type="button" id="generateBrief">1. Prepare content</button>
                  <button type="button" id="generateImage" class="secondary">2. Generate poster</button>
                </div>
              </form>
              <div id="labMessage" class="message" hidden></div>
              <div>
                <label for="promptEditor">Poster instructions <span class="mini">— optional review before generation</span></label>
                <textarea id="promptEditor" name="promptEditor">${escapeHtml(currentPrompt)}</textarea>
              </div>
              <div>
                <label for="briefPreview">Prepared content <span class="mini">— edit wording here if needed</span></label>
                <textarea id="briefPreview" name="briefPreview">${escapeHtml(currentBrief)}</textarea>
              </div>
            </div>
            <div class="stack">
              <div class="stat">
                <span class="mini">Current status</span>
                <strong id="statusValue">${escapeHtml(currentStatus)}</strong>
              </div>
              <div class="stat">
                <span class="mini">Current estimated cost</span>
                <strong id="costValue">${escapeHtml(formatUsd(currentCost))}</strong>
                <div class="mini" id="costNote">${escapeHtml(generatedPoster?.costBreakdown?.note ?? "Generate an image to see the latest saved API cost estimate.")}</div>
              </div>
              <div class="stat">
                <span class="mini">Current image</span>
                <div id="currentImageWrap">
                  ${
                    generatedPoster?.imageUrl
                      ? `<img class="preview" id="currentImage" src="${escapeHtml(generatedPoster.imageUrl)}" alt="Latest generated poster">`
                      : `<div class="code" id="currentImage">No image generated yet.</div>`
                  }
                </div>
                <div class="actions">
                  <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/generated-reference" id="currentImageReferenceForm">
                    <input type="hidden" name="posterType" value="${escapeHtml(selectedType)}">
                    <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
                    <input type="hidden" name="imageUrl" id="currentImageReferenceUrl" value="${escapeHtml(generatedPoster?.imageUrl ?? "")}">
                    <button type="submit" class="secondary"${generatedPoster?.imageUrl ? "" : " disabled"}>Add current image as reference</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="card wide gallery-panel" id="gallery">
          <div class="section-heading"><div><p class="section-kicker">Review</p><h2>${escapeHtml(typeLabels[selectedType])} poster gallery</h2><p class="help">Review recent outputs and promote strong designs into this type's reference library.</p></div></div>
          ${galleryHtml}
        </section>

        <section class="card brand-panel" id="brand">
          <h2>Brand system</h2><p class="help">Static business identity and permanent design rules.</p>
          <details class="settings">
            <summary>Edit brand identity and assets</summary>
            <div>
          <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/brand" enctype="multipart/form-data">
            <label for="businessName">Business name</label><input id="businessName" name="businessName" value="${escapeHtml(brand.businessName)}" required>
            <div class="fields">
              <div><label for="phone">Phone</label><input id="phone" name="phone" value="${escapeHtml(brand.phone)}" required></div>
              <div><label for="websiteUrl">Website URL</label><input id="websiteUrl" name="websiteUrl" type="url" value="${escapeHtml(brand.websiteUrl)}"></div>
            </div>
            <h3>Logo</h3><img class="preview" src="${escapeHtml(brand.logoUrl)}" alt="Current logo"><p class="url">${escapeHtml(brand.logoUrl)}</p>
            <input name="logoUrl" type="hidden" value="${escapeHtml(brand.logoUrl)}"><label for="logoFile">Replace logo image</label><input id="logoFile" name="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
            <h3>Brand reference board</h3><img class="preview" src="${escapeHtml(brand.brandReferenceBoardUrl)}" alt="Current brand reference board"><p class="url">${escapeHtml(brand.brandReferenceBoardUrl)}</p>
            <input name="brandReferenceBoardUrl" type="hidden" value="${escapeHtml(brand.brandReferenceBoardUrl)}"><label for="boardFile">Replace brand board image</label><input id="boardFile" name="boardFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
            <div class="actions"><button class="secondary" type="submit" form="poster-preset-form">Apply Smile Craft poster preset</button></div>
            <h3>Colors</h3><div class="colors">
              ${Object.entries(brand.colors)
                .map(
                  ([key, value]) =>
                    `<div><label for="color-${key}">${escapeHtml(key)}</label><input id="color-${key}" name="${key}" type="color" value="${escapeHtml(value)}"></div>`,
                )
                .join("")}
            </div>
            <h3>Typography</h3>
            <label>Heading style</label><input name="headingStyle" value="${escapeHtml(brand.typography.headingStyle)}" required>
            <label>Body style</label><input name="bodyStyle" value="${escapeHtml(brand.typography.bodyStyle)}" required>
            <label>Font mood</label><input name="fontMood" value="${escapeHtml(brand.typography.fontMood)}" required>
            <h3>Visual style</h3>
            <label>Mood</label><textarea name="mood" required>${escapeHtml(brand.visualStyle.mood)}</textarea>
            <label>Layout</label><textarea name="layout" required>${escapeHtml(brand.visualStyle.layout)}</textarea>
            <label>Photo style</label><textarea name="photoStyle" required>${escapeHtml(brand.visualStyle.photoStyle)}</textarea>
            <label>Avoid — one rule per line</label><textarea name="avoid">${lines(brand.visualStyle.avoid)}</textarea>
            <label>Default poster rules — one per line</label><textarea name="defaultPosterRules">${lines(brand.defaultPosterRules)}</textarea>
            <div class="actions"><button type="submit">Save brand system</button></div>
          </form>
          <form id="poster-preset-form" method="post" action="/admin/${escapeHtml(brand.businessSlug)}/preset"></form>
            </div>
          </details>
        </section>

        <section class="card help-panel">
          <h2>Daily generation flow</h2>
          <p class="help">The Worker combines the saved content template, selected poster-type template, master image template, reference instructions, and today’s generated JSON. The public context URL contains identity and image assets only.</p>
          <h3>Asset context URL</h3>
          <p class="url">${escapeHtml(publicUrl)}</p>
        </section>
      </div>
    </main>
    <script>
      (function () {
        var dashboardGrid = document.querySelector('.grid');
        var panelOrder = [
          document.querySelector('.create-panel'),
          document.querySelector('.reference-panel'),
          document.querySelector('.content-panel'),
          document.querySelector('.gallery-panel'),
          document.querySelector('.brand-panel'),
          ...document.querySelectorAll('.advanced-panel'),
          document.querySelector('.help-panel')
        ];
        panelOrder.forEach(function (panel) { if (panel) dashboardGrid.appendChild(panel); });
        var capabilities = ${modelCapabilities};
        var model = document.getElementById('imageModel');
        var resolution = document.getElementById('imageResolution');
        var note = document.getElementById('modelCapability');
        var form = document.getElementById('lab-form');
        var labPosterType = document.getElementById('labPosterType');
        var reviewScreenshotField = document.getElementById('reviewScreenshotField');
        var briefButton = document.getElementById('generateBrief');
        var imageButton = document.getElementById('generateImage');
        var message = document.getElementById('labMessage');
        var promptEditor = document.getElementById('promptEditor');
        var briefPreview = document.getElementById('briefPreview');
        var statusValue = document.getElementById('statusValue');
        var costValue = document.getElementById('costValue');
        var costNote = document.getElementById('costNote');
        var currentImageWrap = document.getElementById('currentImageWrap');
        var currentImageReferenceUrl = document.getElementById('currentImageReferenceUrl');
        var currentImageReferenceForm = document.getElementById('currentImageReferenceForm');
        var businessSlug = ${JSON.stringify(brand.businessSlug)};
        function syncModelSettings() {
          var capability = capabilities[model.value];
          Array.from(resolution.options).forEach(function (option) {
            option.disabled = !capability.resolutions.includes(option.value);
          });
          if (!capability.resolutions.includes(resolution.value)) {
            resolution.value = capability.resolutions[0];
          }
          note.textContent = capability.configurableResolution
            ? 'Supported resolutions: ' + capability.resolutions.join(', ') + '. Up to ' + capability.maxStyleReferences + ' poster style references are used.'
            : 'This model has fixed approximately 1K output. One poster style reference is used in this workflow.';
        }
        model.addEventListener('change', syncModelSettings);
        syncModelSettings();
        function syncReviewUpload() {
          reviewScreenshotField.hidden = labPosterType.value !== 'review';
        }
        labPosterType.addEventListener('change', syncReviewUpload);
        syncReviewUpload();

        function showMessage(text, isError) {
          message.hidden = false;
          message.textContent = text;
          message.className = isError ? 'message error' : 'message';
        }

        function setBusy(isBusy) {
          briefButton.disabled = isBusy;
          imageButton.disabled = isBusy;
        }

        function labData() {
          return new FormData(form);
        }

        function updateGeneratedPoster(poster) {
          statusValue.textContent = poster.status || 'unknown';
          costValue.textContent = poster.costBreakdown && typeof poster.costBreakdown.totalUsd === 'number'
            ? '$' + poster.costBreakdown.totalUsd.toFixed(poster.costBreakdown.totalUsd >= 0.01 ? 4 : 6)
            : 'Not available';
          costNote.textContent = poster.costBreakdown && poster.costBreakdown.note
            ? poster.costBreakdown.note
            : 'No pricing metadata was saved for this run.';
          if (poster.prompt) promptEditor.value = poster.prompt;
          if (poster.briefJson) briefPreview.value = poster.briefJson;
          if (poster.imageUrl) {
            currentImageWrap.innerHTML = '<img class="preview" id="currentImage" alt="Latest generated poster">';
            currentImageWrap.querySelector('img').src = poster.imageUrl;
            currentImageReferenceUrl.value = poster.imageUrl;
            currentImageReferenceForm.querySelector('button').disabled = false;
          }
        }

        async function postLab(path, data) {
          const response = await fetch(path, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          const body = await response.json();
          if (!response.ok || body.success === false) {
            throw new Error(body.error || 'Request failed.');
          }
          return body;
        }

        briefButton.addEventListener('click', async function () {
          try {
            setBusy(true);
            const body = await postLab('/admin/' + businessSlug + '/generation-lab/brief', labData());
            promptEditor.value = body.imagePrompt || '';
            briefPreview.value = JSON.stringify(body.dailyBrief || {}, null, 2);
            statusValue.textContent = 'brief_ready';
            var source = body.contentSource === 'google_sheet' ? 'Google Sheet content found and edited.' : 'AI content generated.';
            showMessage(source + ' You can edit the prompt before rendering the image.', false);
          } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Brief generation failed.', true);
          } finally {
            setBusy(false);
          }
        });

        imageButton.addEventListener('click', async function () {
          try {
            setBusy(true);
            var data = labData();
            data.set('prompt', promptEditor.value);
            data.set('briefJson', briefPreview.value);
            const body = await postLab('/admin/' + businessSlug + '/generation-lab/image', data);
            updateGeneratedPoster(body.generatedPoster);
            showMessage('Image generated and saved. The latest cost card now reflects this run.', false);
          } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Image generation failed.', true);
          } finally {
            setBusy(false);
          }
        });
      })();
    </script>`,
  );
}
