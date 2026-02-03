import { describe, expect, it } from "vitest";
import { getCategoryForItem, getCategoryOrder, getItemIcon } from "./categories";

describe("categories helpers", () => {
  it("returns the category for known items regardless of case", () => {
    const category = getCategoryForItem("  ApPlE  ");
    expect(category?.id).toBe("fruitsVegetables");
    expect(category?.label).toBe("Fruits & Vegetables");
  });

  it("returns the category order for items that map to a known category", () => {
    expect(getCategoryOrder("bread")).toBe(2);
  });

  it("returns a specific icon when an asset match exists", () => {
    expect(getItemIcon("apple")).toBe("🍎");
  });

  it("falls back to the default icon when no match exists", () => {
    expect(getItemIcon("mystery item")).toBe("🛒");
  });
});
