export const supportedLocales = ["en", "de", "es"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";

export const localeStorageKey = "golist.locale";
