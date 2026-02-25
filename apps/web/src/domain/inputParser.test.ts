import { describe, expect, it } from "vitest";
import { parseAmount, parseItemInput } from "./inputParser";

describe("parseAmount", () => {
  const inputsToExpected: Array<{ input: string; locale: "en" | "de" | "es"; expected?: string }> = [
    { input: "efwefwg", locale: "de", expected: undefined },
    { input: "1Liter wefwg", locale: "de", expected: "1Liter" },
    { input: "1 Liter wefwg", locale: "de", expected: "1 Liter" },
    { input: "1 fwefew", locale: "de", expected: "1" },
    { input: "1 dose fwefew", locale: "de", expected: "1 dose" },
    { input: "2 dosen fwefew", locale: "de", expected: "2 dosen" },
    { input: "2.5 liter wasser", locale: "de", expected: "2.5 liter" },
    { input: "2,5 liter wasser", locale: "de", expected: "2,5 liter" },
    { input: "mehl typ 630", locale: "de", expected: undefined },
    { input: "2 apples", locale: "en", expected: "2" },
    { input: "2 liters water", locale: "en", expected: "2 liters" },
    { input: "2 manzanas", locale: "es", expected: "2" },
    { input: "2 litros agua", locale: "es", expected: "2 litros" },
  ];

  inputsToExpected.forEach(({ input, locale, expected }) => {
    it(`${locale}: ${input} -> ${expected ?? "no amount"}`, () => {
      expect(parseAmount(input, locale)).toBe(expected);
    });
  });
});

describe("parseItemInput", () => {
  it("returns parsed name and quantityOrUnit in german", () => {
    expect(parseItemInput("2 Liter Milch", "de")).toEqual({
      name: "Milch",
      quantityOrUnit: "2 Liter",
    });
  });

  it("returns parsed name and quantityOrUnit in english", () => {
    expect(parseItemInput("2 liters milk", "en")).toEqual({
      name: "milk",
      quantityOrUnit: "2 liters",
    });
  });

  it("returns parsed name and quantityOrUnit in spanish", () => {
    expect(parseItemInput("2 litros leche", "es")).toEqual({
      name: "leche",
      quantityOrUnit: "2 litros",
    });
  });

  it("returns the full input when no amount is present", () => {
    expect(parseItemInput("Äpfel", "de")).toEqual({
      name: "Äpfel",
      quantityOrUnit: undefined,
    });
  });
});
