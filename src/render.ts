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

function field(label: string, value: string | null): string {
  return `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${value ? escapeHtml(value) : '<span class="muted">Not specified</span>'}</dd></div>`;
}

type ImageBase64Reference = {
  url: string;
  contentType: string;
  byteLength: number;
  base64: string;
} | null;

function imageBase64Block(label: string, image: ImageBase64Reference): string {
  if (!image) {
    return `<p class="warning" role="alert">Warning: ${escapeHtml(label)} could not be converted to base64. Check that the source image URL is public and reachable.</p>`;
  }
  return `<dl>
    ${field("Source URL", image.url)}
    ${field("Content type", image.contentType)}
    ${field("Byte length", String(image.byteLength))}
  </dl>
  <label class="base64-label">${escapeHtml(label)} base64</label>
  <textarea class="base64" readonly spellcheck="false">${escapeHtml(image.base64)}</textarea>`;
}

export function renderPosterPage(input: {
  brand: BusinessBrandSystem;
  posterType: PosterType;
  typeReference: PosterTypeReference | null;
  publicPageUrl: string;
  jsonUrl: string;
  imageBase64: {
    logo: ImageBase64Reference;
    brandReferenceBoard: ImageBase64Reference;
    posterReferences: ImageBase64Reference[];
    typographyReferences: ImageBase64Reference[];
  };
}): string {
  const {
    brand,
    posterType,
    typeReference,
    publicPageUrl,
    jsonUrl,
    imageBase64,
  } = input;
  const logoUrl = absoluteAssetUrl(brand.logoUrl, publicPageUrl);
  const boardUrl = absoluteAssetUrl(
    brand.brandReferenceBoardUrl,
    publicPageUrl,
  );
  const referenceUrls = (
    typeReference?.referenceImageUrls.length
      ? typeReference.referenceImageUrls
      : typeReference?.productionReferenceImageUrl
        ? [typeReference.productionReferenceImageUrl]
        : []
  ).map((url) => absoluteAssetUrl(url, publicPageUrl));
  const languageProfiles =
    brand.languageTypography?.enabled &&
    brand.languageTypography.profiles?.length
      ? brand.languageTypography.profiles.filter(
          (profile) => profile.enabled !== false,
        )
      : brand.languageTypography?.enabled
        ? [
            {
              language: brand.languageTypography.primaryLanguage,
              role: "primary" as const,
              referenceImageUrl:
                brand.languageTypography.typographyReferenceImageUrl,
              styleProfile: brand.languageTypography.typographyStyleProfile,
              enabled: true,
            },
            ...brand.languageTypography.additionalLanguages.map((language) => ({
              language,
              role: "secondary" as const,
              referenceImageUrl:
                brand.languageTypography?.typographyReferenceImageUrl ?? null,
              styleProfile:
                brand.languageTypography?.typographyStyleProfile ?? null,
              enabled: true,
            })),
          ]
        : [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Poster Design Context — ${escapeHtml(brand.businessName)}</title>
  <style>
    :root { --teal: #087c7b; --ink: #123333; --muted: #5f6f6f; --line: #dce8e7; --soft: #f5fbfa; }
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
    .url { padding: 12px; background: #f7fbfb; border-radius: 10px; overflow-wrap: anywhere; font-size: .9rem; }
    .base64-label { display: block; margin: 18px 0 8px; font-weight: 800; }
    .base64 { width: 100%; min-height: 220px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: #f7fbfb; color: var(--ink); font: .8rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; white-space: pre-wrap; overflow-wrap: anywhere; }
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
      <div class="actions" aria-label="Copy context links">
        <button type="button" data-copy="${escapeHtml(publicPageUrl)}">Copy public page URL</button>
        <button type="button" data-copy="${escapeHtml(jsonUrl)}">Copy JSON URL</button>
        <noscript><a class="button" href="${escapeHtml(jsonUrl)}">Open JSON endpoint</a></noscript>
      </div>
    </header>

    <div class="grid">
      <section class="card" aria-labelledby="business-info">
        <h2 id="business-info">1. Business Info</h2>
        <p class="permanent">Original logo asset encoded as base64 text.</p>
        <p class="url"><a href="${escapeHtml(logoUrl)}">${escapeHtml(logoUrl)}</a></p>
        ${imageBase64Block("Logo image", imageBase64.logo)}
        <h3>Business details</h3>
        <dl>
          ${field("Business name", brand.businessName)}
          ${field("Phone", brand.phone)}
          <div class="field"><dt>Website</dt><dd>${brand.websiteUrl ? `<a href="${escapeHtml(brand.websiteUrl)}">${escapeHtml(brand.websiteUrl)}</a>` : '<span class="muted">Not specified</span>'}</dd></div>
        </dl>
      </section>

      <section class="card" aria-labelledby="brand-board">
        <h2 id="brand-board">2. Brand Reference Board</h2>
        <p class="permanent">Permanent brand reference-board asset encoded as base64 text.</p>
        <p class="url"><a href="${escapeHtml(boardUrl)}">${escapeHtml(boardUrl)}</a></p>
        ${imageBase64Block("Brand reference board image", imageBase64.brandReferenceBoard)}
      </section>

      <section class="card wide" aria-labelledby="poster-reference">
        <h2 id="poster-reference">3. Poster Type Reference Images</h2>
        <p class="permanent">Permanent ${escapeHtml(posterType)} reference assets encoded as base64 text.</p>
        ${
          referenceUrls.length
            ? referenceUrls
                .map(
                  (referenceUrl, index) =>
                    `<h3>Reference ${index + 1}</h3>
                     <p class="url"><a href="${escapeHtml(referenceUrl)}">${escapeHtml(referenceUrl)}</a></p>
                     ${imageBase64Block(`${posterType} poster reference image${referenceUrls.length > 1 ? ` ${index + 1}` : ""}`, imageBase64.posterReferences[index] ?? null)}`,
                )
                .join("")
            : `<p class="warning" role="alert">Warning: No poster-type reference image is saved yet.</p>`
        }
      </section>

      <section class="card wide" aria-labelledby="language-typography">
        <h2 id="language-typography">4. Language & Typography Guidance</h2>
        ${
          brand.languageTypography?.enabled
            ? `<p class="permanent">Use these saved language cards when creating daily poster content and typography.</p>
              <dl>
                ${field("Primary language", brand.languageTypography.primaryLanguage)}
                ${field("Additional languages", brand.languageTypography.additionalLanguages.length ? brand.languageTypography.additionalLanguages.join(", ") : null)}
                ${field("Use typography reference on every poster", brand.languageTypography.useReferenceForAllPosters ? "Yes" : "No")}
              </dl>
              ${
                languageProfiles.length
                  ? languageProfiles
                      .map((profile, index) => {
                        const referenceUrl = profile.referenceImageUrl
                          ? absoluteAssetUrl(
                              profile.referenceImageUrl,
                              publicPageUrl,
                            )
                          : null;
                        return `<h3>${escapeHtml(profile.role === "primary" ? "Primary" : "Extra")} language: ${escapeHtml(profile.language)}</h3>
                          <dl>
                            ${field("Style profile", profile.styleProfile)}
                            <div class="field"><dt>Typography reference</dt><dd>${referenceUrl ? `<a href="${escapeHtml(referenceUrl)}">${escapeHtml(referenceUrl)}</a>` : '<span class="muted">Not specified</span>'}</dd></div>
                          </dl>
                          ${
                            profile.referenceImageUrl
                              ? imageBase64Block(
                                  `${profile.language} typography reference image`,
                                  imageBase64.typographyReferences[index] ??
                                    null,
                                )
                              : ""
                          }`;
                      })
                      .join("")
                  : `<p class="warning" role="alert">Language typography is enabled, but no language cards are saved yet.</p>`
              }`
            : `<p class="muted">No language typography guidance is enabled for this brand.</p>`
        }
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
