import {
  categoryOrderById,
  getCategoryIdForItemName,
  getIconNameForItemName,
} from "@golist/shared/domain/item-category-mapping";
import { getLocale } from "../i18n";
import type { Locale } from "../i18n/config";

export { categoryOrderById };

const iconBasePath = "/icons";
const defaultIconName = "default";
const buildIconPath = (iconName: string) => `${iconBasePath}/${iconName}.svg`;

export const getCategoryIdForItem = (name: string, locale: Locale = getLocale()): string | undefined =>
  getCategoryIdForItemName(name, locale);

export const getItemIconName = (name: string, locale: Locale = getLocale()): string | undefined =>
  getIconNameForItemName(name, locale);

export const getItemIcon = (name: string, locale: Locale = getLocale()): string => {
  const iconName = getItemIconName(name, locale) ?? defaultIconName;
  return buildIconPath(iconName);
};

export const getListItemIcon = (iconName?: string): string =>
  buildIconPath(iconName ?? defaultIconName);
