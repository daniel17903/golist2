import { describe, expect, it } from "vitest";
import { getCategoryForItem, getCategoryOrder, getItemIcon } from "./categories";

describe("categories helpers", () => {
  it("returns the category for known items regardless of case", () => {
    const category = getCategoryForItem("  ApPlE  ", "en");
    expect(category?.id).toBe("fruitsVegetables");
    expect(category?.label).toBe("Fruits & Vegetables");
  });

  it("returns the category order for items that map to a known category", () => {
    expect(getCategoryOrder("bread", "en")).toBe(2);
  });

  it("returns a specific icon when an asset match exists", () => {
    expect(getItemIcon("apple", "en")).toBe("/icons/apple.svg");
  });

  it("detects locale-specific item names", () => {
    expect(getCategoryForItem("apfel", "de")?.id).toBe("fruitsVegetables");
    expect(getCategoryForItem("apfel", "en")).toBeUndefined();
    expect(getCategoryForItem("apple", "en")?.id).toBe("fruitsVegetables");
  });

  it("falls back to the default icon when no match exists for the active locale", () => {
    expect(getItemIcon("apfel", "en")).toBe("/icons/default.svg");
    expect(getItemIcon("mystery item", "en")).toBe("/icons/default.svg");
  });
});
