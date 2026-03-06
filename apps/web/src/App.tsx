import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@golist/shared/domain/types";
import AppHeader from "./components/AppHeader";
import BottomBar from "./components/BottomBar";
import AddItemDialog from "./components/AddItemDialog";
import EditItemModal from "./components/EditItemModal";
import ItemGrid from "./components/ItemGrid";
import ListsDrawer from "./components/ListsDrawer";
import CreateListModal from "./components/CreateListModal";
import JoinListModal from "./components/JoinListModal";
import SettingsModal from "./components/SettingsModal";
import LegalModal from "./components/LegalModal";
import { useAppState } from "./hooks/useAppState";
import { useLongPressItem } from "./hooks/useLongPressItem";
import { useKeyboardInset } from "./hooks/useKeyboardInset";
import { useI18n } from "./i18n";

type UndoToast = {
  id: string;
  item: Item;
};

type AppToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

type LegalModalType = "imprint" | "privacy";

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
};

const App = () => {
  const { t } = useI18n();

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
    syncNotice,
    clearSyncNotice,
    backendLogs,
  } = useAppState();

  const undoTimeoutsRef = useRef<Map<string, number>>(new Map());
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const [appToasts, setAppToasts] = useState<AppToast[]>([]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalType | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const suppressItemPressRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const pullRefreshStartedAtRef = useRef<number | null>(null);

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

  const clearUndoTimeout = (toastId: string) => {
    const timeout = undoTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      undoTimeoutsRef.current.delete(toastId);
    }
  };

  const clearAppToastTimeout = (toastId: string) => {
    const timeout = toastTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      toastTimeoutsRef.current.delete(toastId);
    }
  };

  const removeUndoToast = (toastId: string) => {
    clearUndoTimeout(toastId);
    setUndoToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const removeAppToast = (toastId: string) => {
    clearAppToastTimeout(toastId);
    setAppToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const pushAppToast = (message: string, tone: "success" | "error") => {
    const toastId = crypto.randomUUID();
    setAppToasts((current) => [...current, { id: toastId, message, tone }]);
    const timeout = window.setTimeout(() => {
      removeAppToast(toastId);
    }, 4500);
    toastTimeoutsRef.current.set(toastId, timeout);
  };

  const showUndo = (item: Item) => {
    const toastId = crypto.randomUUID();
    setUndoToasts((current) => [...current, { id: toastId, item }]);
    const timeout = window.setTimeout(() => {
      removeUndoToast(toastId);
    }, 5000);
    undoTimeoutsRef.current.set(toastId, timeout);
  };

  useEffect(
    () => () => {
      undoTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      undoTimeoutsRef.current.clear();
      toastTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      toastTimeoutsRef.current.clear();
    },
    [],
  );

  const handleToggleItem = async (itemId: string) => {
    if (exitingItemIds.has(itemId)) {return;}
    const itemToDelete = items.find((item) => item.id === itemId);
    if (!itemToDelete) {return;}

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await toggleItem(itemId);
      showUndo(itemToDelete);
      return;
    }
    setExitingItemIds((current) => new Set(current).add(itemId));
  };

  const handleExitComplete = async (itemId: string) => {
    if (!exitingItemIds.has(itemId)) {return;}
    const deletedItem = items.find((item) => item.id === itemId);
    await toggleItem(itemId);
    if (deletedItem) {
      showUndo(deletedItem);
    }
    setExitingItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  };

  const shareWithSystemSheet = async (shareLink: string): Promise<boolean> => {
    if (typeof navigator.share !== "function") {
      return false;
    }

    const sharePayload: ShareData = {
      title: activeList?.name ?? "GoList",
      text: t("share.text"),
      url: shareLink,
    };

    if (typeof navigator.canShare === "function" && !navigator.canShare(sharePayload)) {
      return false;
    }

    await navigator.share(sharePayload);
    return true;
  };

  const handleUndoDelete = async (toastId: string, itemId: string) => {
    removeUndoToast(toastId);
    await toggleItem(itemId);
  };

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
    if (!showBackendLogs || !syncNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      clearSyncNotice();
    }, 6000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [showBackendLogs, syncNotice, clearSyncNotice]);

  useEffect(() => {
    const pullThreshold = 72;
    const pullSuppressionThreshold = 10;
    const maxPull = 96;
    const getScrollY = () => window.scrollY || document.scrollingElement?.scrollTop || 0;

    const onTouchStart = (event: TouchEvent) => {
      suppressItemPressRef.current = false;
      if (isDrawerOpen || isPullRefreshing || event.touches.length !== 1 || getScrollY() > 0) {
        pullStartYRef.current = null;
        return;
      }

      pullStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (pullStartYRef.current === null || isDrawerOpen || isPullRefreshing) {
        return;
      }

      const currentY = event.touches[0]?.clientY;
      if (typeof currentY !== "number") {
        return;
      }

      const rawDistance = currentY - pullStartYRef.current;
      if (rawDistance <= 0) {
        if (pullDistance !== 0) {
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
      const shouldRefresh = pullDistance >= pullThreshold && !isDrawerOpen && !isPullRefreshing;

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
  }, [handlePointerCancel, isDrawerOpen, isPullRefreshing, pullDistance, refreshRealtimeConnection]);

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
        onRenameValueChange={setNewListName}
        onStartRename={() => {
          setNewListName(activeList?.name ?? "");
          setEditingTitle(true);
        }}
        onSaveRename={() => {
          void handleRenameList();
        }}
        onCancelRename={() => {
          setNewListName(activeList?.name ?? "");
          setEditingTitle(false);
        }}
      />

      <ItemGrid
        items={listItems}
        exitingItemIds={exitingItemIds}
        onExitComplete={handleExitComplete}
        longPressTriggeredRef={longPressTriggeredRef}
        suppressItemPressRef={suppressItemPressRef}
        pressedItemId={pressedItemId}
        onPointerDown={(itemId, name, quantityOrUnit) => {
          if (suppressItemPressRef.current) {
            return;
          }
          handlePointerDown(itemId, name, quantityOrUnit);
        }}
        onPointerUp={(itemId) => {
          if (suppressItemPressRef.current) {
            suppressItemPressRef.current = false;
            return;
          }
          handlePointerUp(itemId);
        }}
        onPointerCancel={handlePointerCancel}
      />

      <BottomBar
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onAddItem={openAddDialog}
        backendConnection={backendConnection}
        isBackendBusy={backendBusyRequests > 0}
        canShareList={backendSharingEnabled}
        onShareList={() => {
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
        }}
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

      {showBackendLogs && syncNotice ? (
        <div className="sync-toast" role="status" aria-live="polite">
          <span>{syncNotice.message}</span>
          <button type="button" className="sync-toast__close" onClick={clearSyncNotice}>
            {t("common.close")}
          </button>
        </div>
      ) : null}

      {showBackendLogs ? (
        <div className="backend-log-panel" aria-live="polite">
          <p className="backend-log-panel__title">{t("debug.backendLogs")}</p>
          <ul className="backend-log-panel__list">
            {backendLogs.length === 0 ? (
              <li className="backend-log-panel__entry backend-log-panel__entry--skipped">
                {t("debug.noBackendLogs")}
              </li>
            ) : (
              backendLogs.slice().reverse().map((entry) => (
                <li
                  key={entry.id}
                  className={`backend-log-panel__entry backend-log-panel__entry--${entry.outcome}`}
                >
                  {entry.message}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      <div className="undo-toast-stack" aria-live="polite" aria-atomic="false">
        {undoToasts.map((toast) => (
          <div key={toast.id} className="undo-toast" role="status">
            <span className="undo-toast__text">{t("toast.undoDeleted", { name: toast.item.name })}</span>
            <button
              type="button"
              className="undo-toast__action"
              onClick={() => void handleUndoDelete(toast.id, toast.item.id)}
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
        onClose={() => setIsDrawerOpen(false)}
        onOpen={() => setIsDrawerOpen(true)}
        onSelectList={(listId) => {
          setActiveList(listId);
          setIsDrawerOpen(false);
        }}
        onDeleteList={handleDeleteList}
        onCreateList={handleCreateList}
        onJoinList={handleOpenJoinList}
        onOpenSettings={() => {
          setIsDrawerOpen(false);
          setIsSettingsModalOpen(true);
        }}
        onOpenImprint={() => {
          setIsDrawerOpen(false);
          setActiveLegalModal("imprint");
        }}
        onOpenPrivacy={() => {
          setIsDrawerOpen(false);
          setActiveLegalModal("privacy");
        }}
      />

      <AddItemDialog
        isOpen={isAddDialogOpen}
        itemName={itemName}
        suggestions={suggestions}
        duplicatePreview={duplicatePreview}
        onItemNameChange={setItemName}
        onClose={() => setIsAddDialogOpen(false)}
        onAddItem={handleAddItem}
        onAddSuggestion={handleAddSuggestion}
      />

      <CreateListModal
        isOpen={isCreateListModalOpen}
        value={createListName}
        onChange={setCreateListName}
        onCancel={() => {
          setCreateListName("");
          setIsCreateListModalOpen(false);
        }}
        onSave={() => {
          void handleConfirmCreateList();
        }}
      />

      <JoinListModal
        isOpen={isJoinListModalOpen}
        value={joinListValue}
        onChange={setJoinListValue}
        onCancel={() => {
          setJoinListValue("");
          setIsJoinListModalOpen(false);
        }}
        onJoin={() => {
          void handleJoinList();
        }}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <LegalModal
        isOpen={activeLegalModal !== null}
        type={activeLegalModal ?? "imprint"}
        onClose={() => setActiveLegalModal(null)}
      />

      <EditItemModal
        isOpen={Boolean(editingItemId)}
        name={editItemName}
        quantity={editItemQuantity}
        onNameChange={setEditItemName}
        onQuantityChange={setEditItemQuantity}
        onCancel={() => setEditingItemId(null)}
        onSave={handleSaveItem}
      />
    </div>
  );
};

export default App;
