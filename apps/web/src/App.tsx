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

type AppToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

const App = () => {
  const {
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
    backendConnection,
    inFlightBackendRequests,
    syncNotice,
    clearSyncNotice,
    backendLogs,
  } = useAppState();

  const undoTimeoutsRef = useRef<Map<string, number>>(new Map());
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const [appToasts, setAppToasts] = useState<AppToast[]>([]);

  const showAppToast = (message: string, tone: "success" | "error") => {
    const id = crypto.randomUUID();
    setAppToasts((current) => [...current, { id, message, tone }]);
    const timeout = window.setTimeout(() => {
      setAppToasts((current) => current.filter((toast) => toast.id !== id));
      toastTimeoutsRef.current.delete(id);
    }, 4200);
    toastTimeoutsRef.current.set(id, timeout);
  };

  const clearUndoTimeout = (toastId: string) => {
    const timeout = undoTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      undoTimeoutsRef.current.delete(toastId);
    }
  };

  const removeUndoToast = (toastId: string) => {
    clearUndoTimeout(toastId);
    setUndoToasts((current) => current.filter((toast) => toast.id !== toastId));
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
        openItemsCount={listItems.length}
        isEditingTitle={editingTitle}
        draftListName={newListName}
        onDraftListNameChange={setNewListName}
        onStartEditingTitle={() => {
          setNewListName(activeList?.name ?? "");
          setEditingTitle(true);
        }}
        onCancelEditingTitle={() => setEditingTitle(false)}
        onSaveEditingTitle={() => {
          void handleRenameList();
        }}
        backendConnection={backendConnection}
        isBackendBusy={inFlightBackendRequests > 0}
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
              await navigator.clipboard.writeText(shareLink);
              showAppToast("Teilen-Link wurde in die Zwischenablage kopiert.", "success");
            } catch {
              showAppToast("Teilen ist derzeit nicht verfügbar.", "error");
            }
          })();
        }}
      />

      <div className="app-toast-stack" aria-live="polite" aria-atomic="false">
        {appToasts.map((toast) => (
          <div key={toast.id} className={`app-toast app-toast--${toast.tone}`} role="status">
            <span className="app-toast__text">{toast.message}</span>
          </div>
        ))}
      </div>

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
        items={items}
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
