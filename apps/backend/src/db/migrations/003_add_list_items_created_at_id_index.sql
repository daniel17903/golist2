-- listItems() in postgres-list-repository.ts orders by (created_at ASC, id ASC)
-- for the WebSocket sync reconciliation path (subscribe_list / list_digest /
-- hash_diff). The only existing index on list_items, idx_list_items_list_id_updated_at
-- (list_id, updated_at DESC), does not satisfy that ORDER BY, forcing Postgres
-- to sort in memory after the index scan on every reconciliation read. Add a
-- matching index instead of changing the query order, since item ordering
-- feeds into hashing/comparison code paths and a matching index is the
-- zero-behavior-change way to fix the sort.
CREATE INDEX IF NOT EXISTS idx_list_items_list_id_created_at_id
  ON list_items(list_id, created_at ASC, id ASC);
