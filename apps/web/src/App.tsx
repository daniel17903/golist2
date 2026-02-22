import { useEffect, useRef, useState } from "react";
import type { Item } from "@golist/shared/domain/types";
import AppHeader from "./components/AppHeader";
import BottomBar from "./components/BottomBar";
import AddItemDialog from "./components/AddItemDialog";
import EditItemModal from "./components/EditItemModal";
import ItemGrid from "./components/ItemGrid";
import ListsDrawer from "./components/ListsDrawer";
import CreateListModal from "./components/CreateListModal";
import { useAppState } from "./hooks/useAppState";
import { useLongPressItem } from "./hooks/useLongPressItem";

type UndoToast = {
  id: string;
  item: Item;
};

type NoticeToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
};

const App = () => {
  const {
    lists,
    items,
    activeListId,
    activeList,
    listItems,
    openItemCount,
    listMetaById,
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
    backendConnection,
    syncNotice,
    clearSyncNotice,
    backendLogs,
    isBackendBusy,
  } = useAppState();

  const undoTimeoutsRef = useRef<Map<string, number>>(new Map());
  const noticeTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const [noticeToasts, setNoticeToasts] = useState<NoticeToast[]>([]);

  const clearUndoTimeout = (toastId: string) => {
    const timeout = undoTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      undoTimeoutsRef.current.delete(toastId);
    }
  };

  const clearNoticeTimeout = (toastId: string) => {
    const timeout = noticeTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      noticeTimeoutsRef.current.delete(toastId);
    }
  };

  const removeUndoToast = (toastId: string) => {
    clearUndoTimeout(toastId);
    setUndoToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const removeNoticeToast = (toastId: string) => {
    clearNoticeTimeout(toastId);
    setNoticeToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const showUndo = (item: Item) => {
    const toastId = crypto.randomUUID();
    setUndoToasts((current) => [...current, { id: toastId, item }]);
    const timeout = window.setTimeout(() => {
      removeUndoToast(toastId);
    }, 5000);
    undoTimeoutsRef.current.set(toastId, timeout);
  };

  const showNotice = (message: string, tone: "success" | "error") => {
    const toastId = crypto.randomUUID();
    setNoticeToasts((current) => [...current, { id: toastId, message, tone }]);
    const timeout = window.setTimeout(() => {
      removeNoticeToast(toastId);
    }, 4200);
    noticeTimeoutsRef.current.set(toastId, timeout);
  };

  useEffect(
    () => () => {
      undoTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      undoTimeoutsRef.current.clear();
      noticeTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      noticeTimeoutsRef.current.clear();
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
      text: "Teile diese Einkaufsliste",
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

  useEffect(() => {
    if (!__IS_VERCEL_NON_PRODUCTION__ || !syncNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      clearSyncNotice();
    }, 6000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [syncNotice, clearSyncNotice]);

  return (
    <div className="app">
      <AppHeader
        activeListName={activeList?.name ?? ""}
        editedListName={newListName}
        isEditingTitle={editingTitle}
        openItemCount={openItemCount}
        backendConnection={backendConnection}
        isBackendBusy={isBackendBusy}
        onStartEditListName={() => {
          setNewListName(activeList?.name ?? "");
          setEditingTitle(true);
        }}
        onEditedListNameChange={setNewListName}
        onSaveListName={() => {
          void handleRenameList();
        }}
        onCancelEditListName={() => setEditingTitle(false)}
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

      <BottomBar
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onAddItem={openAddDialog}
        onShareList={() => {
          void (async () => {
            try {
              const shareLink = await handleShareActiveList();
              try {
                const shared = await shareWithSystemSheet(shareLink);
                if (shared) {
                  showNotice("Teilen geöffnet.", "success");
                  return;
                }
              } catch (error) {
                if (isAbortError(error)) {
                  return;
                }
              }

              await navigator.clipboard.writeText(shareLink);
              showNotice("Teilen-Link wurde in die Zwischenablage kopiert.", "success");
            } catch {
              showNotice("Teilen ist derzeit nicht verfügbar.", "error");
            }
          })();
        }}
      />

      {__IS_VERCEL_NON_PRODUCTION__ && syncNotice ? (
        <div className="sync-toast" role="status" aria-live="polite">
          <span>{syncNotice.message}</span>
          <button type="button" className="sync-toast__close" onClick={clearSyncNotice}>
            Schließen
          </button>
        </div>
      ) : null}

      {__IS_VERCEL_NON_PRODUCTION__ ? (
        <div className="backend-log-panel" aria-live="polite">
          <p className="backend-log-panel__title">Backend-Logs</p>
          <ul className="backend-log-panel__list">
            {backendLogs.length === 0 ? (
              <li className="backend-log-panel__entry backend-log-panel__entry--skipped">
                Noch keine Backend-Aufrufe protokolliert.
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

      <div className="notice-toast-stack" aria-live="polite" aria-atomic="false">
        {noticeToasts.map((toast) => (
          <div key={toast.id} className={`notice-toast notice-toast--${toast.tone}`} role="status">
            <span className="notice-toast__text">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="undo-toast-stack" aria-live="polite" aria-atomic="false">
        {undoToasts.map((toast) => (
          <div key={toast.id} className="undo-toast" role="status">
            <span className="undo-toast__text">{`„${toast.item.name}“ gelöscht.`}</span>
            <button
              type="button"
              className="undo-toast__action"
              onClick={() => void handleUndoDelete(toast.id, toast.item.id)}
            >
              Rückgängig
            </button>
          </div>
        ))}
      </div>

      <ListsDrawer
        isOpen={isDrawerOpen}
        lists={lists}
        listMetaById={listMetaById}
        activeListId={activeListId}
        onClose={() => setIsDrawerOpen(false)}
        onOpen={() => setIsDrawerOpen(true)}
        onSelectList={(listId) => {
          setActiveList(listId);
          setIsDrawerOpen(false);
        }}
        onDeleteList={handleDeleteList}
        onCreateList={handleCreateList}
      />

      <AddItemDialog
        isOpen={isAddDialogOpen}
        itemName={itemName}
        suggestions={suggestions}
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
