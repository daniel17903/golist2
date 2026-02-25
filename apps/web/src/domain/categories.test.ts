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

  it("returns a locale-aware icon and category for apple variants", () => {
    expect(getItemIcon("apfel", "de")).toBe("/icons/apple.svg");
    expect(getCategoryForItem("apfel", "de")?.id).toBe("fruitsVegetables");
    expect(getCategoryForItem("apfel", "en")).toBeUndefined();
  });

  it("falls back to the default icon when no match exists", () => {
    expect(getItemIcon("mystery item", "en")).toBe("/icons/default.svg");
  });
});
