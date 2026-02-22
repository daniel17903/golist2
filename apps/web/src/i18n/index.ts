import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLocale, storedLocaleKey } from "./config";
import { getLocaleFromUrl, resolveLocale } from "./resolveLocale";
import en from "./resources/en.json";
import de from "./resources/de.json";
import es from "./resources/es.json";

const initialLocale = resolveLocale({
  urlLocale: getLocaleFromUrl(window.location),
  storedLocale: localStorage.getItem(storedLocaleKey) ?? undefined,
  browserLocales: navigator.languages,
});

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    es: { translation: es },
  },
  lng: initialLocale,
  fallbackLng: defaultLocale,
  interpolation: {
    escapeValue: false,
  },
});

document.documentElement.lang = initialLocale;

export default i18n;
