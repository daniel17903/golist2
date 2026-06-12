import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import AppHeader from "./components/AppHeader";
import BottomBar from "./components/BottomBar";
import AddItemDialog, { type AddItemDialogHandle } from "./components/AddItemDialog";
import EditItemModal from "./components/EditItemModal";
import ItemGrid from "./components/ItemGrid";
import ListsDrawer from "./components/ListsDrawer";
import CreateListModal from "./components/CreateListModal";
import BackendLogPanel from "./components/BackendLogPanel";
import LanguageSuggestionModal from "./components/LanguageSuggestionModal";
import ToastStacks from "./components/ToastStacks";

const JoinListModal = lazy(() => import("./components/JoinListModal"));
const SettingsModal = lazy(() => import("./components/SettingsModal"));
const LegalModal = lazy(() => import("./components/LegalModal"));
const ListStatsModal = lazy(() => import("./components/ListStatsModal"));
import { useAppBootstrap } from "./hooks/useAppBootstrap";
import { useAppState } from "./hooks/useAppState";
import { useAddItemDialog } from "./hooks/useAddItemDialog";
import { useBackGestureTrap } from "./hooks/useBackGestureTrap";
import { useCreateListDialog } from "./hooks/useCreateListDialog";
import { useEditItemDialog } from "./hooks/useEditItemDialog";
import { useItemExitAnimation } from "./hooks/useItemExitAnimation";
import { useJoinListDialog } from "./hooks/useJoinListDialog";
import { useKeyboardInset } from "./hooks/useKeyboardInset";
import { useLanguageSuggestion } from "./hooks/useLanguageSuggestion";
import { useLongPressItem } from "./hooks/useLongPressItem";
import { usePopupStack } from "./hooks/usePopupStack";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useShareList } from "./hooks/useShareList";
import { useToasts } from "./hooks/useToasts";
import { calculateListStats } from "./domain/listStats";
import { useStore } from "./state/useStore";

type LegalModalType = "imprint" | "privacy";

// Store actions are stable references — select them once at module scope.
const {
  toggleItem,
  renameList,
  deleteList,
  setActiveList,
  refreshRealtimeConnection,
} = useStore.getState();

