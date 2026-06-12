import { useCallback, useMemo, useState } from "react";
import type { Item } from "@golist/shared/domain/types";
import {
  findLanguageSuggestion,
  isLanguageSuggestionHandled,
  markLanguageSuggestionHandled,
} from "../domain/languageSuggestion";
import { useStore } from "../state/useStore";
import { useI18n } from "../i18n";

// Store actions are stable references — select them once at module scope.
const { recategorizeSuggestedItems } = useStore.getState();

type LanguageSuggestionOptions = {
  items: Item[];
  deviceId: string | undefined;
  isLoaded: boolean;
};

// Detects when recently added items match another supported language better
// than the current locale and offers to switch (recategorizing those items).
export const useLanguageSuggestion = ({ items, deviceId, isLoaded }: LanguageSuggestionOptions) => {
  const { locale, setLanguagePreference } = useI18n();
  const [dismissedLocale, setDismissedLocale] = useState<string | null>(null);

  const suggestion = useMemo(() => {
    if (!isLoaded || !deviceId || isLanguageSuggestionHandled()) {
      return null;
    }

    return findLanguageSuggestion({
      currentLocale: locale,
      currentDeviceId: deviceId,
      items,
    });
  }, [deviceId, isLoaded, items, locale]);

  const languageSuggestion =
    suggestion && dismissedLocale !== suggestion.suggestedLocale ? suggestion : null;

  const acceptLanguageSuggestion = useCallback(() => {
    if (!languageSuggestion) {
      return;
    }

    void (async () => {
      setLanguagePreference(languageSuggestion.suggestedLocale);
      await recategorizeSuggestedItems(languageSuggestion.itemUpdates, languageSuggestion.suggestedLocale);
      markLanguageSuggestionHandled({
        suggestedLocale: languageSuggestion.suggestedLocale,
        action: "accepted",
      });
      setDismissedLocale(languageSuggestion.suggestedLocale);
    })();
  }, [languageSuggestion, setLanguagePreference]);

  const dismissLanguageSuggestion = useCallback(() => {
    if (!languageSuggestion) {
      return;
    }

    markLanguageSuggestionHandled({
      suggestedLocale: languageSuggestion.suggestedLocale,
      action: "dismissed",
    });
    setDismissedLocale(languageSuggestion.suggestedLocale);
  }, [languageSuggestion]);

  return { languageSuggestion, acceptLanguageSuggestion, dismissLanguageSuggestion };
};
