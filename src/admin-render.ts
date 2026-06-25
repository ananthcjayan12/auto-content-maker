import {
  POSTER_TYPES,
  type AutomationSettings,
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

function checked(value: boolean): string {
  return value ? " checked" : "";
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
  .workspace{position:sticky;z-index:20;top:10px;margin-top:16px;padding:18px 20px}.workspace-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:12px}.workspace h2{font-size:1rem;margin:0}.workspace .help{margin:2px 0 0}.type-tabs{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}.type-tab{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#f8fbfa;color:var(--ink);font-weight:760;text-decoration:none;text-transform:capitalize}.type-tab:hover{border-color:#9bc9c6;background:#f0f8f7}.type-tab.active{background:var(--ink);border-color:var(--ink);color:#fff}.type-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#e5f2f0;color:var(--teal-strong);font-size:.72rem}.type-tab.active .type-count{background:rgba(255,255,255,.16);color:#fff}
  .section-nav{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0}.section-nav a{padding:7px 11px;border-radius:999px;background:#eaf3f2;color:var(--ink);font-size:.82rem;font-weight:750;text-decoration:none}
  .grid{display:grid;grid-template-columns:1.35fr .65fr;gap:18px;margin-top:18px}.card{padding:26px;scroll-margin-top:170px}.wide{grid-column:1/-1}.create-panel{order:1}.reference-panel{order:2}.content-panel{order:3}.gallery-panel{order:4}.automation-panel{order:5}.brand-panel{order:6}.advanced-panel{order:7}.help-panel{order:8}h2{margin:0 0 6px;font-size:1.35rem;letter-spacing:-.015em}h3{margin:24px 0 10px}.help{margin:0 0 18px;color:var(--muted)}
  .section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.section-kicker{font-size:.72rem;color:var(--teal);font-weight:850;text-transform:uppercase;letter-spacing:.1em}.current-type{display:inline-flex;padding:7px 11px;border-radius:999px;background:#e7f3f1;color:var(--teal-strong);font-weight:800;text-transform:capitalize;white-space:nowrap}
  label{display:block;margin:14px 0 6px;font-weight:760}input,select,textarea{width:100%;border:1px solid #bfd3d1;border-radius:11px;padding:11px 12px;background:#fff;color:var(--ink);font:inherit;transition:border-color .15s,box-shadow .15s}input:focus,select:focus,textarea:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px rgba(8,127,125,.12)}textarea{min-height:105px;resize:vertical}.prompt-template{min-height:240px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}input[type=color]{height:44px;padding:4px}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.colors{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:20px}
  .check-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.check-card{display:flex;align-items:flex-start;gap:9px;margin:0;padding:12px;border:1px solid var(--line);border-radius:11px;background:#f8fbfa}.check-card input{width:auto;margin:4px 0 0}.check-card strong{display:block}.check-card.disabled{opacity:.55}.provider-ok{background:#dcf8ec;color:#126444}.provider-missing{background:#fff0ed;color:#8f2d20}
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
  const loginForm = `<form method="post" action="/admin/login">
        <label for="businessSlug" style="margin-top: 0;">Workspace slug</label>
        <input id="businessSlug" name="businessSlug" placeholder="your-business-name" autocomplete="organization" required>
        <label for="token">Admin token</label>
        <input id="token" name="token" type="password" autocomplete="current-password" required>
        <div class="actions"><button type="submit" style="width: 100%; justify-content: center; padding: 14px; font-size: 1.1rem;">Open dashboard</button></div>
      </form>`;

  const pageContent = `
<style>
  .landing-wrapper { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; background: #fff; }
  .landing-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 5%; background: var(--surface); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 100; box-shadow: var(--shadow); }
  .landing-nav .brand { font-size: 1.5rem; font-weight: 800; color: var(--ink); text-decoration: none; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em; }
  .landing-nav .brand-icon { width: 34px; height: 34px; background: var(--teal); color: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
  .nav-links { display: flex; gap: 32px; align-items: center; }
  .nav-links a { font-weight: 600; color: var(--muted); text-decoration: none; font-size: 0.95rem; transition: color 0.2s; }
  .nav-links a:hover { color: var(--teal); }
  
  .landing-hero { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 64px; padding: 100px 5% 120px; background: linear-gradient(180deg, var(--soft) 0%, #fff 100%); align-items: center; }
  .hero-content h1 { font-size: clamp(3rem, 5vw, 4.2rem); line-height: 1.1; margin: 0 0 24px; font-weight: 800; letter-spacing: -0.035em; color: var(--ink); }
  .hero-content p { font-size: clamp(1.1rem, 2vw, 1.35rem); color: var(--muted); margin: 0 0 40px; max-width: 600px; line-height: 1.6; }
  .hero-features { display: flex; gap: 24px; margin-bottom: 40px; flex-wrap: wrap; }
  .hero-feature { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--teal-strong); }
  .hero-feature svg { width: 24px; height: 24px; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  
  .hero-form-card { background: var(--surface); padding: 40px; border-radius: 24px; box-shadow: 0 20px 40px rgba(16,47,48,0.1); border: 1px solid var(--line); position: relative; }
  .hero-form-card::before { content: ''; position: absolute; top: -8px; left: -8px; right: -8px; bottom: -8px; border-radius: 32px; background: linear-gradient(135deg, var(--teal) 0%, transparent 40%); z-index: -1; opacity: 0.15; }
  .auth-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
  .auth-actions .button { display: flex; justify-content: center; align-items: center; padding: 13px 16px; border-radius: 12px; }
  
  .landing-section { padding: 120px 5%; max-width: 1240px; margin: 0 auto; }
  .landing-section.bg-dark { background: var(--ink); color: #fff; max-width: 100%; }
  .section-title { text-align: center; font-size: clamp(2.2rem, 4vw, 3rem); font-weight: 800; margin-bottom: 24px; letter-spacing: -0.03em; color: var(--ink); }
  .section-subtitle { text-align: center; font-size: 1.2rem; color: var(--muted); max-width: 640px; margin: 0 auto 64px; line-height: 1.6; }
  .landing-section.bg-dark .section-title { color: #fff; }
  .landing-section.bg-dark .section-subtitle { color: #9bc9c6; }
  
  .flow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; }
  .flow-step { text-align: center; padding: 40px 32px; background: #fff; border-radius: 24px; box-shadow: var(--shadow); border: 1px solid var(--line); transition: transform 0.3s; }
  .flow-step:hover { transform: translateY(-8px); border-color: #bfd3d1; }
  .step-number { width: 56px; height: 56px; background: var(--teal); color: #fff; font-size: 1.8rem; font-weight: 800; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 8px 16px rgba(8,127,125,0.2); }
  .flow-step h3 { font-size: 1.5rem; margin: 0 0 16px; color: var(--ink); letter-spacing: -0.01em; }
  .flow-step p { color: var(--muted); margin: 0; line-height: 1.6; font-size: 1.05rem; }
  
  .examples-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 32px; }
  .example-card { border-radius: 20px; overflow: hidden; box-shadow: var(--shadow); background: #f8fbfa; padding: 16px; border: 1px solid var(--line); transition: transform 0.3s; }
  .example-card:hover { transform: scale(1.03); }
  .example-card img { width: 100%; height: auto; border-radius: 12px; aspect-ratio: 9/16; object-fit: contain; background: #fff; border: 1px solid #e5e7eb; }
  .example-caption { padding: 16px 8px 4px; font-weight: 800; text-align: center; font-size: 1.1rem; color: var(--ink); }

  .success-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 32px; }
  .success-card { background: rgba(255,255,255,0.03); padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); }
  .success-card p { font-size: 1.15rem; line-height: 1.7; font-style: italic; margin-bottom: 32px; color: #e5f2f0; }
  .success-author { display: flex; align-items: center; gap: 16px; }
  .author-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--teal); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.4rem; color: #fff; }
  .author-info h4 { margin: 0 0 4px; color: #fff; font-size: 1.1rem; }
  .author-info span { color: #9bc9c6; font-size: 0.95rem; }
  
  .cta-section { text-align: center; padding: 120px 5%; background: linear-gradient(135deg, var(--teal-strong) 0%, var(--teal) 100%); color: #fff; }
  .cta-section h2 { font-size: clamp(2.5rem, 4vw, 3.5rem); font-weight: 800; margin: 0 0 24px; letter-spacing: -0.03em; }
  .cta-section p { font-size: 1.25rem; margin: 0 auto 40px; max-width: 600px; color: #e5f2f0; line-height: 1.6; }
  .cta-section .button { background: #fff; color: var(--teal-strong); font-size: 1.2rem; padding: 18px 48px; border-radius: 999px; font-weight: 800; display: inline-block; transition: all 0.2s; }
  .cta-section .button:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.2); }

  .landing-footer { text-align: center; padding: 40px 5%; background: var(--ink); color: #9bc9c6; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.95rem; }

  @media(max-width: 900px) {
    .landing-hero { grid-template-columns: 1fr; text-align: center; padding: 40px 5% 80px; gap: 48px; }
    .hero-content p { margin: 0 auto 32px; }
    .hero-features { justify-content: center; }
    .nav-links { display: none; }
  }
</style>
<div class="landing-wrapper">
  <nav class="landing-nav">
    <a href="#" class="brand"><div class="brand-icon">A</div> Auto Content Maker</a>
    <div class="nav-links">
      <a href="#how-it-works">How it Works</a>
      <a href="#examples">Examples</a>
      <a href="#success">Success Stories</a>
      <a href="/onboarding/new" class="button secondary" style="padding: 10px 24px; border-radius: 999px;">Sign up</a>
      <a href="#login" class="button" style="padding: 10px 24px; border-radius: 999px;">Login</a>
    </div>
  </nav>

  <header class="landing-hero">
    <div class="hero-content">
      <h1>Your Social Media,<br><span style="color: var(--teal);">Automated.</span></h1>
      <p>Set up your brand once. Let AI generate, schedule, and deliver high-converting social media posters tailored to your business, every single day.</p>
      <div class="hero-features">
        <div class="hero-feature"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> AI-Powered Design</div>
        <div class="hero-feature"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> Daily Automation</div>
        <div class="hero-feature"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> On-Brand Content</div>
      </div>
    </div>
    <div class="hero-form-card" id="login">
      <h2 style="margin-top: 0; font-size: 1.8rem; letter-spacing: -0.02em;">Get started</h2>
      <p class="help" style="margin-bottom: 24px;">Create a new customer workspace or log in to an existing one.</p>
      ${error ? `<p class="message error" role="alert" style="margin-bottom: 20px;">${escapeHtml(error)}</p>` : ""}
      <div class="auth-actions">
        <a class="button" href="/onboarding/new">Sign up</a>
        <a class="button secondary" href="#login-form">Login</a>
      </div>
      <div id="login-form">
        <h3 style="margin: 0 0 12px; font-size: 1rem;">Existing customer login</h3>
      ${loginForm}
      </div>
    </div>
  </header>

  <section class="landing-section" id="how-it-works">
    <h2 class="section-title">A set-and-forget content engine</h2>
    <p class="section-subtitle">We combined advanced Gemini Vision AI with professional marketing templates to create a completely hands-off social media pipeline.</p>
    
    <div class="flow-grid">
      <div class="flow-step">
        <div class="step-number">1</div>
        <h3>Define Your Brand</h3>
        <p>Upload your logo, pick your colors, and tell us your tone. The system locks in your identity so every poster looks like you.</p>
      </div>
      <div class="flow-step">
        <div class="step-number">2</div>
        <h3>Train Your Models</h3>
        <p>Provide a few reference posters. Our vision model learns your preferred layouts, typography, and spacing in seconds.</p>
      </div>
      <div class="flow-step">
        <div class="step-number">3</div>
        <h3>Autopilot Engaged</h3>
        <p>Every day at your chosen time, the AI writes the copy, designs the poster, and delivers it straight to your inbox.</p>
      </div>
    </div>
  </section>

  <section class="landing-section" id="examples" style="background: #f4f8f7; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); max-width: 100%;">
    <div style="max-width: 1240px; margin: 0 auto;">
      <h2 class="section-title">Pixel-perfect posters</h2>
      <p class="section-subtitle">No more generic AI blobs. We enforce strict typography layers over stunning, context-aware imagery.</p>
      
      <div class="examples-grid">
        <div class="example-card">
          <img src="/onboarding-assets/placeholder-board.svg" alt="Promotional Poster">
          <div class="example-caption">Offer & Promotion</div>
        </div>
        <div class="example-card">
          <img src="/onboarding-assets/placeholder-board.svg" alt="Awareness Poster">
          <div class="example-caption">Educational Awareness</div>
        </div>
        <div class="example-card">
          <img src="/onboarding-assets/placeholder-board.svg" alt="Festival Poster">
          <div class="example-caption">Festival Greeting</div>
        </div>
        <div class="example-card">
          <img src="/onboarding-assets/placeholder-board.svg" alt="Review Poster">
          <div class="example-caption">Customer Review</div>
        </div>
      </div>
    </div>
  </section>

  <section class="landing-section bg-dark" id="success">
    <div style="max-width: 1240px; margin: 0 auto;">
      <h2 class="section-title">Trusted by growing businesses</h2>
      <p class="section-subtitle">See how local businesses are scaling their digital presence without hiring expensive agencies.</p>
      
      <div class="success-grid">
        <div class="success-card">
          <p>"Before this, I spent hours every weekend trying to design clinic updates on Canva. Now, I wake up to a perfect, branded poster in my email every morning. It's magic."</p>
          <div class="success-author">
            <div class="author-avatar">P</div>
            <div class="author-info">
              <h4>Dr. Pooja</h4>
              <span>Smile Craft Dental</span>
            </div>
          </div>
        </div>
        <div class="success-card">
          <p>"Our social media presence looks like we have a full-time designer on staff. The festival greetings are always on time, and our promotional offers look incredible."</p>
          <div class="success-author">
            <div class="author-avatar">R</div>
            <div class="author-info">
              <h4>Rahul Sharma</h4>
              <span>Fitness First Gym</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="cta-section">
    <h2>Ready to automate your content?</h2>
    <p>Get in touch with your agency administrator to onboard your business and get your first automated poster delivered today.</p>
    <a href="/onboarding/new" class="button">Create New Customer Workspace</a>
  </section>

  <footer class="landing-footer">
    <p>&copy; ${new Date().getFullYear()} Auto Content Maker. Built for B2B scale.</p>
  </footer>
</div>
`;

  return document(
    "Auto Content Maker — Your Daily Social Media Automated",
    pageContent,
  );
}

export function renderDashboard(input: {
  brand: BusinessBrandSystem;
  typeReference: PosterTypeReference | null;
  allTypeReferences: Record<PosterType, PosterTypeReference | null>;
  generationSettings: GenerationSettings;
  promptSettings: PosterPromptSettings;
  contentSourceSettings: ContentSourceSettings;
  automationSettings: AutomationSettings;
  emailProviderConfigured: boolean;
  automationTimezone: string;
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
    automationSettings,
    emailProviderConfigured,
    automationTimezone,
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
    reference: "Reference remake",
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
      "Upload a customer screenshot to use it intact as the visible testimonial. Pasted text remains available as a fallback.",
    general:
      "Create a clinic update, reminder, service message, or relevant general greeting.",
    reference:
      "Upload a source poster first. Its layout and typography lead the remake; your saved logo, identity, and brand colors replace the source branding.",
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
          <a href="#create">Create poster</a><a href="#references">References</a><a href="#gallery">Gallery</a><a href="#automation">Automation</a><a href="#brand">Brand</a><a href="#advanced">Advanced settings</a>
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

        <section class="card wide automation-panel" id="automation">
          <div class="section-heading"><div><p class="section-kicker">Automation</p><h2>Schedule and email delivery</h2><p class="help">The Worker checks every five minutes and runs each selected type once per day, at or after the clinic's local time.</p></div><span class="pill ${emailProviderConfigured ? "provider-ok" : "provider-missing"}">${emailProviderConfigured ? "Resend configured" : "Resend setup required"}</span></div>
          <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/automation-settings">
            <label class="check-card"><input type="checkbox" name="enabled"${checked(automationSettings.enabled)}><span><strong>Enable daily automation</strong><span class="mini">Turn off to pause scheduled generation without redeploying.</span></span></label>
            <div class="fields">
              <div><label for="localTime">Clinic delivery schedule</label><input id="localTime" name="localTime" type="time" step="300" value="${escapeHtml(automationSettings.localTime)}" required><p class="mini">Timezone: ${escapeHtml(automationTimezone)}. If this time has already passed today, enabling the schedule can run it on the next heartbeat.</p></div>
              <div><label>Poster types to generate</label><div class="check-grid">
                ${POSTER_TYPES.map((type) => {
                  const disabled = type === "review" || type === "reference";
                  const disabledReason =
                    type === "review"
                      ? "Requires a screenshot or message"
                      : "Requires a source poster";
                  return `<label class="check-card${disabled ? " disabled" : ""}"><input type="checkbox" name="posterTypes" value="${type}"${checked(automationSettings.posterTypes.includes(type))}${disabled ? " disabled" : ""}><span><strong>${escapeHtml(typeLabels[type])}</strong><span class="mini">${disabled ? disabledReason : "Generate daily"}</span></span></label>`;
                }).join("")}
              </div></div>
            </div>
            <label class="check-card"><input type="checkbox" name="forceGeneration"${checked(automationSettings.forceGeneration)}><span><strong>Force regeneration at the scheduled run</strong><span class="mini">Replaces an existing ready poster for that date. This runs only once per selected type/day, but creates additional Gemini cost.</span></span></label>
            <h3>Email delivery</h3>
            <label class="check-card"><input type="checkbox" name="emailEnabled"${checked(automationSettings.emailEnabled)}><span><strong>Email ready posters automatically</strong><span class="mini">Only posters with status ready are sent. Failed or needs-review outputs are not delivered.</span></span></label>
            <label for="recipientEmails">Clinic recipient email addresses</label>
            <textarea id="recipientEmails" name="recipientEmails" placeholder="owner@example.com, manager@example.com">${escapeHtml(automationSettings.recipientEmails.join("\n"))}</textarea>
            <p class="callout">Sender: ${emailProviderConfigured ? "configured securely in the Worker" : "add RESEND_API_KEY and POSTER_FROM_EMAIL before enabling email"}. API keys are never editable in this dashboard.</p>
            <div class="actions"><button type="submit">Save automation settings</button></div>
          </form>
          <form method="post" action="/admin/${escapeHtml(brand.businessSlug)}/automation-test-email">
            <input type="hidden" name="posterType" value="${escapeHtml(selectedType)}">
            <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
            <div class="actions"><button type="submit" class="secondary"${generatedPoster?.status === "ready" && emailProviderConfigured && automationSettings.recipientEmails.length ? "" : " disabled"}>Send current ${escapeHtml(typeLabels[selectedType])} poster as test email</button></div>
            <p class="mini">Uses the currently selected type and date. Generate a ready poster and save recipients first.</p>
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
          <div class="section-heading"><div><p class="section-kicker">Visual direction</p><h2>${escapeHtml(typeLabels[selectedType])} reference library</h2><p class="help">${selectedType === "reference" ? "Upload the competitor or inspiration poster to remake. It controls layout, fonts, hierarchy, spacing, and visual treatment; the saved brand contributes the logo, identity, and colors." : `These images guide layout, typography, spacing, and visual style only for ${escapeHtml(typeLabels[selectedType].toLowerCase())} posters.`}</p></div><span class="current-type">${referenceImages.length} of 14 saved</span></div>
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
            <label for="typeReferenceFiles">${selectedType === "reference" ? "Upload source poster" : `Add ${escapeHtml(typeLabels[selectedType].toLowerCase())} reference images`}</label><input id="typeReferenceFiles" name="typeReferenceFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>
            <p class="help">Maximum stored references: 14. Gemini 3.1 Flash Image can use up to 14 total inputs; Gemini 3 Pro Image accepts up to 3 style references; Gemini 2.5 Flash Image is limited to one poster style reference in this workflow.</p>
            <label>${selectedType === "reference" ? "Persistent source-poster guidance" : "Reference notes"}</label><textarea name="notes"${selectedType === "reference" ? ' placeholder="Optional reusable guidance about what to preserve or avoid when using this source poster."' : ""}>${escapeHtml(typeReference?.notes)}</textarea>
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
                  <p class="help">For review posters, provide either a screenshot or the review text. An uploaded screenshot is placed intact as the testimonial; its contents are not extracted or rewritten. If both are supplied, the screenshot takes priority.</p>
                </div>
                <div id="referenceMessageField" hidden>
                  <label for="referenceMessage">What should this poster be about?</label>
                  <input id="referenceMessage" name="referenceMessage" type="text" maxlength="500" placeholder="Example: Promote painless root canal treatment and ask patients to book a consultation">
                  <p class="help">Optional. If provided, this message becomes the content source and AI only turns it into concise poster copy. If left blank, AI adapts the main idea from the uploaded source poster to this dental clinic without copying competitor details.</p>
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
          document.querySelector('.automation-panel'),
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
        var referenceMessageField = document.getElementById('referenceMessageField');
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
        function syncTypeFields() {
          reviewScreenshotField.hidden = labPosterType.value !== 'review';
          referenceMessageField.hidden = labPosterType.value !== 'reference';
        }
        labPosterType.addEventListener('change', syncTypeFields);
        syncTypeFields();

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
            var source = body.contentSource === 'google_sheet'
              ? 'Google Sheet content found and edited.'
              : body.contentSource === 'user_message'
                ? 'Your message was turned into poster copy.'
                : body.contentSource === 'reference_poster'
                  ? 'Content was adapted from the source poster.'
                  : 'AI content generated.';
            var detail = body.contentSourceWarning ? ' ' + body.contentSourceWarning : '';
            showMessage(source + detail + ' You can edit the prompt before rendering the image.', Boolean(body.contentSourceWarning));
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
