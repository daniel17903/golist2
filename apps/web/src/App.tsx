import { useEffect, useRef, useState } from "react";
import type { Item } from "@golist/shared/domain/types";
import AppHeader from "./components/AppHeader";
import BottomBar from "./components/BottomBar";
import AddItemDialog from "./components/AddItemDialog";
import EditItemModal from "./components/EditItemModal";
import ItemGrid from "./components/ItemGrid";
import ListsDrawer from "./components/ListsDrawer";
import RenameListModal from "./components/RenameListModal";
import { useAppState } from "./hooks/useAppState";
import { useLongPressItem } from "./hooks/useLongPressItem";

type UndoToast = {
  id: string;
  item: Item;
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
    setNewListName,
    setEditingTitle,
    setItemName,
    setEditingItemId,
    setEditItemName,
    setEditItemQuantity,
    setIsDrawerOpen,
    setIsAddDialogOpen,
    setActiveList,
    toggleItem,
    openEditItem,
    handleAddItem,
    handleAddSuggestion,
    handleRenameList,
    handleSaveItem,
    openAddDialog,
    handleCreateList,
    handleDeleteList,
    handleShareActiveList,
  } = useAppState();

  const undoTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);

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

  return (
    <div className="app">
      <AppHeader
        activeListName={activeList?.name ?? ""}
        onEditListName={() => {
          setNewListName(activeList?.name ?? "");
          setEditingTitle(true);
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

      <BottomBar
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onAddItem={openAddDialog}
        onShareList={() => {
          void (async () => {
            try {
              const shareLink = await handleShareActiveList();
              await navigator.clipboard.writeText(shareLink);
              window.alert("Teilen-Link wurde in die Zwischenablage kopiert.");
            } catch {
              window.alert("Teilen ist derzeit nicht verfügbar.");
            }
          })();
        }}
      />

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

      <RenameListModal
        isOpen={editingTitle}
        value={newListName}
        onChange={setNewListName}
        onCancel={() => setEditingTitle(false)}
        onSave={handleRenameList}
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
