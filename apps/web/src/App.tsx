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
    handleDeleteList
  } = useAppState();

  const undoTimeoutRef = useRef<number | null>(null);
  const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
  const [pendingUndoItem, setPendingUndoItem] = useState<Item | null>(null);

  const clearUndoTimeout = () => {
    if (undoTimeoutRef.current !== null) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  };

  const showUndo = (item: Item) => {
    clearUndoTimeout();
    setPendingUndoItem(item);
    undoTimeoutRef.current = window.setTimeout(() => {
      setPendingUndoItem(null);
      undoTimeoutRef.current = null;
    }, 5000);
  };

  useEffect(
    () => () => {
      clearUndoTimeout();
    },
    []
  );

  const handleToggleItem = async (itemId: string) => {
    if (exitingItemIds.has(itemId)) return;
    const itemToDelete = items.find((item) => item.id === itemId);
    if (!itemToDelete) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await toggleItem(itemId);
      showUndo(itemToDelete);
      return;
    }
    setExitingItemIds((current) => new Set(current).add(itemId));
  };

  const handleExitComplete = async (itemId: string) => {
    if (!exitingItemIds.has(itemId)) return;
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

  const handleUndoDelete = async () => {
    if (!pendingUndoItem) return;
    clearUndoTimeout();
    setPendingUndoItem(null);
    await toggleItem(pendingUndoItem.id);
  };

  const { handlePointerDown, handlePointerUp, handlePointerCancel, longPressTriggeredRef } =
    useLongPressItem({
      onLongPress: openEditItem,
      onShortPress: handleToggleItem
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

      <BottomBar onOpenDrawer={() => setIsDrawerOpen(true)} onAddItem={openAddDialog} />

      {pendingUndoItem && (
        <div className="undo-toast" role="status" aria-live="polite">
          <span>{`„${pendingUndoItem.name}“ gelöscht.`}</span>
          <button type="button" className="undo-toast__action" onClick={() => void handleUndoDelete()}>
            Rückgängig
          </button>
        </div>
      )}

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
