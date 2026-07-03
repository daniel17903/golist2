import { useCallback, useMemo, useState } from "react";
import { parseItemInput } from "../domain/inputParser";
import { useStore } from "../state/useStore";
import { useI18n } from "../i18n";
import type { PopupId } from "./usePopupStack";

// Store actions are stable references — select them once at module scope.
const { addItem } = useStore.getState();

const MAX_SUGGESTIONS = 12;

type AddItemDialogOptions = {
  openPopup: (id: PopupId) => void;
  closePopup: (id: PopupId) => void;
};

export const useAddItemDialog = ({ openPopup, closePopup }: AddItemDialogOptions) => {
  const { locale } = useI18n();
  const items = useStore((s) => s.items);
  const activeListId = useStore((s) => s.activeListId);
  const [itemName, setItemName] = useState("");

  const suggestionPool = useMemo(() => {
    if (!activeListId) {return [];}
    const stats = new Map<string, { count: number; lastUsed: number }>();
    items
      .filter((item) => item.listId === activeListId)
      .forEach((item) => {
        const key = item.name.trim();
        if (!key) {return;}
        const existing = stats.get(key) ?? { count: 0, lastUsed: 0 };
        stats.set(key, {
          count: existing.count + 1,
          lastUsed: Math.max(existing.lastUsed, item.updatedAt),
        });
      });
    return Array.from(stats.entries()).map(([name, data]) => ({ name, ...data }));
  }, [items, activeListId]);

  const currentItemNames = useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => {
      if (item.listId !== activeListId || item.deleted) {
        return;
      }
      const key = item.name.trim().toLowerCase();
      if (key) {
        names.add(key);
      }
    });
    return names;
  }, [items, activeListId]);

  // Ranking only depends on the pool, so it is memoized separately from the
  // per-keystroke query filtering below.
  const rankedSuggestionNames = useMemo(
    () =>
      suggestionPool
        .slice()
        .sort((a, b) => {
          if (a.count !== b.count) {return b.count - a.count;}
          return b.lastUsed - a.lastUsed;
        })
        .map((entry) => entry.name)
        .filter((name) => !currentItemNames.has(name.trim().toLowerCase())),
    [suggestionPool, currentItemNames],
  );

  const suggestions = useMemo(() => {
    const trimmed = itemName.trim();
    const query = trimmed.toLowerCase();
    if (!query) {return rankedSuggestionNames.slice(0, MAX_SUGGESTIONS);}
    const filtered = rankedSuggestionNames.filter((name) => name.toLowerCase().includes(query));
    if (trimmed && !currentItemNames.has(query)) {
      const alreadySuggested = filtered.some((name) => name.toLowerCase() === query);
      if (!alreadySuggested) {
        filtered.unshift(trimmed);
      }
    }
    return filtered.slice(0, MAX_SUGGESTIONS);
  }, [itemName, rankedSuggestionNames, currentItemNames]);

  const duplicatePreview = useMemo(() => {
    const parsed = parseItemInput(itemName, locale);
    const trimmedName = parsed.name.trim();
    if (!trimmedName) {
      return null;
    }
    if (!currentItemNames.has(trimmedName.toLowerCase())) {
      return null;
    }
    return {
      name: trimmedName,
      quantityOrUnit: parsed.quantityOrUnit,
    };
  }, [itemName, locale, currentItemNames]);

  const openAddDialog = useCallback(() => {
    // Always start from a clean slate: closing the dialog via backdrop click
    // (closeAddDialog below) does not clear itemName, so without this reset
    // reopening would show stale leftover text and stale derived
    // suggestions/duplicatePreview from the previous session.
    setItemName("");
    openPopup("add-item");
  }, [openPopup]);

  const closeAddDialog = useCallback(() => {
    closePopup("add-item");
  }, [closePopup]);

  const handleAddItem = useCallback(async () => {
    if (!activeListId) {return;}
    const parsed = parseItemInput(itemName, locale);
    if (!parsed.name.trim()) {return;}
    await addItem(activeListId, parsed.name, parsed.quantityOrUnit);
    setItemName("");
    closePopup("add-item");
  }, [activeListId, itemName, locale, closePopup]);

  const handleAddSuggestion = useCallback(async (name: string, quantityOrUnit?: string) => {
    if (!activeListId) {return;}
    if (!name.trim()) {return;}
    await addItem(activeListId, name, quantityOrUnit);
    setItemName("");
    closePopup("add-item");
  }, [activeListId, closePopup]);

  return {
    itemName,
    setItemName,
    suggestions,
    duplicatePreview,
    openAddDialog,
    closeAddDialog,
    handleAddItem,
    handleAddSuggestion,
  };
};
