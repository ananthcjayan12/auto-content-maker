CREATE TABLE IF NOT EXISTS content_calendar_entries (
  business_slug TEXT NOT NULL,
  calendar_date TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT,
  cta TEXT,
  poster_mode TEXT NOT NULL DEFAULT 'normal' CHECK (
    poster_mode IN ('normal', 'exact_message', 'inspiration')
  ),
  poster_type TEXT NOT NULL DEFAULT 'general' CHECK (
    poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general', 'reference')
  ),
  inspiration_image_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned', 'poster_ready', 'needs_message', 'skipped')
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (business_slug, calendar_date),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_content_calendar_month
  ON content_calendar_entries (business_slug, calendar_date);
