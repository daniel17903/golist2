ALTER TABLE list_items
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

CREATE TABLE IF NOT EXISTS share_token_redemptions (
  token_id UUID NOT NULL REFERENCES share_tokens(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_share_token_redemptions_device_id
  ON share_token_redemptions(device_id);
