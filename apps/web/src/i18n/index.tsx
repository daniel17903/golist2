import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import { defaultLocale, localeStorageKey, type Locale, supportedLocales } from "./config";
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

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const locale = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentLocale,
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return { ...context, supportedLocales };
};

export { supportedLocales };
