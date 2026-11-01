import crypto from 'node:crypto'

import fc from 'fast-check'
import { afterAll, describe, expect, it } from 'vitest'

import { InMemoryListRepository } from '../test/in-memory-list-repository.js'
import type { ListType, TodoFields } from '@golist/shared/domain/types'

import { type ListRepository } from './list-repository.js'

// Differential test: the in-memory repository (used by most tests, the web
// sync simulation and the default E2E run) must behave exactly like the
// production Postgres repository. Both get the same random operation
// sequence; every outcome and the final list/item state must match.
//
// Runs only with a database (CI backend job, or locally via
// `eval "$(scripts/local-postgres.sh)"`). Fixed seed for determinism;
// override with FC_SEED / FC_RUNS to explore.
const hasDatabase = Boolean(process.env.PGHOST || process.env.DATABASE_URL)
const seed = Number(process.env.FC_SEED ?? 20261013)
const numRuns = Number(process.env.FC_RUNS ?? 60)

const ITEM_SLOTS = 3
const DEVICE_SLOTS = 2

type Operation =
  | { kind: 'putList'; device: number; name: string; at?: number; listType?: ListType }
  | { kind: 'upsertItems'; device: number; items: Array<{ slot: number; name: string; deleted: boolean; quantity?: string; todo: TodoFields<string>; at: number }> }
  | { kind: 'upsertItem'; device: number; slot: number; name: string; deleted: boolean; at: number }
  | { kind: 'share'; device: number; redeemer: number }

const at = fc.integer({ min: 0, max: 4 })
const name = fc.constantFrom('milk', 'Milk', 'bread', 'ü-Brot', 'a\\b')
const itemInput = fc.record({
  slot: fc.nat({ max: ITEM_SLOTS - 1 }),
  name,
  deleted: fc.boolean(),
  quantity: fc.option(fc.constantFrom('1', '2L'), { nil: undefined }),
  // Todo fields (todo-type lists); they take part in the equal-timestamp hash tie-break.
  todo: fc.record(
    {
      points: fc.integer({ min: 1, max: 3 }),
      completedAt: fc.constantFrom('2026-01-01T00:00:01.000Z', '2026-01-01T00:00:02.000Z'),
      assignedTo: fc.constantFrom('Alex', 'alex'),
      recurrence: fc.constant('{"every":1,"unit":"week","anchor":"from_due_date"}'),
    },
    { requiredKeys: [] },
  ),
  at,
})

const operationArb: fc.Arbitrary<Operation> = fc.oneof(
  // Mostly explicit timestamps: a putList without one stamps "now", far after
  // the fixed timestamps used here, which makes later renames lose.
  fc.record({ kind: fc.constant('putList' as const), device: fc.nat({ max: DEVICE_SLOTS - 1 }), name: fc.constantFrom('List', 'Groceries', 'groceries', 'Ünïcode'), at: fc.option(at, { nil: undefined, freq: 8 }), listType: fc.option(fc.constantFrom<ListType>('shopping', 'todo'), { nil: undefined }) }),
  fc.record({ kind: fc.constant('upsertItems' as const), device: fc.nat({ max: DEVICE_SLOTS - 1 }), items: fc.array(itemInput, { minLength: 1, maxLength: 3 }) }),
  fc.record({ kind: fc.constant('upsertItem' as const), device: fc.nat({ max: DEVICE_SLOTS - 1 }), slot: fc.nat({ max: ITEM_SLOTS - 1 }), name, deleted: fc.boolean(), at }),
  fc.record({ kind: fc.constant('share' as const), device: fc.nat({ max: DEVICE_SLOTS - 1 }), redeemer: fc.nat({ max: DEVICE_SLOTS - 1 }) }),
)

const iso = (offset: number) => new Date(Date.UTC(2026, 0, 1) + offset * 1_000).toISOString()

type Ids = { listId: string; devices: string[]; itemIds: string[] }

