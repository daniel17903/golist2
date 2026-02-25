import { defaultLocale, type Locale, supportedLocales } from "./config";

type LocaleCandidates = {
  userPreference?: string | null;
  urlLocale?: string | null;
  storedLocale?: string | null;
  browserLocales?: readonly string[];
  geoLocale?: string | null;
};

const normalizeLocale = (value?: string | null): Locale | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace("_", "-");
  const [baseCode] = normalized.split("-");
  if (!baseCode) {
    return undefined;
  }

  return supportedLocales.find((locale) => locale === baseCode);
};

export const resolveLocale = ({
  userPreference,
  urlLocale,
  storedLocale,
  browserLocales,
  geoLocale,
}: LocaleCandidates): Locale => {
  return (
    normalizeLocale(userPreference) ??
    normalizeLocale(urlLocale) ??
    normalizeLocale(storedLocale) ??
    browserLocales?.map((locale) => normalizeLocale(locale)).find((locale): locale is Locale => Boolean(locale)) ??
    normalizeLocale(geoLocale) ??
    defaultLocale
  );
};

export const readUrlLocale = (url: URL): string | undefined => {
  const queryLocale = url.searchParams.get("lang");
  if (queryLocale) {
    return queryLocale;
  }

  const [firstSegment] = url.pathname.split("/").filter(Boolean);
  return firstSegment;
};
