-- Add computed search column combining English and Bulgarian names
ALTER TABLE foods
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', COALESCE(name, '')) ||
      to_tsvector('simple', COALESCE(name_local, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_foods_search_vector ON foods USING gin(search_vector);
