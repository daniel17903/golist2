import { describe, expect, it } from "vitest";
import { resources } from "./resources";

describe("i18n resources", () => {
  it("keeps key parity with English baseline", () => {
    const englishKeys = Object.keys(resources.en).sort();
    Object.entries(resources).forEach(([, dictionary]) => {
      expect(Object.keys(dictionary).sort()).toEqual(englishKeys);
    });
  });
});
