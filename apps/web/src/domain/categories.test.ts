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

  it("prefers the longest ending match when multiple endings match", () => {
    expect(getCategoryIdForItem("Reis", "de")).toBe("cereals");
    expect(getItemIconName("Reis", "de")).toBe("rice");
  });

  it("matches category and icon when matching names are concatenated", () => {
    expect(getCategoryIdForItem("applebread", "en")).toBe("bread");
    expect(getItemIconName("applebread", "en")).toBe("bread");
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

  it("maps rosemary to the same icon and category as herbs across locales", () => {
    expect(getCategoryIdForItem("kräuter", "de")).toBe("spicesCanned");
    expect(getItemIconName("kräuter", "de")).toBe("herbs");
    expect(getCategoryIdForItem("rosmarin", "de")).toBe("spicesCanned");
    expect(getItemIconName("rosmarin", "de")).toBe("herbs");
    expect(getCategoryIdForItem("thymian", "de")).toBe("spicesCanned");
    expect(getItemIconName("thymian", "de")).toBe("herbs");

    expect(getCategoryIdForItem("herbs", "en")).toBe("spicesCanned");
    expect(getItemIconName("herbs", "en")).toBe("herbs");
    expect(getCategoryIdForItem("rosemary", "en")).toBe("spicesCanned");
    expect(getItemIconName("rosemary", "en")).toBe("herbs");
    expect(getCategoryIdForItem("thyme", "en")).toBe("spicesCanned");
    expect(getItemIconName("thyme", "en")).toBe("herbs");

    expect(getCategoryIdForItem("hierbas", "es")).toBe("spicesCanned");
    expect(getItemIconName("hierbas", "es")).toBe("herbs");
    expect(getCategoryIdForItem("romero", "es")).toBe("spicesCanned");
    expect(getItemIconName("romero", "es")).toBe("herbs");
    expect(getCategoryIdForItem("tomillo", "es")).toBe("spicesCanned");
    expect(getItemIconName("tomillo", "es")).toBe("herbs");
  });

  it("maps granola to the box icon and household category across locales", () => {
    expect(getCategoryIdForItem("granola", "de")).toBe("household");
    expect(getItemIconName("granola", "de")).toBe("box");

    expect(getCategoryIdForItem("granola", "en")).toBe("household");
    expect(getItemIconName("granola", "en")).toBe("box");

    expect(getCategoryIdForItem("granola", "es")).toBe("household");
    expect(getItemIconName("granola", "es")).toBe("box");
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