const App = () => {
  useKeyboardInset();
  useAppBootstrap();

  const {
    lists,
    items,
    activeListId,
    activeList,
    listItems,
    backendConnection,
    backendBusyRequests,
    backendSharingEnabled,
    isLoaded,
    deviceId,
  } = useAppState();

  const { stack, isPopupOpenRef, openPopup, closePopup, closeTopPopup } = usePopupStack();
  const isDrawerOpen = stack.includes("drawer");
  const isAddDialogOpen = stack.includes("add-item");
  const isCreateListModalOpen = stack.includes("create-list");
  const isJoinListModalOpen = stack.includes("join-list");
  const isSettingsModalOpen = stack.includes("settings");
  const isListStatsOpen = stack.includes("list-stats");
  const isLegalModalOpen = stack.includes("legal");
  const isEditItemOpen = stack.includes("edit-item");

  const {
    undoToasts,
    appToasts,
    pushAppToast,
    showUndoDelete,
    showUndoRename,
    removeUndoToast,
    removeAppToast,
  } = useToasts();

  const {
    itemName,
    setItemName,
    suggestions,
    duplicatePreview,
    openAddDialog,
    closeAddDialog,
    handleAddItem,
    handleAddSuggestion,
  } = useAddItemDialog({ openPopup, closePopup });

  const {
    editItemName,
    editItemQuantity,
    setEditItemName,
    setEditItemQuantity,
    openEditItem,
    cancelEditItem,
    handleSaveItem,
  } = useEditItemDialog({ openPopup, closePopup });

  const {
    createListName,
    setCreateListName,
    openCreateList,
    cancelCreateList,
    handleConfirmCreateList,
  } = useCreateListDialog({ openPopup, closePopup });

  const {
    joinListValue,
    setJoinListValue,
    openJoinList,
    cancelJoinList,
    handleJoinList,
  } = useJoinListDialog({ openPopup, closePopup });

  const { exitingItemIds, handleExitComplete, handleToggleItem } = useItemExitAnimation({
    items,
    toggleItem,
    onItemDeleted: showUndoDelete,
  });

  const { handleShareList } = useShareList({ activeList, pushAppToast });

  const { languageSuggestion, acceptLanguageSuggestion, dismissLanguageSuggestion } =
    useLanguageSuggestion({ items, deviceId, isLoaded });

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

  const { pullIndicatorRef, isPullRefreshing, suppressItemPressRef } = usePullToRefresh({
    isPopupOpenRef,
    onPullDetected: handlePointerCancel,
    refresh: refreshRealtimeConnection,
  });

  useBackGestureTrap({ isPopupOpenRef, closeTopPopup });

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

  const activeListRef = useRef(activeList);
  useEffect(() => { activeListRef.current = activeList; });

  const handleSaveRename = useCallback((nextName: string) => {
    void (async () => {
      const list = activeListRef.current;
      if (!list) {
        return;
      }
      const previousName = list.name;
      await renameList(list.id, nextName);
      showUndoRename(list.id, previousName, nextName);
    })();
  }, [showUndoRename]);

  const handleUndoDelete = useCallback((toastId: string, itemId: string) => {
    removeUndoToast(toastId);
    void toggleItem(itemId);
  }, [removeUndoToast]);

  const handleUndoRename = useCallback((toastId: string, listId: string, previousName: string) => {
    removeUndoToast(toastId);
    void renameList(listId, previousName);
  }, [removeUndoToast]);

  const handleGridPointerDown = useCallback((itemId: string, name: string, quantityOrUnit?: string) => {
    if (suppressItemPressRef.current) {
      return;
    }
    handlePointerDown(itemId, name, quantityOrUnit);
  }, [handlePointerDown, suppressItemPressRef]);

  const handleGridPointerUp = useCallback((itemId: string) => {
    if (suppressItemPressRef.current) {
      suppressItemPressRef.current = false;
      return;
    }
    handlePointerUp(itemId);
  }, [handlePointerUp, suppressItemPressRef]);

  const handleOpenDrawer = useCallback(() => openPopup("drawer"), [openPopup]);
  const handleCloseDrawer = useCallback(() => closePopup("drawer"), [closePopup]);
  const handleOpenStats = useCallback(() => openPopup("list-stats"), [openPopup]);
  const handleCloseStats = useCallback(() => closePopup("list-stats"), [closePopup]);
  const handleCloseSettings = useCallback(() => closePopup("settings"), [closePopup]);
  const handleCloseLegal = useCallback(() => closePopup("legal"), [closePopup]);

  const handleOpenSettings = useCallback(() => {
    closePopup("drawer");
    openPopup("settings");
  }, [openPopup, closePopup]);

  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalType | null>(null);

  const handleOpenImprint = useCallback(() => {
    setActiveLegalModal("imprint");
    closePopup("drawer");
    openPopup("legal");
  }, [openPopup, closePopup]);

  const handleOpenPrivacy = useCallback(() => {
    setActiveLegalModal("privacy");
    closePopup("drawer");
    openPopup("legal");
  }, [openPopup, closePopup]);

  const handleSelectList = useCallback((listId: string) => {
    setActiveList(listId);
    closePopup("drawer");
  }, [closePopup]);

  const handleDeleteList = useCallback((listId: string) => {
    void (async () => {
      await deleteList(listId);
      closePopup("drawer");
    })();
  }, [closePopup]);

  const addItemDialogRef = useRef<AddItemDialogHandle | null>(null);

  const handleOpenAddDialog = useCallback(() => {
    flushSync(() => {
      openAddDialog();
    });
    addItemDialogRef.current?.focusInput();
  }, [openAddDialog]);

  const handleSaveCreateList = useCallback(() => {
    void handleConfirmCreateList();
  }, [handleConfirmCreateList]);

  const handleConfirmJoinList = useCallback(() => {
    void handleJoinList();
  }, [handleJoinList]);

  const handleSaveEditItem = useCallback(() => {
    void handleSaveItem();
  }, [handleSaveItem]);

  const showBackendLogs = __ENVIRONMENT__ !== "production";

  return (
    <div className="app">
      <div
        ref={pullIndicatorRef}
        className={`pull-refresh-indicator${isPullRefreshing ? " pull-refresh-indicator--active" : ""}`}
        style={{ transform: "translate(-50%, -56px)" }}
        aria-hidden="true"
      >
        <span className="pull-refresh-indicator__ring" />
      </div>
      <AppHeader
        activeListName={activeList?.name ?? ""}
        onOpenStats={handleOpenStats}
        onSaveRename={handleSaveRename}
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
        onAddItem={handleOpenAddDialog}
        backendConnection={backendConnection}
        isBackendBusy={backendBusyRequests > 0}
        canShareList={backendSharingEnabled}
        onShareList={handleShareList}
      />

      <ToastStacks
        appToasts={appToasts}
        undoToasts={undoToasts}
        onCloseAppToast={removeAppToast}
        onUndoDelete={handleUndoDelete}
        onUndoRename={handleUndoRename}
      />

      {showBackendLogs ? <BackendLogPanel /> : null}

      <ListsDrawer
        isOpen={isDrawerOpen}
        lists={lists}
        activeListId={activeListId}
        listMetaById={listMetaById}
        onClose={handleCloseDrawer}
        onOpen={handleOpenDrawer}
        onSelectList={handleSelectList}
        onDeleteList={handleDeleteList}
        onCreateList={openCreateList}
        onJoinList={openJoinList}
        onOpenSettings={handleOpenSettings}
        onOpenImprint={handleOpenImprint}
        onOpenPrivacy={handleOpenPrivacy}
      />

      <AddItemDialog
        ref={addItemDialogRef}
        isOpen={isAddDialogOpen}
        itemName={itemName}
        suggestions={suggestions}
        duplicatePreview={duplicatePreview}
        onItemNameChange={setItemName}
        onClose={closeAddDialog}
        onAddItem={handleAddItem}
        onAddSuggestion={handleAddSuggestion}
      />

      <CreateListModal
        isOpen={isCreateListModalOpen}
        value={createListName}
        onChange={setCreateListName}
        onCancel={cancelCreateList}
        onSave={handleSaveCreateList}
      />

      {isJoinListModalOpen && (
        <Suspense fallback={null}>
          <JoinListModal
            isOpen
            value={joinListValue}
            onChange={setJoinListValue}
            onCancel={cancelJoinList}
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

      {isLegalModalOpen && activeLegalModal !== null && (
        <Suspense fallback={null}>
          <LegalModal
            isOpen
            type={activeLegalModal}
            onClose={handleCloseLegal}
          />
        </Suspense>
      )}

      <EditItemModal
        isOpen={isEditItemOpen}
        name={editItemName}
        quantity={editItemQuantity}
        onNameChange={setEditItemName}
        onQuantityChange={setEditItemQuantity}
        onCancel={cancelEditItem}
        onSave={handleSaveEditItem}
      />

      {languageSuggestion ? (
        <LanguageSuggestionModal
          isOpen
          suggestedLocale={languageSuggestion.suggestedLocale}
          onAccept={acceptLanguageSuggestion}
          onDismiss={dismissLanguageSuggestion}
        />
      ) : null}
    </div>
  );
};

export default App;
