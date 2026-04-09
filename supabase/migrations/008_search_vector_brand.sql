-- Add brand to the full-text search vector so queries like "Fage yogurt"
-- match foods where brand='Fage' and name='Greek Yogurt'.
ALTER TABLE foods DROP COLUMN IF EXISTS search_vector;

ALTER TABLE foods
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', COALESCE(name, '')) ||
      to_tsvector('simple', COALESCE(name_local, '')) ||
      to_tsvector('simple', COALESCE(brand, ''))
    ) STORED;

-- Recreate the GIN index on the new wider vector
DROP INDEX IF EXISTS idx_foods_search_vector;
CREATE INDEX idx_foods_search_vector ON foods USING gin(search_vector);
