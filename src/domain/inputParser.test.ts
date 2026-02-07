import { describe, expect, it } from "vitest";
import { parseItemInput } from "./inputParser";

describe("parseItemInput", () => {
  const inputsToExpected: Array<{
    input: string;
    name: string;
    quantityOrUnit?: string;
  }> = [
    { input: "efwefwg", name: "efwefwg" },
    { input: "1Liter wefwg", name: "wefwg", quantityOrUnit: "1Liter" },
    { input: "1 Liter wefwg", name: "wefwg", quantityOrUnit: "1 Liter" },
    { input: "1 fwefew", name: "fwefew", quantityOrUnit: "1" },
    { input: "1 dose fwefew", name: "fwefew", quantityOrUnit: "1 dose" },
    { input: "2 dosen fwefew", name: "fwefew", quantityOrUnit: "2 dosen" },
    { input: "fwef2geweg", name: "fwef2geweg" },
    { input: "efwef2literwegwg", name: "efwef2literwegwg" },
    { input: "2literwrgwg", name: "2literwrgwg" },
    { input: "kuchen 2 Stück", name: "kuchen", quantityOrUnit: "2 Stück" },
    { input: "kuchen 2", name: "kuchen", quantityOrUnit: "2" },
    { input: "2.5 liter wasser", name: "wasser", quantityOrUnit: "2.5 liter" },
    { input: "2,5 liter wasser", name: "wasser", quantityOrUnit: "2,5 liter" },
    { input: "mehl typ 630", name: "mehl typ 630" },
    { input: "mehl Typ 630", name: "mehl Typ 630" }
  ];

  inputsToExpected.forEach(({ input, name, quantityOrUnit }) => {
    it(`${input} -> ${quantityOrUnit ?? "no amount"}`, () => {
      expect(parseItemInput(input)).toEqual({ name, quantityOrUnit });
    });
  });
});
