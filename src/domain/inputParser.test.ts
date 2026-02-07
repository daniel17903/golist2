import { describe, expect, it } from "vitest";
import { parseAmount, parseItemInput } from "./inputParser";

describe("parseAmount", () => {
  const inputsToExpected: Record<string, string | undefined> = {
    efwefwg: undefined,
    "1Liter wefwg": "1Liter",
    "1 Liter wefwg": "1 Liter",
    "1 fwefew": "1",
    "1 dose fwefew": "1 dose",
    "2 dosen fwefew": "2 dosen",
    fwef2geweg: undefined,
    efwef2literwegwg: undefined,
    "2literwrgwg": undefined,
    "kuchen 2 Stück": "2 Stück",
    "kuchen 2": "2",
    "2.5 liter wasser": "2.5 liter",
    "2,5 liter wasser": "2,5 liter",
    "mehl typ 630": undefined,
    "mehl Typ 630": undefined
  };

  Object.entries(inputsToExpected).forEach(([input, expected]) => {
    it(`${input} -> ${expected ?? "no amount"}`, () => {
      expect(parseAmount(input)).toBe(expected);
    });
  });
});

describe("parseItemInput", () => {
  it("returns parsed name and quantityOrUnit", () => {
    expect(parseItemInput("2 Liter Milch")).toEqual({
      name: "Milch",
      quantityOrUnit: "2 Liter"
    });
  });

  it("returns the full input when no amount is present", () => {
    expect(parseItemInput("Äpfel")).toEqual({
      name: "Äpfel",
      quantityOrUnit: undefined
    });
  });
});
