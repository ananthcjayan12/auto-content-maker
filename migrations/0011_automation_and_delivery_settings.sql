CREATE TABLE IF NOT EXISTS poster_automation_settings (
  business_slug TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  local_time TEXT NOT NULL DEFAULT '08:30',
  poster_types_json TEXT NOT NULL DEFAULT '["awareness"]',
  force_generation INTEGER NOT NULL DEFAULT 0,
  email_enabled INTEGER NOT NULL DEFAULT 0,
  recipient_emails_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poster_automation_runs (
  business_slug TEXT NOT NULL,
  poster_type TEXT NOT NULL,
  poster_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  image_url TEXT,
  provider_message_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (business_slug, poster_type, poster_date),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug) ON DELETE CASCADE
);
