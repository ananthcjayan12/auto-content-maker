CREATE TABLE IF NOT EXISTS poster_type_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_slug TEXT NOT NULL,
  poster_type TEXT NOT NULL CHECK (
    poster_type IN ('awareness', 'offer', 'festival', 'anniversary', 'review', 'general')
  ),
  production_reference_image_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (business_slug) REFERENCES business_brand_systems(business_slug)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE (business_slug, poster_type)
);

CREATE INDEX IF NOT EXISTS idx_poster_type_references_lookup
  ON poster_type_references (business_slug, poster_type);

INSERT INTO poster_type_references (
  business_slug,
  poster_type,
  production_reference_image_url,
  notes
)
SELECT
  business_slug,
  poster_type,
  production_reference_image_url,
  'Migrated from the latest daily packet reference image.'
FROM (
  SELECT
    business_slug,
    poster_type,
    production_reference_image_url,
    ROW_NUMBER() OVER (
      PARTITION BY business_slug, poster_type
      ORDER BY poster_date DESC, updated_at DESC
    ) AS row_number
  FROM daily_poster_packets
  WHERE production_reference_image_url IS NOT NULL
    AND production_reference_image_url != ''
)
WHERE row_number = 1
ON CONFLICT(business_slug, poster_type) DO UPDATE SET
  production_reference_image_url = excluded.production_reference_image_url,
  notes = excluded.notes,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
