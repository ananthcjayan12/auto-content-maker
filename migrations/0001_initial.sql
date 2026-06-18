CREATE TABLE IF NOT EXISTS business_brand_systems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_slug TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  website_url TEXT,
  logo_url TEXT NOT NULL,
  brand_reference_board_url TEXT NOT NULL,
  colors_json TEXT NOT NULL,
  typography_json TEXT NOT NULL,
  visual_style_json TEXT NOT NULL,
  default_poster_rules_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS daily_poster_packets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_slug TEXT NOT NULL,
  poster_type TEXT NOT NULL CHECK (
    poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general')
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

CREATE INDEX IF NOT EXISTS idx_daily_poster_lookup
  ON daily_poster_packets (business_slug, poster_type, poster_date);
