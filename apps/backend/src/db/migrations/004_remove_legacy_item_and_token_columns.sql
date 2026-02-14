DROP INDEX IF EXISTS idx_list_items_list_id_position;

ALTER TABLE list_items
  DROP COLUMN IF EXISTS note,
  DROP COLUMN IF EXISTS position;

ALTER TABLE share_tokens
  DROP COLUMN IF EXISTS token_hash;
