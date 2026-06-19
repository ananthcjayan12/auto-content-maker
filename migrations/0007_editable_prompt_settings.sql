CREATE TABLE IF NOT EXISTS poster_prompt_settings (
  business_slug TEXT PRIMARY KEY,
  content_prompt_template TEXT NOT NULL,
  master_image_prompt_template TEXT NOT NULL,
  reference_prompt_template TEXT NOT NULL,
  poster_type_prompts_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug) ON DELETE CASCADE
);
