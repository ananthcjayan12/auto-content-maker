CREATE TABLE daily_poster_packets_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_slug TEXT NOT NULL,
  poster_type TEXT NOT NULL CHECK (
    poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general', 'reference')
  ),
  poster_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  headline TEXT NOT NULL,
  subheadline TEXT,
  cta TEXT,
  offer TEXT,
  campaign_goal TEXT,
  target_audience TEXT,
  required_text_json TEXT NOT NULL DEFAULT '[]',
  production_reference_image_url TEXT,
  additional_reference_images_json TEXT NOT NULL DEFAULT '[]',
  special_instructions_json TEXT NOT NULL DEFAULT '[]',
  chatgpt_image_prompt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (business_slug, poster_type, poster_date)
);

INSERT INTO daily_poster_packets_new (
  id,
  business_slug,
  poster_type,
  poster_date,
  status,
  headline,
  subheadline,
  cta,
  offer,
  campaign_goal,
  target_audience,
  required_text_json,
  production_reference_image_url,
  additional_reference_images_json,
  special_instructions_json,
  chatgpt_image_prompt,
  created_at,
  updated_at
)
SELECT
  id,
  business_slug,
  poster_type,
  poster_date,
  status,
  headline,
  subheadline,
  cta,
  offer,
  campaign_goal,
  target_audience,
  required_text_json,
  production_reference_image_url,
  additional_reference_images_json,
  special_instructions_json,
  chatgpt_image_prompt,
  created_at,
  updated_at
FROM daily_poster_packets;

DROP TABLE daily_poster_packets;
ALTER TABLE daily_poster_packets_new RENAME TO daily_poster_packets;

CREATE INDEX idx_daily_poster_lookup
  ON daily_poster_packets (business_slug, poster_type, poster_date);

CREATE TABLE poster_type_references_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_slug TEXT NOT NULL,
  poster_type TEXT NOT NULL CHECK (
    poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general', 'reference')
  ),
  production_reference_image_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reference_image_urls_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (business_slug, poster_type)
);

INSERT INTO poster_type_references_new (
  id,
  business_slug,
  poster_type,
  production_reference_image_url,
  notes,
  created_at,
  updated_at,
  reference_image_urls_json
)
SELECT
  id,
  business_slug,
  poster_type,
  production_reference_image_url,
  notes,
  created_at,
  updated_at,
  reference_image_urls_json
FROM poster_type_references;

DROP TABLE poster_type_references;
ALTER TABLE poster_type_references_new RENAME TO poster_type_references;

CREATE INDEX idx_poster_type_references_lookup
  ON poster_type_references (business_slug, poster_type);

CREATE TABLE generated_posters_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_slug TEXT NOT NULL,
  poster_type TEXT NOT NULL CHECK (
    poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general', 'reference')
  ),
  poster_date TEXT NOT NULL,
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
  UNIQUE (business_slug, poster_type, poster_date)
);

INSERT INTO generated_posters_new (
  id,
  business_slug,
  poster_type,
  poster_date,
  status,
  context_url,
  context_json_url,
  angle,
  brief_json,
  prompt,
  image_url,
  image_content_type,
  r2_key,
  gemini_text_model,
  gemini_image_model,
  gemini_job_name,
  validation_errors_json,
  failure_reason,
  created_at,
  updated_at,
  image_resolution,
  aspect_ratio,
  brief_usage_json,
  image_usage_json,
  cost_breakdown_json
)
SELECT
  id,
  business_slug,
  poster_type,
  poster_date,
  status,
  context_url,
  context_json_url,
  angle,
  brief_json,
  prompt,
  image_url,
  image_content_type,
  r2_key,
  gemini_text_model,
  gemini_image_model,
  gemini_job_name,
  validation_errors_json,
  failure_reason,
  created_at,
  updated_at,
  image_resolution,
  aspect_ratio,
  brief_usage_json,
  image_usage_json,
  cost_breakdown_json
FROM generated_posters;

DROP TABLE generated_posters;
ALTER TABLE generated_posters_new RENAME TO generated_posters;

CREATE INDEX idx_generated_posters_lookup
  ON generated_posters (business_slug, poster_type, poster_date);

CREATE INDEX idx_generated_posters_status
  ON generated_posters (status, updated_at);
