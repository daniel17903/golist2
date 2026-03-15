import type { Item } from "@golist/shared/domain/types";
import { getCategoryIdForItem } from "./categories";
import { defaultLocale, supportedLocales, type Locale } from "../i18n/config";

const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
const minEligibleItemCount = 2;
const handledStorageKey = "golist.languageSuggestionHandled";

export type LanguageSuggestionHandledAction = "accepted" | "dismissed";

export type LanguageSuggestionHandledState = {
  suggestedLocale: Locale;
  handledAt: number;
  action: LanguageSuggestionHandledAction;
};

export type FindLanguageSuggestionInput = {
  currentLocale: Locale;
  currentDeviceId: string;
  items: Item[];
  now?: number;
};

const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && supportedLocales.some((locale) => locale === value);

const isHandledAction = (value: unknown): value is LanguageSuggestionHandledAction =>
  value === "accepted" || value === "dismissed";

const isEligibleItem = (item: Item, currentDeviceId: string, cutoffTime: number): boolean =>
  item.deleted === false &&
  item.createdAt >= cutoffTime &&
  item.category === "other" &&
  item.createdByDeviceId === currentDeviceId;

export const findLanguageSuggestion = ({
  currentLocale,
  currentDeviceId,
  items,
  now = Date.now(),
}: FindLanguageSuggestionInput): Locale | null => {
  const cutoffTime = now - sevenDaysInMs;
  const eligibleItems = items.filter((item) => isEligibleItem(item, currentDeviceId, cutoffTime));

  if (eligibleItems.length < minEligibleItemCount) {
    return null;
  }

  const candidateLocales = supportedLocales.filter((locale) => locale !== currentLocale);

  for (const candidateLocale of candidateLocales) {
    const allItemsResolve = eligibleItems.every((item) => {
      const category = getCategoryIdForItem(item.name, candidateLocale);
      return Boolean(category && category !== "other");
    });

    if (allItemsResolve) {
      return candidateLocale;
    }
  }

  return null;
};

export const getLanguageSuggestionHandledState = (): LanguageSuggestionHandledState | null => {
  const raw = localStorage.getItem(handledStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const suggestedLocale = Reflect.get(parsed, "suggestedLocale");
    const handledAt = Reflect.get(parsed, "handledAt");
    const action = Reflect.get(parsed, "action");

    if (
      !isLocale(suggestedLocale ?? defaultLocale) ||
      typeof handledAt !== "number" ||
      !isHandledAction(action)
    ) {
      return null;
    }

    return {
      suggestedLocale: suggestedLocale ?? defaultLocale,
      handledAt,
      action,
    };
  } catch {
    return null;
  }
};

export const isLanguageSuggestionHandled = (): boolean =>
  localStorage.getItem(handledStorageKey) !== null;

export const markLanguageSuggestionHandled = (
  state: Omit<LanguageSuggestionHandledState, "handledAt"> & { handledAt?: number },
): void => {
  const payload: LanguageSuggestionHandledState = {
    ...state,
    handledAt: state.handledAt ?? Date.now(),
  };

  localStorage.setItem(handledStorageKey, JSON.stringify(payload));
};
