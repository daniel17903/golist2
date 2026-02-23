import { defaultLocale, localeStorageKey, type Locale } from "./config";
import { resources } from "./resources";
import { getLocaleFromUrl, resolveLocale } from "./resolveLocale";

let currentLocale: Locale = defaultLocale;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const interpolate = (template: string, params?: Record<string, string | number>): string => {
  if (!params) {return template;}
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ""));
};

export const t = (key: string, params?: Record<string, string | number>): string => {
  const value = resources[currentLocale][key] ?? resources.en[key] ?? key;
  return interpolate(value, params);
};

export const getCurrentLocale = (): Locale => currentLocale;

export const subscribeToLocale = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setLocale = (locale: Locale, persist = true) => {
  currentLocale = locale;
  if (persist) {
    localStorage.setItem(localeStorageKey, locale);
  }
  emit();
};

export const initializeLocale = () => {
  const resolved = resolveLocale({
    urlLocale: getLocaleFromUrl(window.location.href),
    storedLocale: localStorage.getItem(localeStorageKey),
    browserLocales: navigator.languages,
  });
  currentLocale = resolved;
};
