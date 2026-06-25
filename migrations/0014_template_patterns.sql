CREATE TABLE IF NOT EXISTS poster_template_patterns (
  business_slug TEXT NOT NULL,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  best_for TEXT NOT NULL,
  poster_type TEXT CHECK (
    poster_type IS NULL OR poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general', 'reference')
  ),
  layout_prompt TEXT NOT NULL,
  style_prompt TEXT NOT NULL,
  preview_image_url TEXT,
  reference_image_urls_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (business_slug, template_id),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug)
    ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE content_calendar_entries
  ADD COLUMN template_id TEXT;

CREATE INDEX idx_poster_template_patterns_business
  ON poster_template_patterns (business_slug, is_active, poster_type);
