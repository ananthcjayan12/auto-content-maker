CREATE TABLE IF NOT EXISTS poster_content_source_settings (
  business_slug TEXT PRIMARY KEY,
  awareness_mode TEXT NOT NULL DEFAULT 'sheet_first'
    CHECK (awareness_mode IN ('sheet_first', 'ai_only')),
  google_sheet_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug) ON DELETE CASCADE
);