// Fresh ids per run, shared by both repositories: equal-timestamp
// tie-breaks hash the item and list ids, so they must be identical.
const createIds = (): Ids => ({
  listId: crypto.randomUUID(),
  devices: Array.from({ length: DEVICE_SLOTS }, () => crypto.randomUUID()),
  itemIds: Array.from({ length: ITEM_SLOTS }, () => crypto.randomUUID()),
})

// Runs one operation sequence against a repository and returns a
// repository-independent transcript (ids replaced by slot numbers).
const runSequence = async (repository: ListRepository, operations: Operation[], { listId, devices, itemIds }: Ids) => {
  const transcript: unknown[] = []

  // The list always exists, owned by device 0.
  transcript.push(await repository.putList(listId, 'Initial', devices[0], iso(0)))

  for (const operation of operations) {
    const deviceId = devices[operation.device]
    switch (operation.kind) {
      case 'putList':
        transcript.push(
          await repository.putList(listId, operation.name, deviceId, operation.at === undefined ? undefined : iso(operation.at), operation.listType),
        )
        break
      case 'upsertItems':
        transcript.push(
          await repository.upsertListItems(
            listId,
            deviceId,
            operation.items.map((item) => ({
              itemId: itemIds[item.slot],
              input: { name: item.name, iconName: 'default', category: 'other', quantityOrUnit: item.quantity, deleted: item.deleted, updatedAt: iso(item.at), ...item.todo },
            })),
          ),
        )
        break
      case 'upsertItem':
        transcript.push(
          await repository.upsertListItem(listId, itemIds[operation.slot], deviceId, {
            name: operation.name,
            iconName: 'default',
            category: 'other',
            deleted: operation.deleted,
            updatedAt: iso(operation.at),
          }),
        )
        break
      case 'share': {
        const hasAccess = await repository.hasListAccess(listId, deviceId)
        transcript.push({ shareAllowed: hasAccess })
        if (hasAccess) {
          const token = await repository.createShareToken(listId, deviceId)
          await repository.recordShareTokenRedemption(token.tokenId, devices[operation.redeemer])
        }
        break
      }
    }
  }

  const list = await repository.getList(listId)
  const items = await repository.listItems(listId)
  const slotOf = (id: string) => itemIds.indexOf(id)
  return {
    transcript,
    // putList without an explicit updatedAt stamps "now", which differs
    // between the two runs; only compare explicit timestamps.
    list: list && { name: list.name, listType: list.listType },
    access: await Promise.all(devices.map((device) => repository.hasListAccess(listId, device))),
    items: items
      .map((item) => ({
        slot: slotOf(item.id),
        name: item.name,
        deleted: item.deleted,
        quantityOrUnit: item.quantityOrUnit ?? null,
        points: item.points ?? null,
        completedAt: item.completedAt ?? null,
        assignedTo: item.assignedTo ?? null,
        recurrence: item.recurrence ?? null,
        updatedAt: Date.parse(item.updatedAt),
      }))
      .sort((left, right) => left.slot - right.slot),
  }
}

describe.skipIf(!hasDatabase)('list repository differential (in-memory vs Postgres)', async () => {
  const { postgresListRepository } = await import('./postgres-list-repository.js')
  const { pool } = await import('../db/client.js')

  afterAll(async () => {
    await pool.end()
  })

  it('produces the same outcomes and final state for random operation sequences', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(operationArb, { minLength: 1, maxLength: 12 }), async (operations) => {
        const ids = createIds()
        const memory = await runSequence(new InMemoryListRepository(), operations, ids)
        const postgres = await runSequence(postgresListRepository, operations, ids)
        expect(postgres).toEqual(memory)
      }),
      {
        seed,
        numRuns,
        examples: [
          // Same name and timestamp, only the list type differs: the
          // equal-timestamp tie-break on the type (rare in random runs).
          [[
            { kind: 'putList', device: 0, name: 'List', at: 1 },
            { kind: 'putList', device: 0, name: 'List', at: 1, listType: 'todo' },
          ]],
        ],
      },
    )
  }, 120_000)
})
