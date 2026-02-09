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

  const { handlePointerDown, handlePointerUp, handlePointerCancel, longPressTriggeredRef } =
    useLongPressItem({
      onLongPress: openEditItem,
      onShortPress: toggleItem
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
        longPressTriggeredRef={longPressTriggeredRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      <BottomBar onOpenDrawer={() => setIsDrawerOpen(true)} onAddItem={openAddDialog} />

      <ListsDrawer
        isOpen={isDrawerOpen}
        lists={lists}
        activeListId={activeListId}
        onClose={() => setIsDrawerOpen(false)}
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
