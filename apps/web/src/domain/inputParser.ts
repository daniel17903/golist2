import { getCurrentLocale } from "../i18n";
import type { Locale } from "../i18n/config";

const baseUnits = [
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
  "packung(?:en)?",
  "gläser",
  "glaeser",
  "stueck(?:e)?",
  "stück(?:e)?",
  "dose(?:n)?",
  "flasche(?:n)?",
  "kiste(?:n)?",
  "beutel(?:n)?",
  "tuete(?:n)?",
  "tüte(?:n)?",
];

const localeUnits: Record<Locale, string[]> = {
  de: [...baseUnits],
  en: [
    ...baseUnits,
    "cup(?:s)?",
    "jar(?:s)?",
    "slice(?:s)?",
    "piece(?:s)?",
    "can(?:s)?",
    "bottle(?:s)?",
    "bag(?:s)?",
    "packet(?:s)?",
  ],
  es: [
    ...baseUnits,
    "taza(?:s)?",
    "frasco(?:s)?",
    "rebanada(?:s)?",
    "pieza(?:s)?",
    "lata(?:s)?",
    "botella(?:s)?",
    "bolsa(?:s)?",
    "paquete(?:s)?",
  ],
};

const getAmountPattern = (locale: Locale) => {
  const units = localeUnits[locale].join("|");
  return new RegExp(`(^| +)([0-9]+((.|,)[0-9])? ?(${units})?)( +|$)`, "i");
};

export type ParsedItemInput = {
  name: string;
  quantityOrUnit?: string;
};

export const parseAmount = (input: string, locale: Locale = getCurrentLocale()): string | undefined => {
  const cleanedInput = input.replace(/typ +[0-9]+/gi, "");
  const match = cleanedInput.match(getAmountPattern(locale));
  return match?.[2];
};

export const parseItemInput = (input: string, locale: Locale = getCurrentLocale()): ParsedItemInput => {
  const trimmedInput = input.trim();
  const amount = parseAmount(trimmedInput, locale);
  const name = amount ? trimmedInput.replace(amount, "").trim() : trimmedInput;
  return {
    name,
    quantityOrUnit: amount ?? undefined,
  };
};
