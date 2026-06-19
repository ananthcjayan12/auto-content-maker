ALTER TABLE poster_type_references
  ADD COLUMN reference_image_urls_json TEXT NOT NULL DEFAULT '[]';

UPDATE poster_type_references
SET reference_image_urls_json =
  CASE
    WHEN production_reference_image_url IS NULL
      OR production_reference_image_url = ''
      THEN '[]'
    ELSE json_array(production_reference_image_url)
  END;

CREATE TABLE IF NOT EXISTS poster_generation_settings (
  business_slug TEXT PRIMARY KEY,
  text_model TEXT NOT NULL DEFAULT 'gemini-3.5-flash',
  image_model TEXT NOT NULL DEFAULT 'gemini-3.1-flash-image',
  image_resolution TEXT NOT NULL DEFAULT '1K',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug)
    ON UPDATE CASCADE ON DELETE CASCADE
);

INSERT INTO poster_generation_settings (business_slug)
SELECT business_slug
FROM business_brand_systems
WHERE true
ON CONFLICT(business_slug) DO NOTHING;

ALTER TABLE generated_posters
  ADD COLUMN image_resolution TEXT;

ALTER TABLE generated_posters
  ADD COLUMN aspect_ratio TEXT;
