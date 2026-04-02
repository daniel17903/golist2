import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@golist/shared/domain/types";
import AppHeader from "./components/AppHeader";
import BottomBar from "./components/BottomBar";
import AddItemDialog from "./components/AddItemDialog";
import EditItemModal from "./components/EditItemModal";
import ItemGrid from "./components/ItemGrid";
import ListsDrawer from "./components/ListsDrawer";
import CreateListModal from "./components/CreateListModal";
import BackendLogPanel from "./components/BackendLogPanel";
import LanguageSuggestionModal from "./components/LanguageSuggestionModal";

const JoinListModal = lazy(() => import("./components/JoinListModal"));
const SettingsModal = lazy(() => import("./components/SettingsModal"));
const LegalModal = lazy(() => import("./components/LegalModal"));
const ListStatsModal = lazy(() => import("./components/ListStatsModal"));
import { useAppState } from "./hooks/useAppState";
import { useLongPressItem } from "./hooks/useLongPressItem";
import { useKeyboardInset } from "./hooks/useKeyboardInset";
import { useI18n } from "./i18n";
import { calculateListStats } from "./domain/listStats";
import {
  findLanguageSuggestion,
  isLanguageSuggestionHandled,
  markLanguageSuggestionHandled,
} from "./domain/languageSuggestion";

type UndoDeleteToast = {
  id: string;
  kind: "item-delete";
  item: Item;
};

type UndoRenameToast = {
  id: string;
  kind: "list-rename";
  listId: string;
  previousName: string;
  nextName: string;
};

type UndoToast = UndoDeleteToast | UndoRenameToast;

type AppToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

type LegalModalType = "imprint" | "privacy";
const MAX_UNDO_TOASTS = 3;

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
};

