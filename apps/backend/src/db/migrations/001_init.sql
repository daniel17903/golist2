CREATE TABLE IF NOT EXISTS shared_lists (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_by_device_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity_or_unit TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_device_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_list_items_list_id_updated_at ON list_items(list_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  created_by_device_id UUID NOT NULL,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_list_id ON share_tokens(list_id);

CREATE TABLE IF NOT EXISTS share_token_redemptions (
  token_id UUID NOT NULL REFERENCES share_tokens(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_share_token_redemptions_device_id
  ON share_token_redemptions(device_id);

CREATE TABLE IF NOT EXISTS migration_history (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
