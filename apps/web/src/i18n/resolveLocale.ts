import { defaultLocale, type Locale, supportedLocales } from "./config";

type ResolveLocaleOptions = {
  userPreference?: string | null;
  urlLocale?: string | null;
  storedLocale?: string | null;
  browserLocales?: readonly string[];
  geoLocale?: string | null;
};

const normalizeLocale = (value?: string | null): Locale | null => {
  if (!value) {return null;}
  const lower = value.toLowerCase();
  const base = lower.split(/[-_]/)[0];
  return supportedLocales.find((locale) => locale === base) ?? null;
};

export const resolveLocale = ({
  userPreference,
  urlLocale,
  storedLocale,
  browserLocales,
  geoLocale,
}: ResolveLocaleOptions): Locale => {
  const fromBrowser = browserLocales?.map((entry) => normalizeLocale(entry)).find(Boolean) ?? null;

  return (
    normalizeLocale(userPreference) ??
    normalizeLocale(urlLocale) ??
    normalizeLocale(storedLocale) ??
    fromBrowser ??
    normalizeLocale(geoLocale) ??
    defaultLocale
  );
};

export const getLocaleFromUrl = (url: string): Locale | null => {
  try {
    const parsed = new URL(url);
    const fromQuery = normalizeLocale(parsed.searchParams.get("lang"));
    if (fromQuery) {return fromQuery;}
    const firstPathSegment = parsed.pathname.split("/").filter(Boolean)[0];
    return normalizeLocale(firstPathSegment);
  } catch {
    return null;
  }
};
