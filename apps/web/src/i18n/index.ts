import { useMemo, useSyncExternalStore } from "react";
import { defaultLocale, explicitLanguageStorageKey, storedLocaleStorageKey, type Locale } from "./config";
import { readUrlLocale, resolveLocale } from "./resolveLocale";
import { resources } from "./resources";

type Listener = () => void;

let currentLocale: Locale = defaultLocale;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const normalizeTemplate = (template: string, values?: Record<string, string | number>) => {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
};

export const setLocale = (locale: Locale) => {
  currentLocale = locale;
  localStorage.setItem(storedLocaleStorageKey, locale);
  document.documentElement.lang = locale;
  notify();
};

export const setExplicitLanguagePreference = (locale: Locale | undefined) => {
  if (!locale) {
    localStorage.removeItem(explicitLanguageStorageKey);
    return;
  }
  localStorage.setItem(explicitLanguageStorageKey, locale);
};

export const getLocale = (): Locale => currentLocale;

export const t = (key: string, values?: Record<string, string | number>): string => {
  const template = resources[currentLocale][key] ?? resources.en[key] ?? key;
  return normalizeTemplate(template, values);
};

export const initI18n = () => {
  const url = new URL(window.location.href);
  const resolvedLocale = resolveLocale({
    userPreference: localStorage.getItem(explicitLanguageStorageKey),
    urlLocale: readUrlLocale(url),
    storedLocale: localStorage.getItem(storedLocaleStorageKey),
    browserLocales: navigator.languages,
  });
  currentLocale = resolvedLocale;
  localStorage.setItem(storedLocaleStorageKey, resolvedLocale);
  document.documentElement.lang = resolvedLocale;
};

export const setLanguagePreference = (nextLocale: Locale) => {
  setExplicitLanguagePreference(nextLocale);
  setLocale(nextLocale);
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useI18n = () => {
  const locale = useSyncExternalStore(subscribe, () => currentLocale);

  return useMemo(
    () => ({
      locale,
      t,
      setLanguagePreference,
    }),
    [locale],
  );
};
