import { describe, expect, it } from "vitest";
import { getCategoryIdForItem, getItemIcon, getItemIconForCategory, getListItemIcon } from "./categories";

describe("categories helpers", () => {
  it("returns the category for known items regardless of case", () => {
    expect(getCategoryIdForItem("  ApPlE  ", "en")).toBe("fruitsVegetables");
  });

  it("returns a locale-aware icon and category for apple variants", () => {
    expect(getItemIcon("apfel", "de")).toBe("/icons/apple.svg");
    expect(getCategoryIdForItem("apfel", "de")).toBe("fruitsVegetables");
    expect(getCategoryIdForItem("apfel", "en")).toBeUndefined();
  });

  it("uses translated locale entries for spanish", () => {
    expect(getCategoryIdForItem("manzana", "es")).toBe("fruitsVegetables");
    expect(getItemIcon("manzana", "es")).toBe("/icons/apple.svg");
  });

  it("returns a stable icon for a stored category", () => {
    expect(getItemIconForCategory("fruitsVegetables")).toBe("/icons/apple.svg");
    expect(getItemIconForCategory("unknown")).toBe("/icons/default.svg");
  });

  it("prefers exact item icon over category icon for known localized names", () => {
    expect(getListItemIcon("banane", "fruitsVegetables")).toBe("/icons/banana.svg");
    expect(getListItemIcon("creme", "household")).toBe("/icons/cream.svg");
  });

  it("falls back to category icon when item icon is unknown", () => {
    expect(getListItemIcon("mystery item", "fruitsVegetables")).toBe("/icons/apple.svg");
  });

  it("resolves saved item icons independent from active language", () => {
    expect(getListItemIcon("apfel", "fruitsVegetables")).toBe("/icons/apple.svg");
    expect(getListItemIcon("manzana", "fruitsVegetables")).toBe("/icons/apple.svg");
  });

  it("falls back to the default icon when no match exists", () => {
    expect(getItemIcon("mystery item", "en")).toBe("/icons/default.svg");
  });
});
