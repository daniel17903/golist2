-- AI assistant connections (MCP connectors). Each one has its own device id,
-- so its writes are attributed to it and it can only delete lists it created.
-- It reaches the lists of the device that set it up (the owner): all of them
-- (include_all_lists) or the ones in mcp_connector_lists. Only a SHA-256
-- hash of the secret key from the connector URL is stored.
CREATE TABLE IF NOT EXISTS mcp_connectors (
  id UUID PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  device_id UUID NOT NULL UNIQUE,
  owner_device_id UUID NOT NULL,
  label TEXT NOT NULL,
  include_all_lists BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcp_connectors_owner_device_id ON mcp_connectors(owner_device_id);

CREATE TABLE IF NOT EXISTS mcp_connector_lists (
  connector_id UUID NOT NULL REFERENCES mcp_connectors(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  PRIMARY KEY (connector_id, list_id)
);

-- Listing a device's (or a connector owner's) lists looks lists up by creator.
CREATE INDEX IF NOT EXISTS idx_shared_lists_created_by_device_id ON shared_lists(created_by_device_id);
