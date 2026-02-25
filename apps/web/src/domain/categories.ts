import {
  categoryEntriesByLanguage,
  categoryOrderById,
  getCategoryIdForItemName,
} from "@golist/shared/domain/item-category-mapping";
import { getLocale } from "../i18n";
import type { Locale } from "../i18n/config";

export { categoryOrderById };

const iconBasePath = "/icons";
const defaultIconName = "default";
const buildIconPath = (iconName: string) => `${iconBasePath}/${iconName}.svg`;

const itemAssetMapByLocale: Record<Locale, Map<string, string>> = {
  en: new Map(),
  de: new Map(),
  es: new Map(),
};

const itemAssetMapAllLocales = new Map<string, string>();

(["en", "de", "es"] as const).forEach((locale) => {
  categoryEntriesByLanguage[locale].forEach((entry) => {
    entry.matchingNames.forEach((name) => {
      const key = name.trim().toLowerCase();
      if (!key) {
        return;
      }
      if (!itemAssetMapByLocale[locale].has(key)) {
        itemAssetMapByLocale[locale].set(key, entry.assetFileName);
      }
      if (!itemAssetMapAllLocales.has(key)) {
        itemAssetMapAllLocales.set(key, entry.assetFileName);
      }
    });
  });
});

export const getCategoryIdForItem = (name: string, locale: Locale = getLocale()): string | undefined =>
  getCategoryIdForItemName(name, locale);

const categoryIconById = (() => {
  const map = new Map<string, string>();
  categoryEntriesByLanguage.de.forEach((entry) => {
    if (!map.has(entry.category)) {
      map.set(entry.category, entry.assetFileName);
    }
  });

  return map;
})();

export const getItemIconForCategory = (categoryId: string): string => {
  const iconName = categoryIconById.get(categoryId) ?? defaultIconName;
  return buildIconPath(iconName);
};

export const getItemIcon = (name: string, locale: Locale = getLocale()): string => {
  const key = name.trim().toLowerCase();
  const asset = itemAssetMapByLocale[locale].get(key);
  if (asset) {
    return buildIconPath(asset);
  }
  return buildIconPath(defaultIconName);
};

export const getListItemIcon = (name: string, categoryId: string): string => {
  const key = name.trim().toLowerCase();
  const asset = itemAssetMapAllLocales.get(key);
  if (asset) {
    return buildIconPath(asset);
  }

  return getItemIconForCategory(categoryId);
};
