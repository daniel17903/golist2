import { describe, expect, it } from "vitest";
import { getCategoryIdForItem, getItemIcon, getItemIconName, getListItemIcon } from "./categories";

describe("categories helpers", () => {
  it("returns the category for known items regardless of case", () => {
    expect(getCategoryIdForItem("  ApPlE  ", "en")).toBe("fruitsVegetables");
  });

  it("matches category and icon when the item name contains a matching word", () => {
    expect(getCategoryIdForItem("fresh apple slices", "en")).toBe("fruitsVegetables");
    expect(getItemIconName("fresh apple slices", "en")).toBe("apple");
  });

  it("prefers a match at the end when multiple words match", () => {
    expect(getCategoryIdForItem("apple bread", "en")).toBe("bread");
    expect(getItemIconName("apple bread", "en")).toBe("bread");
  });

  it("allows any match when there are multiple matches and none at the end", () => {
    expect(["fruitsVegetables", "bread"]).toContain(getCategoryIdForItem("apple bread now", "en"));
    expect(["apple", "bread"]).toContain(getItemIconName("apple bread now", "en"));
  });

  it("returns locale-aware icon names and categories", () => {
    expect(getItemIconName("apfel", "de")).toBe("apple");
    expect(getItemIcon("apfel", "de")).toBe("/icons/apple.svg");
    expect(getCategoryIdForItem("apfel", "de")).toBe("fruitsVegetables");
    expect(getCategoryIdForItem("apfel", "en")).toBeUndefined();
  });

  it("uses translated locale entries for spanish", () => {
    expect(getCategoryIdForItem("manzana", "es")).toBe("fruitsVegetables");
    expect(getItemIconName("manzana", "es")).toBe("apple");
    expect(getItemIcon("manzana", "es")).toBe("/icons/apple.svg");
  });

  it("renders list icons from stored icon names", () => {
    expect(getListItemIcon("banana")).toBe("/icons/banana.svg");
    expect(getListItemIcon("cream")).toBe("/icons/cream.svg");
  });

  it("falls back to the default icon when no match exists", () => {
    expect(getItemIcon("mystery item", "en")).toBe("/icons/default.svg");
    expect(getListItemIcon()).toBe("/icons/default.svg");
  });
});
