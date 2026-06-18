import {
  POSTER_TYPES,
  type BusinessBrandSystem,
  type DailyPosterPacket,
  type PosterType,
} from "./types";

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

const styles = `
  :root{--ink:#123333;--teal:#0ea5a4;--soft:#edf8f7;--line:#d8e8e6;--muted:#5f6f6f;--danger:#8f2d20}
  *{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  a{color:#087c7b}.shell{width:min(1180px,calc(100% - 28px));margin:28px auto 64px}.top,.card{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 10px 30px rgba(18,51,51,.05)}
  .top{padding:28px;display:flex;align-items:center;justify-content:space-between;gap:20px}.top h1{margin:0;font-size:clamp(1.8rem,4vw,2.8rem);letter-spacing:-.035em}.eyebrow{margin:0 0 5px;color:#087c7b;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.card{padding:26px}.wide{grid-column:1/-1}h2{margin:0 0 6px;font-size:1.35rem}h3{margin:24px 0 10px}.help{margin:0 0 20px;color:var(--muted)}
  label{display:block;margin:13px 0 5px;font-weight:750}input,select,textarea{width:100%;border:1px solid #bfd5d2;border-radius:10px;padding:10px 12px;background:#fff;color:var(--ink);font:inherit}textarea{min-height:100px;resize:vertical}input[type=color]{height:44px;padding:4px}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.colors{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:22px}
  button,.button{border:0;border-radius:10px;padding:11px 15px;background:var(--ink);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}.secondary{background:#e8f3f2;color:var(--ink)}.danger{background:var(--danger)}
  .message{margin:18px 0 0;padding:12px 15px;border-radius:10px;background:#dcf8ec;color:#126444;font-weight:750}.message.error{background:#fff0ed;color:var(--danger)}.preview{max-width:100%;max-height:220px;object-fit:contain;border:1px solid var(--line);border-radius:12px;background:#f7fbfb;padding:8px}.url{font-size:.85rem;overflow-wrap:anywhere;color:var(--muted)}
  .login{width:min(520px,calc(100% - 28px));margin:12vh auto}.login .card{padding:clamp(24px,6vw,44px)}.login h1{font-size:2.2rem;line-height:1.1;margin:0 0 10px}
  @media(max-width:780px){.grid,.fields{grid-template-columns:1fr}.wide{grid-column:auto}.colors{grid-template-columns:1fr 1fr}.top{align-items:flex-start;flex-direction:column}}
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
      <p class="help">Choose a business and enter the admin token to manage its brand system, assets, and daily poster packet.</p>
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
  packet: DailyPosterPacket | null;
  selectedType: PosterType;
  selectedDate: string;
  publicBaseUrl: string;
  message?: string;
  error?: string;
}): string {
  const {
    brand,
    packet,
    selectedType,
    selectedDate,
    publicBaseUrl,
    message,
    error,
  } = input;
  const publicUrl = `${publicBaseUrl}/daily-poster/${brand.businessSlug}/${selectedType}/${selectedDate}`;
  const typeOptions = POSTER_TYPES.map(
    (type) =>
      `<option value="${type}"${selected(type, selectedType)}>${type}</option>`,
  ).join("");

  return document(
    `Admin — ${brand.businessName}`,
    `<main class="shell">
      <header class="top">
        <div><p class="eyebrow">Poster admin dashboard</p><h1>${escapeHtml(brand.businessName)}</h1></div>
        <div class="actions">
          <a class="button secondary" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">View public packet</a>
          <form method="post" action="/admin/logout"><button class="danger" type="submit">Log out</button></form>
        </div>
      </header>
      ${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}
      ${error ? `<p class="message error" role="alert">${escapeHtml(error)}</p>` : ""}
      <div class="grid">
        <section class="card wide">
          <h2>Packet selection</h2><p class="help">Choose which daily packet to view or edit.</p>
          <form method="get" action="/admin/${escapeHtml(brand.businessSlug)}">
            <div class="fields">
              <div><label for="posterType">Poster type</label><select id="posterType" name="posterType">${typeOptions}</select></div>
              <div><label for="date">Date</label><input id="date" name="date" type="date" value="${escapeHtml(selectedDate)}" required></div>
            </div>
            <div class="actions"><button type="submit">Load packet</button></div>
          </form>
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
        </section>

        <section class="card">
          <h2>Daily poster packet</h2><p class="help">${packet ? "Editing the saved packet." : "No packet exists yet; publishing this form will create it."}</p>
          <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/packet" enctype="multipart/form-data">
            <input type="hidden" name="posterType" value="${escapeHtml(selectedType)}"><input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
            <div class="fields">
              <div><label for="packetStatus">Status</label><select id="packetStatus" name="status"><option value="draft"${selected("draft", packet?.status ?? "draft")}>draft</option><option value="ready"${selected("ready", packet?.status ?? "draft")}>ready</option></select></div>
              <div><label>Date</label><input value="${escapeHtml(selectedDate)}" disabled></div>
            </div>
            <label>Headline</label><input name="headline" value="${escapeHtml(packet?.headline)}" required>
            <label>Subheadline</label><input name="subheadline" value="${escapeHtml(packet?.subheadline)}">
            <label>CTA</label><input name="cta" value="${escapeHtml(packet?.cta)}">
            <label>Offer</label><input name="offer" value="${escapeHtml(packet?.offer)}">
            <label>Campaign goal</label><textarea name="campaignGoal">${escapeHtml(packet?.campaignGoal)}</textarea>
            <label>Target audience</label><textarea name="targetAudience">${escapeHtml(packet?.targetAudience)}</textarea>
            <label>Required text — one item per line</label><textarea name="requiredText">${lines(packet?.requiredText ?? [brand.businessName, brand.phone])}</textarea>
            <h3>Production reference image</h3>
            ${packet?.productionReferenceImageUrl ? `<img class="preview" src="${escapeHtml(packet.productionReferenceImageUrl)}" alt="Current production reference"><p class="url">${escapeHtml(packet.productionReferenceImageUrl)}</p>` : ""}
            <input name="productionReferenceImageUrl" type="hidden" value="${escapeHtml(packet?.productionReferenceImageUrl)}">
            <label for="referenceFile">Upload today’s reference image</label><input id="referenceFile" name="referenceFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
            <label>Additional reference image URLs — one per line</label><textarea name="additionalReferenceImages">${lines(packet?.additionalReferenceImages ?? [])}</textarea>
            <label>Special instructions — one per line</label><textarea name="specialInstructions">${lines(packet?.specialInstructions ?? [])}</textarea>
            <label>Custom ChatGPT image prompt (optional)</label><textarea name="chatgptImagePrompt">${escapeHtml(packet?.chatgptImagePrompt)}</textarea>
            <div class="actions"><button type="submit">Save daily packet</button></div>
          </form>
        </section>
      </div>
    </main>`,
  );
}
