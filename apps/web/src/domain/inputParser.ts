import type { AppLocale } from "../i18n/config";

const unitAliases: Record<AppLocale, string[]> = {
  de: ["liter", "ml", "l", "g", "kg", "kilo", "gramm", "kilogramm", "becher", "glas", "bund", "scheiben", "packung(?:en)?", "gläser", "glaeser", "stueck(?:e)?", "stück(?:e)?", "dose(?:n)?", "flasche(?:n)?", "kiste(?:n)?", "beutel(?:n)?", "tuete(?:n)?", "tüte(?:n)?"],
  en: ["liter", "liters", "ml", "l", "g", "kg", "kilo", "gram", "grams", "kilogram", "kilograms", "cup", "cups", "jar", "jars", "bunch", "bunches", "slice", "slices", "pack", "packs", "piece", "pieces", "can", "cans", "bottle", "bottles", "bag", "bags", "box", "boxes"],
  es: ["litro", "litros", "ml", "l", "g", "kg", "kilo", "gramo", "gramos", "kilogramo", "kilogramos", "taza", "tazas", "frasco", "frascos", "manojo", "manojos", "rebanada", "rebanadas", "paquete", "paquetes", "pieza", "piezas", "lata", "latas", "botella", "botellas", "bolsa", "bolsas", "caja", "cajas"],
};

const buildAmountPattern = (locale: AppLocale) => {
  const units = unitAliases[locale].join("|");
  return new RegExp(`(^| +)([0-9]+((.|,)[0-9])? ?(${units})?)( +|$)`, "i");
};

export type ParsedItemInput = {
  name: string;
  quantityOrUnit?: string;
};

export const parseAmount = (input: string, locale: AppLocale = "de"): string | undefined => {
  const cleanedInput = input.replace(/typ +[0-9]+/gi, "");
  const match = cleanedInput.match(buildAmountPattern(locale));
  return match?.[2];
};

export const parseItemInput = (input: string, locale: AppLocale = "de"): ParsedItemInput => {
  const trimmedInput = input.trim();
  const amount = parseAmount(trimmedInput, locale);
  const name = amount ? trimmedInput.replace(amount, "").trim() : trimmedInput;
  return { name, quantityOrUnit: amount ?? undefined };
};
