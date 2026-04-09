-- 007_flexible_meals.sql
-- Rename meal_index to sort_order. The column stays SMALLINT; now represents
-- ordering position within a day (1, 2, 3, …) rather than a fixed 1-or-2 slot.
ALTER TABLE meals RENAME COLUMN meal_index TO sort_order;

-- Track API-sourced foods to avoid duplicate fetches and support future deduplication.
ALTER TABLE foods
  ADD COLUMN source      TEXT    DEFAULT NULL,
  ADD COLUMN external_id TEXT    DEFAULT NULL;

-- One cached entry per external food per user (ON CONFLICT used in upsert).
CREATE UNIQUE INDEX idx_foods_user_external_id
  ON foods(user_id, external_id)
  WHERE external_id IS NOT NULL;
