import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Item, List } from "@golist/shared/domain/types";

const listsPut = vi.fn(async (): Promise<void> => undefined);
const itemsBulkPut = vi.fn(async (): Promise<void> => undefined);

vi.mock("../storage/db", () => ({
  db: {
    lists: { put: listsPut },
    items: { bulkPut: itemsBulkPut },
  },
}));

vi.mock("./apiClient", () => ({
  sharingApiClient: {
    upsertList: vi.fn(),
  },
}));

afterEach(() => {
  vi.resetModules();
});

const buildDeps = (lists: List[]) => {
  const applyAcceptedItems = vi.fn();
  const applyListMetadata = vi.fn();
  const deps = {
    getLists: () => lists,
    getItems: (): Item[] => [],
    getDeviceId: () => "device-1",
    applyAcceptedItems,
    applyListMetadata,
    onConnectionState: vi.fn(),
    onError: vi.fn(),
  };
  return { deps, applyAcceptedItems, applyListMetadata };
};

describe("createStoreSyncCallbacks - applyIncomingListMetadata", () => {
  beforeEach(() => {
    listsPut.mockClear();
    itemsBulkPut.mockClear();
  });

  it("applies an incoming rename when its updatedAt is strictly newer", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "Old", createdAt: 1, updatedAt: 100 };
    const { deps, applyListMetadata } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks(deps);

    await callbacks.applyIncomingListMetadata("list-1", { name: "New", updatedAt: 200 });

    expect(applyListMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ id: "list-1", name: "New", updatedAt: 200 }),
    );
    expect(listsPut).toHaveBeenCalledTimes(1);
  });

  it("ignores an incoming rename when its updatedAt is older", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "Current", createdAt: 1, updatedAt: 200 };
    const { deps, applyListMetadata } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks(deps);

    await callbacks.applyIncomingListMetadata("list-1", { name: "Stale", updatedAt: 100 });

    expect(applyListMetadata).not.toHaveBeenCalled();
    expect(listsPut).not.toHaveBeenCalled();
  });

  it("ignores a same-timestamp patch carrying the same name (no-op)", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");
    const list: List = { id: "list-1", name: "Same", createdAt: 1, updatedAt: 500 };
    const { deps, applyListMetadata } = buildDeps([list]);
    const callbacks = createStoreSyncCallbacks(deps);

    await callbacks.applyIncomingListMetadata("list-1", { name: "Same", updatedAt: 500 });

    expect(applyListMetadata).not.toHaveBeenCalled();
  });

  // Two devices rename the same shared list to different names while
  // offline, then reconnect near-simultaneously so both patches carry the
  // exact same millisecond `updatedAt`. Without a deterministic tie-break,
  // whichever patch a device happened to receive first would "win" locally,
  // letting the two devices settle on different final names forever. The
  // shared `shouldAcceptListMetadata` rule (lexicographically greater name
  // wins on a tie) must produce the same outcome no matter which side is
  // doing the comparing.
  it("resolves a same-timestamp rename conflict identically regardless of which device is applying it", async () => {
    const { createStoreSyncCallbacks } = await import("./storeSyncBridge");

    // Device A already renamed the list to "Zebra" locally and now receives
    // device B's competing "Alpha" patch (same updatedAt).
    const listOnDeviceA: List = { id: "list-1", name: "Zebra", createdAt: 1, updatedAt: 500 };
    const { deps: depsA, applyListMetadata: applyOnDeviceA } = buildDeps([listOnDeviceA]);
    const callbacksA = createStoreSyncCallbacks(depsA);
    await callbacksA.applyIncomingListMetadata("list-1", { name: "Alpha", updatedAt: 500 });

    // Device B already renamed the list to "Alpha" locally and now receives
    // device A's competing "Zebra" patch (same updatedAt).
    const listOnDeviceB: List = { id: "list-1", name: "Alpha", createdAt: 1, updatedAt: 500 };
    const { deps: depsB, applyListMetadata: applyOnDeviceB } = buildDeps([listOnDeviceB]);
    const callbacksB = createStoreSyncCallbacks(depsB);
    await callbacksB.applyIncomingListMetadata("list-1", { name: "Zebra", updatedAt: 500 });

    // "Zebra" > "Alpha" lexicographically, so it must win everywhere:
    // device A keeps its local "Zebra" (rejects the incoming "Alpha"), and
    // device B adopts "Zebra" from the incoming patch. Both devices converge
    // on the same final name.
    expect(applyOnDeviceA).not.toHaveBeenCalled();
    expect(applyOnDeviceB).toHaveBeenCalledWith(
      expect.objectContaining({ id: "list-1", name: "Zebra", updatedAt: 500 }),
    );
  });
});
