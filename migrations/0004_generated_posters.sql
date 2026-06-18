CREATE TABLE IF NOT EXISTS generated_posters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_slug TEXT NOT NULL,
  poster_type TEXT NOT NULL CHECK (
    poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general')
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
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (business_slug, poster_type, poster_date)
);

CREATE INDEX IF NOT EXISTS idx_generated_posters_lookup
  ON generated_posters (business_slug, poster_type, poster_date);

CREATE INDEX IF NOT EXISTS idx_generated_posters_status
  ON generated_posters (status, updated_at);