const App = () => {
  const { t, locale, setLanguagePreference } = useI18n();
  const [dismissedLanguageSuggestionLocale, setDismissedLanguageSuggestionLocale] = useState<string | null>(null);

  useKeyboardInset();

  const {
    lists,
    items,
    activeListId,
    activeList,
    listItems,
    suggestions,
    duplicatePreview,
    newListName,
    editingTitle,
    itemName,
    editingItemId,
    editItemName,
    editItemQuantity,
    isDrawerOpen,
    isAddDialogOpen,
    isCreateListModalOpen,
    isJoinListModalOpen,
    createListName,
    joinListValue,
    backendBusyRequests,
    backendSharingEnabled,
    refreshRealtimeConnection,
    setNewListName,
    setEditingTitle,
    setItemName,
    setEditingItemId,
    setEditItemName,
    setEditItemQuantity,
    setIsDrawerOpen,
    setIsAddDialogOpen,
    setIsCreateListModalOpen,
    setIsJoinListModalOpen,
    setCreateListName,
    setJoinListValue,
    setActiveList,
    renameList,
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
    handleOpenJoinList,
    handleJoinList,
    handleShareActiveList,
    backendConnection,
    isLoaded,
    deviceId,
    recategorizeSuggestedItems,
  } = useAppState();

  const undoTimeoutsRef = useRef<Map<string, number>>(new Map());
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const [appToasts, setAppToasts] = useState<AppToast[]>([]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isListStatsOpen, setIsListStatsOpen] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalType | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const suppressItemPressRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const pullRefreshStartedAtRef = useRef<number | null>(null);
  const isPopupOpen =
    isDrawerOpen ||
    isAddDialogOpen ||
    isCreateListModalOpen ||
    isJoinListModalOpen ||
    isSettingsModalOpen ||
    isListStatsOpen ||
    activeLegalModal !== null ||
    Boolean(editingItemId);

  const languageSuggestion = useMemo(() => {
    if (!isLoaded || !deviceId || isLanguageSuggestionHandled()) {
      return null;
    }

    return findLanguageSuggestion({
      currentLocale: locale,
      currentDeviceId: deviceId,
      items,
    });
  }, [deviceId, isLoaded, items, locale]);

  const handleAcceptLanguageSuggestion = useCallback(async () => {
    if (!languageSuggestion) {
      return;
    }

    setLanguagePreference(languageSuggestion.suggestedLocale);
    await recategorizeSuggestedItems(languageSuggestion.itemUpdates, languageSuggestion.suggestedLocale);
    markLanguageSuggestionHandled({
      suggestedLocale: languageSuggestion.suggestedLocale,
      action: "accepted",
    });
    setDismissedLanguageSuggestionLocale(languageSuggestion.suggestedLocale);
  }, [languageSuggestion, recategorizeSuggestedItems, setLanguagePreference]);

  const handleDismissLanguageSuggestion = useCallback(() => {
    if (!languageSuggestion) {
      return;
    }

    markLanguageSuggestionHandled({
      suggestedLocale: languageSuggestion.suggestedLocale,
      action: "dismissed",
    });
    setDismissedLanguageSuggestionLocale(languageSuggestion.suggestedLocale);
  }, [languageSuggestion]);

  const listStats = useMemo(() => calculateListStats(items, activeListId), [items, activeListId]);

  const listMetaById = useMemo(() => {
    const updatedAtByList = new Map<string, number>();

    for (const list of lists) {
      updatedAtByList.set(list.id, list.updatedAt);
    }

    for (const item of items) {
      updatedAtByList.set(item.listId, Math.max(updatedAtByList.get(item.listId) ?? 0, item.updatedAt));
    }

    return Object.fromEntries(
      lists.map((list) => [
        list.id,
        {
          lastUpdatedAt: updatedAtByList.get(list.id) ?? list.updatedAt,
        },
      ]),
    );
  }, [lists, items]);

  const clearUndoTimeout = useCallback((toastId: string) => {
    const timeout = undoTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      undoTimeoutsRef.current.delete(toastId);
    }
  }, []);

  const clearAppToastTimeout = useCallback((toastId: string) => {
    const timeout = toastTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      toastTimeoutsRef.current.delete(toastId);
    }
  }, []);

  const removeUndoToast = useCallback((toastId: string) => {
    clearUndoTimeout(toastId);
    setUndoToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, [clearUndoTimeout]);

  const removeAppToast = useCallback((toastId: string) => {
    clearAppToastTimeout(toastId);
    setAppToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, [clearAppToastTimeout]);

  const enqueueUndoToast = useCallback((nextToast: UndoToast, options?: { replaceRenameForListId?: string }) => {
    setUndoToasts((current) => {
      const nextQueue = options?.replaceRenameForListId
        ? current.filter((toast) => {
            const shouldRemove = toast.kind === "list-rename" && toast.listId === options.replaceRenameForListId;
            if (shouldRemove) {
              clearUndoTimeout(toast.id);
            }
            return !shouldRemove;
          })
        : current;
      const queueWithNext = [...nextQueue, nextToast];

      if (queueWithNext.length <= MAX_UNDO_TOASTS) {
        return queueWithNext;
      }

      const overflow = queueWithNext.length - MAX_UNDO_TOASTS;
      const removedToasts = queueWithNext.slice(0, overflow);
      removedToasts.forEach((toast) => clearUndoTimeout(toast.id));
      return queueWithNext.slice(overflow);
    });
  }, [clearUndoTimeout]);

  const pushAppToast = useCallback((message: string, tone: "success" | "error") => {
    const toastId = crypto.randomUUID();
    setAppToasts((current) => [...current, { id: toastId, message, tone }]);
    const timeout = window.setTimeout(() => {
      removeAppToast(toastId);
    }, 4500);
    toastTimeoutsRef.current.set(toastId, timeout);
  }, [removeAppToast]);

  const showUndoDelete = useCallback((item: Item) => {
    const toastId = crypto.randomUUID();
    enqueueUndoToast({ id: toastId, kind: "item-delete", item });
    const timeout = window.setTimeout(() => {
      removeUndoToast(toastId);
    }, 5000);
    undoTimeoutsRef.current.set(toastId, timeout);
  }, [enqueueUndoToast, removeUndoToast]);

  const showUndoRename = useCallback((listId: string, previousName: string, nextName: string) => {
    const toastId = crypto.randomUUID();
    enqueueUndoToast(
      { id: toastId, kind: "list-rename", listId, previousName, nextName },
      { replaceRenameForListId: listId },
    );
    const timeout = window.setTimeout(() => {
      removeUndoToast(toastId);
    }, 5000);
    undoTimeoutsRef.current.set(toastId, timeout);
  }, [enqueueUndoToast, removeUndoToast]);

  useEffect(
    () => () => {
      undoTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      undoTimeoutsRef.current.clear();
      toastTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      toastTimeoutsRef.current.clear();
    },
    [],
  );

  const exitingItemIdsRef = useRef(exitingItemIds);
  useEffect(() => { exitingItemIdsRef.current = exitingItemIds; });

  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; });

  const handleToggleItem = useCallback(async (itemId: string) => {
    if (exitingItemIdsRef.current.has(itemId)) {return;}
    const itemToDelete = itemsRef.current.find((item) => item.id === itemId);
    if (!itemToDelete) {return;}

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await toggleItem(itemId);
      showUndoDelete(itemToDelete);
      return;
    }
    setExitingItemIds((current) => new Set(current).add(itemId));
  }, [toggleItem, showUndoDelete]);

  const handleExitComplete = useCallback(async (itemId: string) => {
    if (!exitingItemIdsRef.current.has(itemId)) {return;}
    const deletedItem = itemsRef.current.find((item) => item.id === itemId);
    await toggleItem(itemId);
    if (deletedItem) {
      showUndoDelete(deletedItem);
    }
    setExitingItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }, [toggleItem, showUndoDelete]);

  const pullDistanceRef = useRef(pullDistance);
  useEffect(() => { pullDistanceRef.current = pullDistance; });

  const activeListRef = useRef(activeList);
  useEffect(() => { activeListRef.current = activeList; });

  const shareWithSystemSheet = useCallback(async (shareLink: string): Promise<boolean> => {
    if (typeof navigator.share !== "function") {
      return false;
    }

    const sharePayload: ShareData = {
      title: activeListRef.current?.name ?? "GoList",
      text: t("share.text"),
      url: shareLink,
    };

    if (typeof navigator.canShare === "function" && !navigator.canShare(sharePayload)) {
      return false;
    }

    await navigator.share(sharePayload);
    return true;
  }, [t]);

  const handleUndoDelete = useCallback(async (toastId: string, itemId: string) => {
    removeUndoToast(toastId);
    await toggleItem(itemId);
  }, [removeUndoToast, toggleItem]);

  const handleUndoRename = useCallback(async (toastId: string, listId: string, previousName: string) => {
    removeUndoToast(toastId);
    await renameList(listId, previousName);
    if (activeListId === listId) {
      setNewListName(previousName);
    }
  }, [removeUndoToast, renameList, activeListId, setNewListName]);

  const {
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    longPressTriggeredRef,
    pressedItemId,
  } = useLongPressItem({
    onLongPress: openEditItem,
    onShortPress: handleToggleItem,
  });

  const showBackendLogs = __ENVIRONMENT__ !== "production";

  useEffect(() => {
    const getHistoryState = (): Record<string, unknown> => {
      const { state } = window.history;
      return typeof state === "object" && state !== null ? state : {};
    };

    const historyState = getHistoryState();
    if (historyState.golistBackBlocked !== true) {
      window.history.pushState({ ...historyState, golistBackBlocked: true }, "");
    }

    const handlePopState = () => {
      window.history.pushState({ ...getHistoryState(), golistBackBlocked: true }, "");
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const pullThreshold = 72;
    const pullSuppressionThreshold = 10;
    const maxPull = 96;
    const getScrollY = () => document.body.scrollTop || window.scrollY || document.scrollingElement?.scrollTop || 0;

    const onTouchStart = (event: TouchEvent) => {
      suppressItemPressRef.current = false;
      if (isPopupOpen || isPullRefreshing || event.touches.length !== 1 || getScrollY() > 0) {
        pullStartYRef.current = null;
        return;
      }

      pullStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (pullStartYRef.current === null || isPopupOpen || isPullRefreshing) {
        return;
      }

      const currentY = event.touches[0]?.clientY;
      if (typeof currentY !== "number") {
        return;
      }

      const rawDistance = currentY - pullStartYRef.current;
      if (rawDistance <= 0) {
        if (pullDistanceRef.current !== 0) {
          setPullDistance(0);
        }
        return;
      }

      const pullDistanceAfterThreshold = rawDistance - pullSuppressionThreshold;
      if (pullDistanceAfterThreshold <= 0) {
        return;
      }

      suppressItemPressRef.current = true;
      handlePointerCancel();
      event.preventDefault();
      setPullDistance(Math.min(maxPull, pullDistanceAfterThreshold * 0.45));
    };

    const onTouchEnd = () => {
      pullStartYRef.current = null;
      const shouldRefresh = pullDistanceRef.current >= pullThreshold && !isPopupOpen && !isPullRefreshing;

      if (!shouldRefresh) {
        setPullDistance(0);
        return;
      }

      setPullDistance(pullThreshold);
      setIsPullRefreshing(true);
      pullRefreshStartedAtRef.current = Date.now();

      void refreshRealtimeConnection()
        .catch(() => "failed")
        .finally(() => {
          const startedAt = pullRefreshStartedAtRef.current ?? Date.now();
          const elapsed = Date.now() - startedAt;
          const remainingMs = Math.max(0, 1000 - elapsed);

          window.setTimeout(() => {
            setIsPullRefreshing(false);
            setPullDistance(0);
            pullRefreshStartedAtRef.current = null;
          }, remainingMs);
        });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [handlePointerCancel, isPopupOpen, isPullRefreshing, refreshRealtimeConnection]);

  // --- Stable callback props for memoized children ---

  const handleOpenStats = useCallback(() => setIsListStatsOpen(true), []);
  const handleCloseStats = useCallback(() => setIsListStatsOpen(false), []);

  const handleStartRename = useCallback(() => {
    setNewListName(activeListRef.current?.name ?? "");
    setEditingTitle(true);
  }, [setNewListName, setEditingTitle]);

  const handleSaveRename = useCallback(() => {
    void (async () => {
      const renameResult = await handleRenameList();
      if (!renameResult) {
        return;
      }
      showUndoRename(renameResult.listId, renameResult.previousName, renameResult.nextName);
    })();
  }, [handleRenameList, showUndoRename]);

  const handleCancelRename = useCallback(() => {
    setNewListName(activeListRef.current?.name ?? "");
    setEditingTitle(false);
  }, [setNewListName, setEditingTitle]);

  const handleGridPointerDown = useCallback((itemId: string, name: string, quantityOrUnit?: string) => {
    if (suppressItemPressRef.current) {
      return;
    }
    handlePointerDown(itemId, name, quantityOrUnit);
  }, [handlePointerDown]);

  const handleGridPointerUp = useCallback((itemId: string) => {
    if (suppressItemPressRef.current) {
      suppressItemPressRef.current = false;
      return;
    }
    handlePointerUp(itemId);
  }, [handlePointerUp]);

  const handleOpenDrawer = useCallback(() => setIsDrawerOpen(true), [setIsDrawerOpen]);
  const handleCloseDrawer = useCallback(() => setIsDrawerOpen(false), [setIsDrawerOpen]);

  const handleShareList = useCallback(() => {
    void (async () => {
      try {
        const shareLink = await handleShareActiveList();
        try {
          const shared = await shareWithSystemSheet(shareLink);
          if (shared) {
            pushAppToast(t("toast.shareSuccess"), "success");
            return;
          }
        } catch (error) {
          if (isAbortError(error)) {
            return;
          }
        }

        await navigator.clipboard.writeText(shareLink);
        pushAppToast(t("toast.shareCopied"), "success");
      } catch {
        pushAppToast(t("toast.shareUnavailable"), "error");
      }
    })();
  }, [handleShareActiveList, shareWithSystemSheet, pushAppToast, t]);

  const handleSelectList = useCallback((listId: string) => {
    setActiveList(listId);
    setIsDrawerOpen(false);
  }, [setActiveList, setIsDrawerOpen]);

  const handleOpenSettings = useCallback(() => {
    setIsDrawerOpen(false);
    setIsSettingsModalOpen(true);
  }, [setIsDrawerOpen]);

  const handleOpenImprint = useCallback(() => {
    setIsDrawerOpen(false);
    setActiveLegalModal("imprint");
  }, [setIsDrawerOpen]);

  const handleOpenPrivacy = useCallback(() => {
    setIsDrawerOpen(false);
    setActiveLegalModal("privacy");
  }, [setIsDrawerOpen]);

  const handleCloseAddDialog = useCallback(() => setIsAddDialogOpen(false), [setIsAddDialogOpen]);

  const handleCancelCreateList = useCallback(() => {
    setCreateListName("");
    setIsCreateListModalOpen(false);
  }, [setCreateListName, setIsCreateListModalOpen]);

  const handleSaveCreateList = useCallback(() => {
    void handleConfirmCreateList();
  }, [handleConfirmCreateList]);

  const handleCancelJoinList = useCallback(() => {
    setJoinListValue("");
    setIsJoinListModalOpen(false);
  }, [setJoinListValue, setIsJoinListModalOpen]);

  const handleConfirmJoinList = useCallback(() => {
    void handleJoinList();
  }, [handleJoinList]);

  const handleCloseSettings = useCallback(() => setIsSettingsModalOpen(false), []);
  const handleCloseLegal = useCallback(() => setActiveLegalModal(null), []);
  const handleCancelEditItem = useCallback(() => setEditingItemId(null), [setEditingItemId]);

  const handleAcceptLanguage = useCallback(() => {
    void handleAcceptLanguageSuggestion();
  }, [handleAcceptLanguageSuggestion]);

  return (
    <div className="app">
      <div
        className={`pull-refresh-indicator${isPullRefreshing ? " pull-refresh-indicator--active" : ""}`}
        style={{ transform: `translate(-50%, ${-56 + pullDistance}px)` }}
        aria-hidden="true"
      >
        <span className="pull-refresh-indicator__ring" />
      </div>
      <AppHeader
        activeListName={activeList?.name ?? ""}
        renameValue={newListName}
        isEditingName={editingTitle}
        onOpenStats={handleOpenStats}
        onRenameValueChange={setNewListName}
        onStartRename={handleStartRename}
        onSaveRename={handleSaveRename}
        onCancelRename={handleCancelRename}
      />

      {isListStatsOpen && (
        <Suspense fallback={null}>
          <ListStatsModal
            isOpen
            totalItemsEver={listStats.totalItemsEver}
            openItems={listStats.openItems}
            topItems={listStats.topItems}
            lastBoughtAt={listStats.lastBoughtAt}
            onClose={handleCloseStats}
          />
        </Suspense>
      )}

      <ItemGrid
        items={listItems}
        exitingItemIds={exitingItemIds}
        onExitComplete={handleExitComplete}
        longPressTriggeredRef={longPressTriggeredRef}
        suppressItemPressRef={suppressItemPressRef}
        pressedItemId={pressedItemId}
        onPointerDown={handleGridPointerDown}
        onPointerUp={handleGridPointerUp}
        onPointerCancel={handlePointerCancel}
      />

      <BottomBar
        onOpenDrawer={handleOpenDrawer}
        onAddItem={openAddDialog}
        backendConnection={backendConnection}
        isBackendBusy={backendBusyRequests > 0}
        canShareList={backendSharingEnabled}
        onShareList={handleShareList}
      />

      <div className="app-toast-stack" aria-live="polite" aria-atomic="false">
        {appToasts.map((toast) => (
          <div key={toast.id} className={`app-toast app-toast--${toast.tone}`} role="status">
            <span className="app-toast__text">{toast.message}</span>
            <button type="button" className="app-toast__close" onClick={() => removeAppToast(toast.id)}>
              {t("common.close")}
            </button>
          </div>
        ))}
      </div>

      {showBackendLogs ? <BackendLogPanel /> : null}

      <div className="undo-toast-stack" aria-live="polite" aria-atomic="false">
        {undoToasts.map((toast) => (
          <div key={toast.id} className="undo-toast" role="status">
            <span className="undo-toast__text">
              {toast.kind === "item-delete"
                ? t("toast.undoDeleted", { name: toast.item.name })
                : t("toast.undoRenamed", { name: toast.nextName })}
            </span>
            <button
              type="button"
              className="undo-toast__action"
              onClick={() => void (
                toast.kind === "item-delete"
                  ? handleUndoDelete(toast.id, toast.item.id)
                  : handleUndoRename(toast.id, toast.listId, toast.previousName)
              )}
            >
              {t("toast.undo")}
            </button>
          </div>
        ))}
      </div>

      <ListsDrawer
        isOpen={isDrawerOpen}
        lists={lists}
        activeListId={activeListId}
        listMetaById={listMetaById}
        onClose={handleCloseDrawer}
        onOpen={handleOpenDrawer}
        onSelectList={handleSelectList}
        onDeleteList={handleDeleteList}
        onCreateList={handleCreateList}
        onJoinList={handleOpenJoinList}
        onOpenSettings={handleOpenSettings}
        onOpenImprint={handleOpenImprint}
        onOpenPrivacy={handleOpenPrivacy}
      />

      <AddItemDialog
        isOpen={isAddDialogOpen}
        itemName={itemName}
        suggestions={suggestions}
        duplicatePreview={duplicatePreview}
        onItemNameChange={setItemName}
        onClose={handleCloseAddDialog}
        onAddItem={handleAddItem}
        onAddSuggestion={handleAddSuggestion}
      />

      <CreateListModal
        isOpen={isCreateListModalOpen}
        value={createListName}
        onChange={setCreateListName}
        onCancel={handleCancelCreateList}
        onSave={handleSaveCreateList}
      />

      {isJoinListModalOpen && (
        <Suspense fallback={null}>
          <JoinListModal
            isOpen
            value={joinListValue}
            onChange={setJoinListValue}
            onCancel={handleCancelJoinList}
            onJoin={handleConfirmJoinList}
          />
        </Suspense>
      )}

      {isSettingsModalOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen
            onClose={handleCloseSettings}
          />
        </Suspense>
      )}

      {activeLegalModal !== null && (
        <Suspense fallback={null}>
          <LegalModal
            isOpen
            type={activeLegalModal}
            onClose={handleCloseLegal}
          />
        </Suspense>
      )}

      <EditItemModal
        isOpen={Boolean(editingItemId)}
        name={editItemName}
        quantity={editItemQuantity}
        onNameChange={setEditItemName}
        onQuantityChange={setEditItemQuantity}
        onCancel={handleCancelEditItem}
        onSave={handleSaveItem}
      />

      {languageSuggestion && dismissedLanguageSuggestionLocale !== languageSuggestion.suggestedLocale ? (
        <LanguageSuggestionModal
          isOpen
          suggestedLocale={languageSuggestion.suggestedLocale}
          onAccept={handleAcceptLanguage}
          onDismiss={handleDismissLanguageSuggestion}
        />
      ) : null}
    </div>
  );
};

export default App;
