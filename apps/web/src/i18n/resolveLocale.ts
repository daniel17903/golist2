import { defaultLocale, normalizeLocale, type AppLocale } from "./config";

export type LocaleResolutionInput = {
  userPreference?: string;
  urlLocale?: string;
  storedLocale?: string;
  browserLocales?: readonly string[];
  geoLocale?: string;
};

export const resolveLocale = ({
  userPreference,
  urlLocale,
  storedLocale,
  browserLocales,
  geoLocale,
}: LocaleResolutionInput): AppLocale => {
  const browserLocale = browserLocales?.map((locale) => normalizeLocale(locale)).find(Boolean);

  return (
    normalizeLocale(userPreference) ??
    normalizeLocale(urlLocale) ??
    normalizeLocale(storedLocale) ??
    browserLocale ??
    normalizeLocale(geoLocale) ??
    defaultLocale
  );
};

export const getLocaleFromUrl = (locationLike: Pick<Location, "pathname" | "search">): string | undefined => {
  const fromPath = locationLike.pathname.split("/")[1];
  if (normalizeLocale(fromPath)) {
    return fromPath;
  }

  return new URLSearchParams(locationLike.search).get("lang") ?? undefined;
};
