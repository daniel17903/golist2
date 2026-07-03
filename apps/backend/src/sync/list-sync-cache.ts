import type { Item } from '@golist/shared/domain/types'
import { buildItemSummaries, buildListDigest, type SyncItemSummary } from '@golist/shared/domain/sync'

export type ListSyncSnapshot = {
  items: Item[]
  digest: string
  summaries: SyncItemSummary[]
}

/**
 * Caches the sorted/hashed view of a list's items (digest + per-item
 * summaries) that WebSocket sync reconciliation repeatedly recomputes.
 *
 * Before this cache existed, `subscribe_list`, `list_digest`, and `hash_diff`
 * each independently re-fetched every item for a list from Postgres and
 * rebuilt the digest/summaries via `buildListDigest`/`buildItemSummaries`
 * from scratch — three full reads + rehashes per reconciliation round, even
 * when nothing had changed since the last read.
 *
 * The cache is keyed by listId and shared across all WebSocket connections
 * (and REST writes) for the process. Callers MUST call `invalidate(listId)`
 * after any write that could change the list's item set or item contents
 * (item create/update/delete) so a stale snapshot is never served. Callers
 * that also want to be defensive about list-level writes (e.g. rename) may
 * invalidate on those too, even though `buildListDigest`/`buildItemSummaries`
 * currently only depend on item fields.
 */
export class ListSyncCache {
  private readonly snapshots = new Map<string, ListSyncSnapshot>()

  invalidate(listId: string): void {
    this.snapshots.delete(listId)
  }

  async getSnapshot(listId: string, loadItems: () => Promise<Item[]>): Promise<ListSyncSnapshot> {
    const cached = this.snapshots.get(listId)
    if (cached) {
      return cached
    }

    const items = await loadItems()
    const snapshot: ListSyncSnapshot = {
      items,
      digest: buildListDigest(items),
      summaries: buildItemSummaries(items),
    }

    this.snapshots.set(listId, snapshot)
    return snapshot
  }
}
