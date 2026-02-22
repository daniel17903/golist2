import { describe, expect, it } from "vitest";
import en from "./resources/en.json";
import de from "./resources/de.json";
import es from "./resources/es.json";

const keysOf = (obj: unknown, prefix = ""): string[] => {
  if (!obj || typeof obj !== "object") {
    return [prefix];
  }

  if (obj === null) {
    return [prefix];
  }

  return Object.entries(obj).flatMap(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      return keysOf(value, nextPrefix);
    }
    return [nextPrefix];
  });
};

describe("translation resource parity", () => {
  it("keeps de/es keys aligned with en", () => {
    const enKeys = keysOf(en).sort();
    expect(keysOf(de).sort()).toEqual(enKeys);
    expect(keysOf(es).sort()).toEqual(enKeys);
  });
});
