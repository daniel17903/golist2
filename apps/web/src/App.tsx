import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@golist/shared/domain/types";
import AppHeader from "./components/AppHeader";
import BottomBar from "./components/BottomBar";
import AddItemDialog from "./components/AddItemDialog";
import EditItemModal from "./components/EditItemModal";
import ItemGrid from "./components/ItemGrid";
import ListsDrawer from "./components/ListsDrawer";
import CreateListModal from "./components/CreateListModal";
import SettingsModal from "./components/SettingsModal";
import LegalModal from "./components/LegalModal";
import { useAppState } from "./hooks/useAppState";
import { useLongPressItem } from "./hooks/useLongPressItem";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
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
    createListName,
    backendBusyRequests,
    backendSharingEnabled,
    reconnectRealtimeSync,
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

  const { handlePointerDown, handlePointerUp, handlePointerCancel, longPressTriggeredRef } =
    useLongPressItem({
      onLongPress: openEditItem,
      onShortPress: handleToggleItem,
    });

  const { pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } = usePullToRefresh({
    isEnabled: !isDrawerOpen,
    onRefresh: reconnectRealtimeSync,
  });

  const showBackendLogs = __ENVIRONMENT__ !== "production";

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

  const pullProgress = Math.min(1, pullDistance / 72);

  return (
    <div
      className="app"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        className={`pull-refresh ${isRefreshing ? "pull-refresh--active" : ""}`}
        style={{
          transform: `translate(-50%, ${-72 + pullDistance}px)`,
          opacity: isRefreshing ? 1 : Math.max(0, pullProgress),
        }}
        aria-hidden="true"
      >
        <span className="pull-refresh__spinner" />
      </div>

      <div
        className="app__content"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance > 0 || isRefreshing ? "none" : "transform 180ms ease-out",
        }}
      >
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
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      </div>

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
