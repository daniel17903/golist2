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

export type LanguageSuggestion = {
  suggestedLocale: Locale;
  itemUpdates: Array<{
    itemId: string;
    category: string;
  }>;
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
}: FindLanguageSuggestionInput): LanguageSuggestion | null => {
  const cutoffTime = now - sevenDaysInMs;
  const eligibleItems = items.filter((item) => isEligibleItem(item, currentDeviceId, cutoffTime));

  if (eligibleItems.length < minEligibleItemCount) {
    return null;
  }

  const candidateLocales = supportedLocales.filter((locale) => locale !== currentLocale);

  for (const candidateLocale of candidateLocales) {
    const itemUpdates = eligibleItems.map((item) => {
      const category = getCategoryIdForItem(item.name, candidateLocale);
      if (!category || category === "other") {
        return null;
      }

      return {
        itemId: item.id,
        category,
      };
    });

    const allItemsResolve = itemUpdates.every((update) => update !== null);

    if (allItemsResolve) {
      return {
        suggestedLocale: candidateLocale,
        itemUpdates: itemUpdates.filter((update): update is { itemId: string; category: string } => update !== null),
      };
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
