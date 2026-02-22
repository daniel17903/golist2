import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseItemInput } from "../domain/inputParser";
import { sortItemsForList } from "../domain/sort";
import { normalizeLocale, storedLocaleKey } from "../i18n/config";
import { getLocaleFromUrl, resolveLocale } from "../i18n/resolveLocale";
import { useStore } from "../state/useStore";

export const useAppState = () => {
  const { t, i18n } = useTranslation();
  const {
    lists,
    items,
    activeListId,
    isLoaded,
    load,
    addList,
    renameList,
    setActiveList,
    addItem,
    toggleItem,
    updateItem,
    deleteList,
    ensureShareToken,
    joinSharedList,
    syncAllLists,
    backendConnection,
    syncNotice,
    clearSyncNotice,
    backendLogs,
    languagePreference,
    setLanguagePreference,
  } = useStore();

  const [newListName, setNewListName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [itemName, setItemName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQuantity, setEditItemQuantity] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [createListName, setCreateListName] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const locale = resolveLocale({
      userPreference: languagePreference,
      urlLocale: getLocaleFromUrl(window.location),
      storedLocale: localStorage.getItem(storedLocaleKey) ?? undefined,
      browserLocales: navigator.languages,
    });

    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }

    document.documentElement.lang = locale;
  }, [i18n, languagePreference]);

  useEffect(() => {
    if (isLoaded && lists.length === 0) {
      void addList(t("app.defaultListName"));
    }
  }, [isLoaded, lists.length, addList, t]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const shareTokenFromUrl = new URLSearchParams(window.location.search).get("shareToken");
    if (!shareTokenFromUrl) {
      return;
    }

    void (async () => {
      try {
        await joinSharedList(shareTokenFromUrl);
      } catch {
        window.alert(t("errors.openSharedLink"));
      } finally {
        const cleanedUrl = new URL(window.location.href);
        cleanedUrl.searchParams.delete("shareToken");
        window.history.replaceState({}, "", cleanedUrl.toString());
      }
    })();
  }, [isLoaded, joinSharedList, t]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const interval = window.setInterval(() => {
      void syncAllLists();
    }, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncAllLists();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onVisibilityChange);
    };
  }, [isLoaded, syncAllLists]);

  const activeList = lists.find((list) => list.id === activeListId) ?? null;
  const listItems = useMemo(() => {
    const filtered = items.filter((item) => item.listId === activeListId && !item.deleted);
    return sortItemsForList(filtered);
  }, [items, activeListId]);

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
    listItems.forEach((item) => {
      const key = item.name.trim().toLowerCase();
      if (key) {
        names.add(key);
      }
    });
    return names;
  }, [listItems]);

  const suggestions = useMemo(() => {
    const trimmed = itemName.trim();
    const query = trimmed.toLowerCase();
    const sorted = suggestionPool
      .slice()
      .sort((a, b) => {
        if (a.count !== b.count) {return b.count - a.count;}
        return b.lastUsed - a.lastUsed;
      })
      .map((entry) => entry.name)
      .filter((name) => !currentItemNames.has(name.trim().toLowerCase()));
    if (!query) {return sorted.slice(0, 12);}
    const filtered = sorted.filter((name) => name.toLowerCase().includes(query));
    if (trimmed && !currentItemNames.has(query)) {
      const alreadySuggested = filtered.some((name) => name.toLowerCase() === query);
      if (!alreadySuggested) {
        filtered.unshift(trimmed);
      }
    }
    return filtered.slice(0, 12);
  }, [itemName, suggestionPool, currentItemNames]);

  const parseLocale = normalizeLocale(i18n.language) ?? "en";

  const handleAddItem = async () => {
    if (!activeListId) {return;}
    const parsed = parseItemInput(itemName, parseLocale);
    if (!parsed.name.trim()) {return;}
    await addItem(activeListId, parsed.name, parsed.quantityOrUnit);
    setItemName("");
    setIsAddDialogOpen(false);
  };

  const handleAddSuggestion = async (name: string, quantityOrUnit?: string) => {
    if (!activeListId) {return;}
    if (!name.trim()) {return;}
    await addItem(activeListId, name, quantityOrUnit);
    setItemName("");
    setIsAddDialogOpen(false);
  };

  const handleRenameList = async () => {
    if (!activeListId) {return;}
    const trimmed = newListName.trim();
    if (!trimmed) {return;}
    await renameList(activeListId, trimmed);
    setEditingTitle(false);
  };

  const openEditItem = (itemId: string, name: string, quantityOrUnit?: string) => {
    setEditingItemId(itemId);
    setEditItemName(name);
    setEditItemQuantity(quantityOrUnit ?? "");
  };

  const handleSaveItem = async () => {
    if (!editingItemId) {return;}
    const trimmed = editItemName.trim();
    if (!trimmed) {return;}
    await updateItem(
      editingItemId,
      trimmed,
      editItemQuantity.trim() ? editItemQuantity.trim() : undefined,
    );
    setEditingItemId(null);
  };

  const openAddDialog = () => {
    setIsAddDialogOpen(true);
  };

  const handleCreateList = () => {
    setCreateListName("");
    setIsDrawerOpen(false);
    setIsCreateListModalOpen(true);
  };

  const handleConfirmCreateList = async () => {
    const trimmedName = createListName.trim();
    if (!trimmedName) {
      return;
    }

    await addList(trimmedName);
    setCreateListName("");
    setIsCreateListModalOpen(false);
    setIsDrawerOpen(false);
  };

  const handleDeleteList = async (listId: string) => {
    await deleteList(listId);
    setIsDrawerOpen(false);
  };

  const handleShareActiveList = async () => {
    if (!activeListId) {
      throw new Error(t("errors.noActiveList"));
    }
    const token = await ensureShareToken(activeListId);
    return `${window.location.origin}/?shareToken=${token}`;
  };

  const handleLanguagePreferenceChange = (locale: string) => {
    setLanguagePreference(locale);
    localStorage.setItem(storedLocaleKey, locale);
  };

  return {
    lists,
    items,
    activeListId,
    activeList,
    listItems,
    suggestions,
    newListName,
    editingTitle,
    itemName,
    editingItemId,
    editItemName,
    editItemQuantity,
    isDrawerOpen,
    isAddDialogOpen,
    isCreateListModalOpen,
    createListName,
    setNewListName,
    setEditingTitle,
    setItemName,
    setEditingItemId,
    setEditItemName,
    setEditItemQuantity,
    setIsDrawerOpen,
    setIsAddDialogOpen,
    setIsCreateListModalOpen,
    setCreateListName,
    setActiveList,
    toggleItem,
    openEditItem,
    handleAddItem,
    handleAddSuggestion,
    handleRenameList,
    handleSaveItem,
    openAddDialog,
    handleCreateList,
    handleConfirmCreateList,
    handleDeleteList,
    handleShareActiveList,
    joinSharedList,
    backendConnection,
    syncNotice,
    clearSyncNotice,
    backendLogs,
    languagePreference,
    handleLanguagePreferenceChange,
  };
};
