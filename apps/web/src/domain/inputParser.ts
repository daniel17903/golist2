import { getLocale } from "../i18n";
import type { Locale } from "../i18n/config";

const flourExclusionPattern = /typ +[0-9]+/gi;

const unitByLocale: Record<Locale, string[]> = {
  en: [
    "liter",
    "liters",
    "l",
    "ml",
    "g",
    "kg",
    "kilo",
    "gram",
    "grams",
    "cup",
    "cups",
    "jar",
    "jars",
    "bunch",
    "slices",
    "slice",
    "pack",
    "packs",
    "piece",
    "pieces",
    "can",
    "cans",
    "bottle",
    "bottles",
    "crate",
    "crates",
    "bag",
    "bags",
  ],
  de: [
    "liter",
    "ml",
    "l",
    "g",
    "kg",
    "kilo",
    "gramm",
    "kilogramm",
    "becher",
    "glas",
    "bund",
    "scheiben",
    "packung",
    "packungen",
    "gläser",
    "glaeser",
    "stueck",
    "stuecke",
    "stück",
    "stücke",
    "dose",
    "dosen",
    "flasche",
    "flaschen",
    "kiste",
    "kisten",
    "beutel",
    "tuete",
    "tueten",
    "tüte",
    "tüten",
  ],
  es: [
    "litro",
    "litros",
    "l",
    "ml",
    "g",
    "kg",
    "kilo",
    "gramo",
    "gramos",
    "taza",
    "tazas",
    "vaso",
    "vasos",
    "frasco",
    "frascos",
    "paquete",
    "paquetes",
    "pieza",
    "piezas",
    "lata",
    "latas",
    "botella",
    "botellas",
    "bolsa",
    "bolsas",
  ],
};

export type ParsedItemInput = {
  name: string;
  quantityOrUnit?: string;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAmountPattern = (locale: Locale) => {
  const units = unitByLocale[locale].map(escapeRegExp).join("|");
  return new RegExp(`(^| +)([0-9]+((.|,)[0-9])? ?(${units})?)( +|$)`, "i");
};

export const parseAmount = (input: string, locale: Locale = getLocale()): string | undefined => {
  const cleanedInput = input.replace(flourExclusionPattern, "");
  const match = cleanedInput.match(getAmountPattern(locale));
  return match?.[2];
};

export const parseItemInput = (input: string, locale: Locale = getLocale()): ParsedItemInput => {
  const trimmedInput = input.trim();
  const amount = parseAmount(trimmedInput, locale);
  const name = amount ? trimmedInput.replace(amount, "").trim() : trimmedInput;
  return {
    name,
    quantityOrUnit: amount ?? undefined,
  };
};
