import type {
  BusinessBrandSystem,
  PosterType,
  PosterTypeReference,
} from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function absoluteAssetUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, `${baseUrl}/`).toString();
  } catch {
    return url;
  }
}

function list(items: string[], empty = "None specified"): string {
  if (!items.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function field(label: string, value: string | null): string {
  return `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${value ? escapeHtml(value) : '<span class="muted">Not specified</span>'}</dd></div>`;
}

export function buildFinalInstruction(
  brand: BusinessBrandSystem,
  posterType: PosterType,
  typeReference?: PosterTypeReference | null,
): string {
  const referencePhrase = typeReference?.productionReferenceImageUrl
    ? `the permanent ${posterType} poster reference image`
    : "the poster reference image if it is available";

  return `Create one 9:16 Instagram story poster for ${brand.businessName}. Use this public page as the stable brand and design-system context. First check what is special, relevant, or useful today for the selected poster type: ${posterType}. If today has a festival, awareness day, clinic milestone, seasonal context, offer angle, review/social proof idea, or locally relevant topic, use that as the poster theme. Follow the brand colors, typography mood, logo reference, brand reference board, and ${referencePhrase}. Include the clinic name exactly: ${brand.businessName}. Include the phone number exactly: ${brand.phone}. Keep the design modern, clean, premium, readable on mobile, and suitable for a dental clinic. Do not create a crowded flyer or invent a new logo. If the logo, brand board, or reference image cannot be accessed, report the issue instead of generating.`;
}

export function renderPosterPage(input: {
  brand: BusinessBrandSystem;
  posterType: PosterType;
  typeReference: PosterTypeReference | null;
  publicPageUrl: string;
  jsonUrl: string;
}): string {
  const { brand, posterType, typeReference, publicPageUrl, jsonUrl } = input;
  const finalInstruction = buildFinalInstruction(
    brand,
    posterType,
    typeReference,
  );
  const logoUrl = absoluteAssetUrl(brand.logoUrl, publicPageUrl);
  const boardUrl = absoluteAssetUrl(
    brand.brandReferenceBoardUrl,
    publicPageUrl,
  );
  const referenceUrl = typeReference?.productionReferenceImageUrl
    ? absoluteAssetUrl(typeReference.productionReferenceImageUrl, publicPageUrl)
    : null;
  const colors = Object.entries(brand.colors)
    .map(
      ([name, hex]) => `
        <div class="color">
          <span class="swatch" style="background:${escapeHtml(hex)}"></span>
          <span><strong>${escapeHtml(name)}</strong><code>${escapeHtml(hex)}</code></span>
        </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Poster Design Context — ${escapeHtml(brand.businessName)}</title>
  <style>
    :root { --teal: ${escapeHtml(brand.colors.primary)}; --ink: ${escapeHtml(brand.colors.darkText)}; --muted: ${escapeHtml(brand.colors.mutedText)}; --cream: ${escapeHtml(brand.colors.secondary)}; --line: #dce8e7; --soft: #f5fbfa; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: #edf7f6; font: 16px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color: #087c7b; overflow-wrap: anywhere; }
    code { display: block; font: 0.85rem ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); }
    .shell { width: min(1120px, calc(100% - 32px)); margin: 32px auto 72px; }
    .hero, .card { background: white; border: 1px solid var(--line); border-radius: 20px; box-shadow: 0 10px 30px rgba(18, 51, 51, .05); }
    .hero { padding: clamp(24px, 5vw, 52px); background: linear-gradient(145deg, white 55%, var(--soft)); border-top: 6px solid var(--teal); }
    .eyebrow { margin: 0 0 8px; color: #087c7b; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; font-size: .78rem; }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.6rem); line-height: 1.05; letter-spacing: -.04em; }
    h2 { margin: 0 0 20px; font-size: 1.35rem; }
    h3 { margin: 24px 0 8px; font-size: 1rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    .pill { padding: 7px 12px; background: var(--soft); border: 1px solid var(--line); border-radius: 999px; font-size: .9rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    button, .button { appearance: none; border: 0; border-radius: 10px; padding: 10px 14px; background: var(--ink); color: white; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; }
    button:hover, .button:hover { background: #087c7b; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 18px; }
    .card { padding: clamp(20px, 4vw, 32px); }
    .wide { grid-column: 1 / -1; }
    .media { width: 100%; max-height: 640px; object-fit: contain; display: block; padding: 12px; background: #f7fbfb; border: 1px solid var(--line); border-radius: 14px; }
    .logo { max-height: 220px; }
    .url { padding: 12px; background: #f7fbfb; border-radius: 10px; overflow-wrap: anywhere; font-size: .9rem; }
    .instruction { margin: 12px 0 0; padding: 18px; background: #113b3b; color: white; border-radius: 14px; font: 700 1.03rem/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
    .permanent { padding: 10px 14px; border-left: 4px solid var(--teal); background: var(--soft); font-weight: 750; }
    .warning { padding: 14px; border: 1px solid #f2c164; border-radius: 12px; background: #fff8e7; color: #754b00; font-weight: 700; }
    .palette { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 12px; }
    .color { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; }
    .swatch { width: 46px; height: 46px; flex: 0 0 auto; border-radius: 10px; border: 1px solid rgba(0,0,0,.12); }
    dl { margin: 0; }
    .field { display: grid; grid-template-columns: minmax(120px, .45fr) 1fr; gap: 18px; padding: 9px 0; border-bottom: 1px solid #edf2f2; }
    dt { font-weight: 800; }
    dd { margin: 0; }
    li + li { margin-top: 6px; }
    .muted { color: var(--muted); }
    footer { margin-top: 24px; text-align: center; color: var(--muted); font-size: .9rem; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } .field { grid-template-columns: 1fr; gap: 2px; } .shell { width: min(100% - 20px, 1120px); margin-top: 10px; } }
    @media print { body { background: white; } .shell { width: 100%; margin: 0; } .hero, .card { box-shadow: none; break-inside: avoid; } .actions { display: none; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">Poster Design Context</p>
      <h1>${escapeHtml(brand.businessName)}</h1>
      <div class="meta">
        <span class="pill">Poster type: <strong>${escapeHtml(posterType)}</strong></span>
        <span class="pill">Stable daily task URL</span>
      </div>
      <div class="actions" aria-label="Copy context links and prompt">
        <button type="button" data-copy="${escapeHtml(publicPageUrl)}">Copy public page URL</button>
        <button type="button" data-copy="${escapeHtml(jsonUrl)}">Copy JSON URL</button>
        <button type="button" data-copy="${escapeHtml(finalInstruction)}">Copy final ChatGPT task prompt</button>
        <noscript><a class="button" href="${escapeHtml(jsonUrl)}">Open JSON endpoint</a></noscript>
      </div>
    </header>

    <div class="grid">
      <section class="card" aria-labelledby="business-info">
        <h2 id="business-info">1. Business Info</h2>
        <img class="media logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brand.businessName)} logo reference">
        <h3>Direct logo URL</h3>
        <p class="url"><a href="${escapeHtml(logoUrl)}">${escapeHtml(logoUrl)}</a></p>
        <dl>
          ${field("Business name", brand.businessName)}
          ${field("Phone", brand.phone)}
          <div class="field"><dt>Website</dt><dd>${brand.websiteUrl ? `<a href="${escapeHtml(brand.websiteUrl)}">${escapeHtml(brand.websiteUrl)}</a>` : '<span class="muted">Not specified</span>'}</dd></div>
        </dl>
      </section>

      <section class="card" aria-labelledby="brand-board">
        <h2 id="brand-board">2. Brand Reference Board</h2>
        <p class="permanent">Use this as the permanent brand style reference.</p>
        <img class="media" src="${escapeHtml(boardUrl)}" alt="${escapeHtml(brand.businessName)} permanent brand reference board">
        <h3>Direct brand reference board URL</h3>
        <p class="url"><a href="${escapeHtml(boardUrl)}">${escapeHtml(boardUrl)}</a></p>
      </section>

      <section class="card wide" aria-labelledby="brand-system">
        <h2 id="brand-system">3. Brand System</h2>
        <h3>Color palette</h3>
        <div class="palette">${colors}</div>
        <h3>Typography</h3>
        <dl>
          ${field("Heading style", brand.typography.headingStyle)}
          ${field("Body style", brand.typography.bodyStyle)}
          ${field("Font mood", brand.typography.fontMood)}
        </dl>
        <h3>Visual style instructions</h3>
        <dl>
          ${field("Mood", brand.visualStyle.mood)}
          ${field("Layout", brand.visualStyle.layout)}
          ${field("Photo style", brand.visualStyle.photoStyle)}
        </dl>
        <h3>Do — default poster rules</h3>
        ${list(brand.defaultPosterRules)}
        <h3>Don’t — avoid</h3>
        ${list(brand.visualStyle.avoid)}
      </section>

      <section class="card wide" aria-labelledby="poster-reference">
        <h2 id="poster-reference">4. Poster Type Reference Image</h2>
        <p class="permanent">Use this as the stable visual reference for ${escapeHtml(posterType)} posters. It does not need to change daily.</p>
        ${
          referenceUrl
            ? `<img class="media" src="${escapeHtml(referenceUrl)}" alt="Permanent ${escapeHtml(posterType)} poster reference image">
               <h3>Direct poster reference image URL</h3>
               <p class="url"><a href="${escapeHtml(referenceUrl)}">${escapeHtml(referenceUrl)}</a></p>
               ${typeReference?.notes ? `<h3>Reference notes</h3><p>${escapeHtml(typeReference.notes)}</p>` : ""}`
            : `<p class="warning" role="alert">Warning: No poster-type reference image is saved yet. ChatGPT can still use the logo and brand board, but the visual reference section is missing.</p>`
        }
      </section>

      <section class="card wide" aria-labelledby="final-instruction">
        <h2 id="final-instruction">5. Final ChatGPT Task Instruction</h2>
        <p>Use this instruction after reading and inspecting every section and image on this page.</p>
        <pre class="instruction">${escapeHtml(finalInstruction)}</pre>
      </section>
    </div>
    <footer>Public read-only brand context page · No sensitive information should be stored here.</footer>
  </main>
  <script>
    document.querySelectorAll('[data-copy]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var original = button.textContent;
        try {
          await navigator.clipboard.writeText(button.getAttribute('data-copy'));
          button.textContent = 'Copied';
        } catch (_) {
          button.textContent = 'Copy failed';
        }
        setTimeout(function () { button.textContent = original; }, 1600);
      });
    });
  </script>
</body>
</html>`;
}

export function renderErrorPage(
  status: number,
  title: string,
  message: string,
): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title>
<style>body{margin:0;background:#edf7f6;color:#123333;font:16px/1.6 system-ui,sans-serif}.box{width:min(680px,calc(100% - 32px));margin:12vh auto;background:white;border:1px solid #dce8e7;border-radius:18px;padding:32px}h1{margin-top:0}code{background:#eef7f6;padding:2px 5px;border-radius:5px}</style></head>
<body><main class="box"><p>${status}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`;
}
