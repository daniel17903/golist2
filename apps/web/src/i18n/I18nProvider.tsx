import type { ReactNode } from "react";
import { useMemo, useSyncExternalStore } from "react";
import { I18nContext } from "./context";
import { getCurrentLocale, setLocale, subscribeToLocale, t } from "./runtime";

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const locale = useSyncExternalStore(subscribeToLocale, getCurrentLocale);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
