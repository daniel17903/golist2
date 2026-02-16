CREATE TABLE IF NOT EXISTS idempotency_keys (
  token_id UUID NOT NULL REFERENCES share_tokens(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  route TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_id, device_id, route, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys(created_at);
