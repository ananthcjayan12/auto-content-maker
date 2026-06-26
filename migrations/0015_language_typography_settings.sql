ALTER TABLE business_brand_systems
ADD COLUMN language_typography_json TEXT NOT NULL DEFAULT '{"enabled":false,"primaryLanguage":"English","additionalLanguages":[],"typographyReferenceImageUrl":null,"typographyStyleProfile":null,"useReferenceForAllPosters":false}';
