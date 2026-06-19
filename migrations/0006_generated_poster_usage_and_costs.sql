ALTER TABLE generated_posters
  ADD COLUMN brief_usage_json TEXT;

ALTER TABLE generated_posters
  ADD COLUMN image_usage_json TEXT;

ALTER TABLE generated_posters
  ADD COLUMN cost_breakdown_json TEXT;
