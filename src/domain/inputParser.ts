const amountPattern =
  "(^| +)([0-9]+((.|,)[0-9])? ?(liter|ml|l|g|kg|kilo|gramm|kilogramm|becher|glas|bund|scheiben|packung(en)?|gläser|glaeser|stueck(e)?|stück(e)?|dose(n)?|flasche(n)?|kiste(n)?|beutel(n)?|tuete(n)?|tüte(n)?|becher)?)( +|$)";

export type ParsedItemInput = {
  name: string;
  quantityOrUnit?: string;
};

export const parseAmount = (input: string): string | undefined => {
  const cleanedInput = input.replace(/typ +[0-9]+/gi, "");
  const match = cleanedInput.match(new RegExp(amountPattern, "i"));
  return match?.[2];
};

export const parseItemInput = (input: string): ParsedItemInput => {
  const trimmedInput = input.trim();
  const amount = parseAmount(trimmedInput);
  const name = amount ? trimmedInput.replace(amount, "").trim() : trimmedInput;
  return {
    name,
    quantityOrUnit: amount ?? undefined
  };
};
