import fc from "fast-check";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import type { Item, List } from "@golist/shared/domain/types";
import {
  buildItemHash,
  buildListDigest,
  shouldAcceptListMetadata,
  type ListMetadataSnapshot,
} from "@golist/shared/domain/sync";
import { GoListDatabase } from "../storage/db";
import { createStoreSyncCallbacks } from "./storeSyncBridge";

// Property tests for the sync conflict rules. They run with a fixed seed so
// CI stays deterministic; to explore further, run them with a different
// seed: `FC_SEED=123 FC_RUNS=5000 npx vitest run src/sharing/syncProperties.test.ts`.
const seed = Number(process.env.FC_SEED ?? 20261013);
const numRuns = Number(process.env.FC_RUNS ?? 300);
const params = { seed, numRuns };

const LIST_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_IDS = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
];

// Small value pools so collisions (same item, same timestamp) are common.
const itemArb: fc.Arbitrary<Item> = fc.record({
  id: fc.constantFrom(...ITEM_IDS),
  listId: fc.constant(LIST_ID),
  name: fc.constantFrom("milk", "bread", "eggs", "Milk"),
  iconName: fc.constantFrom("default", "milk"),
  quantityOrUnit: fc.option(fc.constantFrom("1", "2L"), { nil: undefined }),
  category: fc.constantFrom("other", "dairy"),
  deleted: fc.boolean(),
  createdAt: fc.constant(1),
  updatedAt: fc.integer({ min: 1, max: 4 }),
});

const metadataArb: fc.Arbitrary<ListMetadataSnapshot> = fc.record({
  name: fc.constantFrom("A", "B", "Groceries", "groceries", ""),
  updatedAt: fc.integer({ min: 1, max: 3 }),
});

// A list of patches plus a random permutation of it.
const withPermutation = <T>(arb: fc.Arbitrary<T[]>) =>
  arb.chain((values) => fc.tuple(fc.constant(values), fc.shuffledSubarray(values, { minLength: values.length })));

const winsOver = (left: Item, right: Item) =>
  left.updatedAt > right.updatedAt ||
  (left.updatedAt === right.updatedAt && buildItemHash(left) > buildItemHash(right));

describe("list digest", () => {
  it("does not depend on item order", () => {
    fc.assert(
      fc.property(fc.uniqueArray(itemArb, { selector: (item) => item.id }), (items) => {
        const shuffled = [...items].reverse();
        expect(buildListDigest(shuffled)).toBe(buildListDigest(items));
      }),
      params,
    );
  });

  it("changes when any synced field of an item changes", () => {
    fc.assert(
      fc.property(itemArb, itemArb, (left, right) => {
        fc.pre(left.id === right.id && buildItemHash(left) !== buildItemHash(right));
        expect(buildListDigest([left])).not.toBe(buildListDigest([right]));
      }),
      params,
    );
  });
});

describe("list metadata conflict rule", () => {
  it("is a strict total order, so every peer picks the same winner", () => {
    fc.assert(
      fc.property(metadataArb, metadataArb, (left, right) => {
        const same = left.name === right.name && left.updatedAt === right.updatedAt;
        const leftWins = shouldAcceptListMetadata(left, right);
        const rightWins = shouldAcceptListMetadata(right, left);
        if (same) {
          expect([leftWins, rightWins]).toEqual([false, false]);
        } else {
          expect(leftWins).not.toBe(rightWins);
        }
      }),
      params,
    );
  });

  it("converges to the same name whatever order the patches arrive in", () => {
    fc.assert(
      fc.property(metadataArb, withPermutation(fc.array(metadataArb, { maxLength: 6 })), (initial, [patches, shuffled]) => {
        const apply = (order: ListMetadataSnapshot[]) =>
          order.reduce((current, patch) => (shouldAcceptListMetadata(patch, current) ? patch : current), initial);
        expect(apply(shuffled)).toEqual(apply(patches));
      }),
      params,
    );
  });
});

describe("client item conflict resolution (storeSyncBridge)", () => {
  // Runs the real bridge against an in-memory "store" and records the final
  // state after applying `patches` one by one.
  const applyAll = async (initial: Item[], patches: Item[]) => {
    let items = [...initial];
    const list: List = { id: LIST_ID, name: "List", createdAt: 1, updatedAt: 1 };
    const callbacks = createStoreSyncCallbacks({
      getLists: () => [list],
      getItems: () => items,
      getDeviceId: () => "device",
      applyAcceptedItems: (accepted) => {
        const byId = new Map(items.map((item) => [item.id, item]));
        accepted.forEach((item) => byId.set(item.id, item));
        items = [...byId.values()];
      },
      applyListMetadata: vi.fn(),
      onConnectionState: vi.fn(),
      onError: vi.fn(),
      db: new GoListDatabase(`properties-${crypto.randomUUID()}`, { indexedDB: new IDBFactory(), IDBKeyRange }),
    });
    for (const patch of patches) {
      await callbacks.applyIncomingItems(LIST_ID, [patch]);
    }
    return new Map(items.map((item) => [item.id, buildItemHash(item)]));
  };

  it("ends in the last-write-wins state regardless of arrival order", async () => {
    await fc.assert(
      fc.asyncProperty(withPermutation(fc.array(itemArb, { minLength: 1, maxLength: 8 })), async ([patches, shuffled]) => {
        const forward = await applyAll([], patches);
        const reordered = await applyAll([], shuffled);
        expect(reordered).toEqual(forward);

        // ...and that state is the max by (updatedAt, item hash) per item.
        for (const [id, hash] of forward) {
          const versions = patches.filter((patch) => patch.id === id);
          const winner = versions.reduce((best, candidate) => (winsOver(candidate, best) ? candidate : best));
          expect(hash).toBe(buildItemHash(winner));
        }
      }),
      params,
    );
  });
});
