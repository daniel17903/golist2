DROP INDEX IF EXISTS idx_share_tokens_redeemed_by_device_id;

ALTER TABLE share_tokens
  DROP COLUMN IF EXISTS redeemed_by_device_id,
  DROP COLUMN IF EXISTS redeemed_at;
