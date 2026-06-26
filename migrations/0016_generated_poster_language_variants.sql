CREATE TABLE generated_posters_language_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_slug TEXT NOT NULL,
  poster_type TEXT NOT NULL CHECK (
    poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general', 'reference')
  ),
  poster_date TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en',
  language_name TEXT NOT NULL DEFAULT 'English',
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'processing', 'ready', 'failed', 'needs_review')
  ),
  context_url TEXT NOT NULL,
  context_json_url TEXT NOT NULL,
  angle TEXT,
  brief_json TEXT,
  prompt TEXT,
  image_url TEXT,
  image_content_type TEXT,
  r2_key TEXT,
  gemini_text_model TEXT,
  gemini_image_model TEXT,
  gemini_job_name TEXT,
  validation_errors_json TEXT NOT NULL DEFAULT '[]',
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  image_resolution TEXT,
  aspect_ratio TEXT,
  brief_usage_json TEXT,
  image_usage_json TEXT,
  cost_breakdown_json TEXT,
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (business_slug, poster_type, poster_date, language_code)
);

INSERT INTO generated_posters_language_variants (
  id, business_slug, poster_type, poster_date, language_code, language_name,
  status, context_url, context_json_url, angle, brief_json, prompt, image_url,
  image_content_type, r2_key, gemini_text_model, gemini_image_model,
  gemini_job_name, validation_errors_json, failure_reason, created_at,
  updated_at, image_resolution, aspect_ratio, brief_usage_json,
  image_usage_json, cost_breakdown_json
)
SELECT
  id, business_slug, poster_type, poster_date, 'en', 'English',
  status, context_url, context_json_url, angle, brief_json, prompt, image_url,
  image_content_type, r2_key, gemini_text_model, gemini_image_model,
  gemini_job_name, validation_errors_json, failure_reason, created_at,
  updated_at, image_resolution, aspect_ratio, brief_usage_json,
  image_usage_json, cost_breakdown_json
FROM generated_posters;

DROP TABLE generated_posters;
ALTER TABLE generated_posters_language_variants RENAME TO generated_posters;

CREATE INDEX IF NOT EXISTS idx_generated_posters_lookup
  ON generated_posters (business_slug, poster_type, poster_date, language_code);

CREATE INDEX IF NOT EXISTS idx_generated_posters_status
  ON generated_posters (status, updated_at);
