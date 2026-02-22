export const supportedLocales = ["en", "de", "es"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en";

export const storedLocaleKey = "golist.locale";

export const normalizeLocale = (value?: string | null): AppLocale | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase().trim();
  const base = normalized.split(/[-_]/)[0];
  return supportedLocales.find((locale) => locale === base);
};
