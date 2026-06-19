import {
  POSTER_TYPES,
  type BusinessBrandSystem,
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
  :root{--ink:#123333;--teal:#0ea5a4;--soft:#edf8f7;--line:#d8e8e6;--muted:#5f6f6f;--danger:#8f2d20}
  *{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  a{color:#087c7b}.shell{width:min(1180px,calc(100% - 28px));margin:28px auto 64px}.top,.card{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 10px 30px rgba(18,51,51,.05)}
  .top{padding:28px;display:flex;align-items:center;justify-content:space-between;gap:20px}.top h1{margin:0;font-size:clamp(1.8rem,4vw,2.8rem);letter-spacing:-.035em}.eyebrow{margin:0 0 5px;color:#087c7b;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.card{padding:26px}.wide{grid-column:1/-1}h2{margin:0 0 6px;font-size:1.35rem}h3{margin:24px 0 10px}.help{margin:0 0 20px;color:var(--muted)}
  label{display:block;margin:13px 0 5px;font-weight:750}input,select,textarea{width:100%;border:1px solid #bfd5d2;border-radius:10px;padding:10px 12px;background:#fff;color:var(--ink);font:inherit}textarea{min-height:100px;resize:vertical}.prompt-template{min-height:300px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}input[type=color]{height:44px;padding:4px}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.colors{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:22px}
  button,.button{border:0;border-radius:10px;padding:11px 15px;background:var(--ink);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}.secondary{background:#e8f3f2;color:var(--ink)}.danger{background:var(--danger)}
  .message{margin:18px 0 0;padding:12px 15px;border-radius:10px;background:#dcf8ec;color:#126444;font-weight:750}.message.error{background:#fff0ed;color:var(--danger)}.preview{max-width:100%;max-height:220px;object-fit:contain;border:1px solid var(--line);border-radius:12px;background:#f7fbfb;padding:8px}.url{font-size:.85rem;overflow-wrap:anywhere;color:var(--muted)}
  .reference-grid,.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:14px 0}.reference-item,.gallery-item{border:1px solid var(--line);padding:10px;background:#f7fbfb;border-radius:12px}.reference-item img,.gallery-item img{width:100%;height:170px;object-fit:contain;background:#fff;border-radius:10px}.reference-item label{display:flex;align-items:center;gap:8px;margin:8px 0 0}.reference-item input[type=checkbox]{width:auto}.capability{padding:10px 12px;background:#f2f8f7;border-left:3px solid var(--teal);color:var(--muted);font-size:.9rem}
  .lab-grid,.stats{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.stack{display:grid;gap:12px}.stat{padding:14px;border:1px solid var(--line);border-radius:12px;background:#f7fbfb}.stat strong{display:block;font-size:1.3rem}.code{font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f7fbfb;border:1px solid var(--line);border-radius:12px;padding:12px}.mini{font-size:.88rem;color:var(--muted)}.gallery-item .meta{display:grid;gap:6px;margin-top:10px}.pill{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:#e8f3f2;color:var(--ink);font-size:.78rem;font-weight:700}.status-ready{background:#dcf8ec;color:#126444}.status-failed,.status-needs_review{background:#fff0ed;color:#8f2d20}
  .login{width:min(520px,calc(100% - 28px));margin:12vh auto}.login .card{padding:clamp(24px,6vw,44px)}.login h1{font-size:2.2rem;line-height:1.1;margin:0 0 10px}
  @media(max-width:780px){.grid,.fields,.lab-grid,.stats{grid-template-columns:1fr}.wide{grid-column:auto}.colors{grid-template-columns:1fr 1fr}.top{align-items:flex-start;flex-direction:column}}
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
  generationSettings: GenerationSettings;
  promptSettings: PosterPromptSettings;
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
    generationSettings,
    promptSettings,
    generatedPoster,
    recentGeneratedPosters,
    selectedType,
    selectedDate,
    publicBaseUrl,
    message,
    error,
  } = input;
  const publicUrl = `${publicBaseUrl}/daily-poster/${brand.businessSlug}/${selectedType}/today`;
  const typeOptions = POSTER_TYPES.map(
    (type) =>
      `<option value="${type}"${selected(type, selectedType)}>${type}</option>`,
  ).join("");
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
    : `<p class="help">No generated poster runs exist for this poster type yet.</p>`;

  return document(
    `Admin — ${brand.businessName}`,
    `<main class="shell">
      <header class="top">
        <div><p class="eyebrow">Poster admin dashboard</p><h1>${escapeHtml(brand.businessName)}</h1></div>
        <div class="actions">
          <a class="button secondary" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">View public context</a>
          <form method="post" action="/admin/logout"><button class="danger" type="submit">Log out</button></form>
        </div>
      </header>
      ${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}
      ${error ? `<p class="message error" role="alert">${escapeHtml(error)}</p>` : ""}
      <div class="grid">
        <section class="card wide">
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

        <section class="card wide">
          <h2>Editable generation prompts</h2>
          <p class="help">These saved templates drive the content model and image model. Variables such as <code>{{businessName}}</code>, <code>{{phone}}</code>, <code>{{date}}</code>, and <code>{{posterTypePrompt}}</code> are filled automatically. Empty templates restore their defaults.</p>
          <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/prompt-settings">
            <input type="hidden" name="selectedPosterType" value="${escapeHtml(selectedType)}">
            <label for="contentPromptTemplate">Content-generation prompt</label>
            <textarea id="contentPromptTemplate" name="contentPromptTemplate" class="prompt-template" required>${escapeHtml(promptSettings.contentPromptTemplate)}</textarea>
            <label for="masterImagePromptTemplate">Master image prompt</label>
            <textarea id="masterImagePromptTemplate" name="masterImagePromptTemplate" class="prompt-template" required>${escapeHtml(promptSettings.masterImagePromptTemplate)}</textarea>
            <label for="referencePromptTemplate">Reference-image instructions</label>
            <textarea id="referencePromptTemplate" name="referencePromptTemplate" class="prompt-template" required>${escapeHtml(promptSettings.referencePromptTemplate)}</textarea>
            <h3>Poster-type prompts</h3>
            ${POSTER_TYPES.map(
              (
                type,
              ) => `<label for="posterTypePrompt_${type}">${escapeHtml(type)}</label>
                <textarea id="posterTypePrompt_${type}" name="posterTypePrompt_${type}" required>${escapeHtml(promptSettings.posterTypePrompts[type])}</textarea>`,
            ).join("")}
            <div class="actions"><button type="submit">Save all prompt templates</button></div>
          </form>
        </section>

        <section class="card wide">
          <h2>Public task context</h2><p class="help">Choose a poster type and manage its visual references. The orchestrator labels these images and sends as many as the selected Gemini image model supports.</p>
          <form method="get" action="/admin/${escapeHtml(brand.businessSlug)}">
            <label for="posterType">Poster type</label><select id="posterType" name="posterType">${typeOptions}</select>
            <label for="date">Debug date</label><input id="date" name="date" type="date" value="${escapeHtml(selectedDate)}">
            <div class="actions"><button type="submit">Load context</button><a class="button secondary" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">Open stable URL</a></div>
          </form>
          <h3>Permanent ${escapeHtml(selectedType)} reference images</h3>
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
              : `<p class="help">No permanent reference images have been saved for this poster type yet.</p>`
          }
          <form id="reference-form" method="post" action="/admin/${escapeHtml(brand.businessSlug)}/type-reference" enctype="multipart/form-data">
            <input type="hidden" name="posterType" value="${escapeHtml(selectedType)}">
            <label for="typeReferenceFiles">Add reference images</label><input id="typeReferenceFiles" name="typeReferenceFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>
            <p class="help">Maximum stored references: 14. Gemini 3.1 Flash Image can use up to 14 total inputs; Gemini 3 Pro Image accepts up to 3 style references; Gemini 2.5 Flash Image is limited to one poster style reference in this workflow.</p>
            <label>Reference notes</label><textarea name="notes">${escapeHtml(typeReference?.notes)}</textarea>
            <div class="actions"><button type="submit">Save reference images</button></div>
          </form>
        </section>

        <section class="card wide">
          <h2>Generation lab</h2>
          <p class="help">Test the exact dashboard flow here: generate the content brief, inspect or edit the prompt, then generate the image and check the latest estimated Gemini cost.</p>
          <div class="lab-grid">
            <div class="stack">
              <form id="lab-form">
                <div class="fields">
                  <div>
                    <label for="labPosterType">Poster type</label>
                    <select id="labPosterType" name="posterType">${typeOptions}</select>
                  </div>
                  <div>
                    <label for="labDate">Date</label>
                    <input id="labDate" name="date" type="date" value="${escapeHtml(selectedDate)}">
                  </div>
                </div>
                <div class="actions">
                  <button type="button" id="generateBrief">Generate content brief</button>
                  <button type="button" id="generateImage" class="secondary">Generate image from current prompt</button>
                </div>
              </form>
              <div id="labMessage" class="message" hidden></div>
              <div>
                <label for="promptEditor">Current prompt</label>
                <textarea id="promptEditor" name="promptEditor">${escapeHtml(currentPrompt)}</textarea>
              </div>
              <div>
                <label for="briefPreview">Current brief JSON</label>
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

        <section class="card wide">
          <h2>Generated image gallery</h2>
          <p class="help">Recent generations for this poster type. You can review the stored image, its status, and add any useful output back into the permanent reference set.</p>
          ${galleryHtml}
        </section>

        <section class="card">
          <h2>Brand system</h2><p class="help">Static business identity and permanent design rules.</p>
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
        </section>

        <section class="card">
          <h2>Daily generation flow</h2>
          <p class="help">The Worker combines the saved content template, selected poster-type template, master image template, reference instructions, and today’s generated JSON. The public context URL contains identity and image assets only.</p>
          <h3>Asset context URL</h3>
          <p class="url">${escapeHtml(publicUrl)}</p>
        </section>
      </div>
    </main>
    <script>
      (function () {
        var capabilities = ${modelCapabilities};
        var model = document.getElementById('imageModel');
        var resolution = document.getElementById('imageResolution');
        var note = document.getElementById('modelCapability');
        var form = document.getElementById('lab-form');
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
            showMessage('Content brief generated. You can edit the prompt before rendering the image.', false);
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
