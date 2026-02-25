import { describe, expect, it } from "vitest";
import { getCategoryIdForItem, getItemIcon, getItemIconForCategory } from "./categories";

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

  it("falls back to the default icon when no match exists", () => {
    expect(getItemIcon("mystery item", "en")).toBe("/icons/default.svg");
  });
});
