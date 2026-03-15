import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@golist/shared/domain/types";
import {
  findLanguageSuggestion,
  getLanguageSuggestionHandledState,
  isLanguageSuggestionHandled,
  markLanguageSuggestionHandled,
} from "./languageSuggestion";

const createMemoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
};

vi.stubGlobal("localStorage", createMemoryStorage());

const createItem = (overrides: Partial<Item>): Item => ({
  id: overrides.id ?? crypto.randomUUID(),
  listId: overrides.listId ?? "list-1",
  name: overrides.name ?? "apfel",
  iconName: overrides.iconName ?? "default",
  category: overrides.category ?? "other",
  deleted: overrides.deleted ?? false,
  createdByDeviceId: overrides.createdByDeviceId,
  createdAt: overrides.createdAt ?? Date.now(),
  updatedAt: overrides.updatedAt ?? Date.now(),
});

describe("languageSuggestion", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when fewer than two items are eligible", () => {
    const suggestion = findLanguageSuggestion({
      currentLocale: "en",
      currentDeviceId: "device-a",
      items: [createItem({ name: "apfel", createdByDeviceId: "device-a" })],
    });

    expect(suggestion).toBeNull();
  });

  it("ignores items outside the seven-day window", () => {
    const now = Date.now();
    const suggestion = findLanguageSuggestion({
      currentLocale: "en",
      currentDeviceId: "device-a",
      now,
      items: [
        createItem({ name: "apfel", createdByDeviceId: "device-a", createdAt: now - (8 * 24 * 60 * 60 * 1000) }),
        createItem({ name: "brot", createdByDeviceId: "device-a", createdAt: now - 5000 }),
      ],
    });

    expect(suggestion).toBeNull();
  });

  it("ignores items that are not in the fallback category", () => {
    const suggestion = findLanguageSuggestion({
      currentLocale: "en",
      currentDeviceId: "device-a",
      items: [
        createItem({ name: "apfel", createdByDeviceId: "device-a", category: "fruitsVegetables" }),
        createItem({ name: "brot", createdByDeviceId: "device-a" }),
        createItem({ name: "käse", createdByDeviceId: "device-a" }),
      ],
    });

    expect(suggestion?.suggestedLocale).toBe("de");
    expect(suggestion?.itemUpdates).toHaveLength(2);
  });

  it("ignores items created by another device", () => {
    const suggestion = findLanguageSuggestion({
      currentLocale: "en",
      currentDeviceId: "device-a",
      items: [
        createItem({ name: "apfel", createdByDeviceId: "device-b" }),
        createItem({ name: "brot", createdByDeviceId: "device-b" }),
        createItem({ name: "käse", createdByDeviceId: "device-a" }),
      ],
    });

    expect(suggestion).toBeNull();
  });

  it("returns first qualifying locale in deterministic order", () => {
    const suggestion = findLanguageSuggestion({
      currentLocale: "de",
      currentDeviceId: "device-a",
      items: [
        createItem({ name: "manzana", createdByDeviceId: "device-a" }),
        createItem({ name: "pan", createdByDeviceId: "device-a" }),
      ],
    });

    expect(suggestion?.suggestedLocale).toBe("es");
    expect(suggestion?.itemUpdates).toHaveLength(2);
  });

  it("returns null when no single locale resolves all items", () => {
    const suggestion = findLanguageSuggestion({
      currentLocale: "en",
      currentDeviceId: "device-a",
      items: [
        createItem({ name: "apfel", createdByDeviceId: "device-a" }),
        createItem({ name: "pan", createdByDeviceId: "device-a" }),
      ],
    });

    expect(suggestion).toBeNull();
  });

  it("persists and reads handled state", () => {
    expect(isLanguageSuggestionHandled()).toBe(false);

    markLanguageSuggestionHandled({
      suggestedLocale: "de",
      action: "dismissed",
      handledAt: 123,
    });

    expect(isLanguageSuggestionHandled()).toBe(true);
    expect(getLanguageSuggestionHandledState()).toEqual({
      suggestedLocale: "de",
      action: "dismissed",
      handledAt: 123,
    });
  });
});
