import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import AppHeader from "./components/AppHeader";
import BottomBar from "./components/BottomBar";
import AddItemDialog, { type AddItemDialogHandle } from "./components/AddItemDialog";
import EditItemModal from "./components/EditItemModal";
import ItemGrid from "./components/ItemGrid";
import TodoList from "./components/TodoList";
import TodoFormModal from "./components/TodoFormModal";
import ListsDrawer from "./components/ListsDrawer";
import CreateListModal from "./components/CreateListModal";
import BackendLogPanel from "./components/BackendLogPanel";
import LanguageSuggestionModal from "./components/LanguageSuggestionModal";
import ToastStacks from "./components/ToastStacks";

const JoinListModal = lazy(() => import("./components/JoinListModal"));
const InviteLandingModal = lazy(() => import("./components/InviteLandingModal"));
const SettingsModal = lazy(() => import("./components/SettingsModal"));
const LegalModal = lazy(() => import("./components/LegalModal"));
const AiConnectorsModal = lazy(() => import("./components/AiConnectorsModal"));
const ListStatsModal = lazy(() => import("./components/ListStatsModal"));
const TodoStatsModal = lazy(() => import("./components/TodoStatsModal"));
import { useAppBootstrap } from "./hooks/useAppBootstrap";
import { useReportDeviceLists } from "./hooks/useReportDeviceLists";
import { useAppState } from "./hooks/useAppState";
import { useAddItemDialog } from "./hooks/useAddItemDialog";
import { useBackGestureTrap } from "./hooks/useBackGestureTrap";
import { useCreateListDialog } from "./hooks/useCreateListDialog";
import { useEditItemDialog } from "./hooks/useEditItemDialog";
import { useItemExitAnimation } from "./hooks/useItemExitAnimation";
import { useInviteLanding } from "./hooks/useInviteLanding";
import { useJoinListDialog } from "./hooks/useJoinListDialog";
import { useKeyboardInset } from "./hooks/useKeyboardInset";
import { useLanguageSuggestion } from "./hooks/useLanguageSuggestion";
import { useLongPressItem } from "./hooks/useLongPressItem";
import { usePopupStack } from "./hooks/usePopupStack";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useShareList } from "./hooks/useShareList";
import { useToasts } from "./hooks/useToasts";
import { TODO_TITLE_INPUT_ID, useTodoDialog } from "./hooks/useTodoDialog";
import { calculateListStats } from "./domain/listStats";
import { calculateTodoStats } from "./domain/todoStats";
import { recentAssignees } from "./domain/todoSort";
import { resolveListType, type Item, type ListType } from "@golist/shared/domain/types";
import { useI18n } from "./i18n";
import { useStore } from "./state/useStore";

type LegalModalType = "imprint" | "privacy";

const noAssignees: string[] = [];

type RemovedEntry = { kind: "deleted" } | { kind: "completed"; spawnedItemId?: string };

// Store actions are stable references — select them once at module scope.
const {
  toggleItem,
  toggleTodoCompleted,
  undoTodoCompleted,
  setListType,
  renameList,
  deleteList,
  setActiveList,
  refreshRealtimeConnection,
} = useStore.getState();

const App = () => {
  useKeyboardInset();

  const {
    undoToasts,
    appToasts,
    pushAppToast,
    showUndoDelete,
    showUndoComplete,
    showUndoRename,
    removeUndoToast,
    removeAppToast,
  } = useToasts();

  const { t } = useI18n();
  const handleJoinFailed = useCallback(() => {
    pushAppToast(t("sync.joinFailed"), "error");
  }, [pushAppToast, t]);

  const handleInviteCopyFailed = useCallback(() => {
    pushAppToast(t("toast.inviteCopyFailed"), "error");
  }, [pushAppToast, t]);

  const {
    lists,
    items,
    activeListId,
    activeList,
    activeListType,
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
  const isInviteLandingOpen = stack.includes("invite-landing");
  const isSettingsModalOpen = stack.includes("settings");
  const isListStatsOpen = stack.includes("list-stats");
  const isLegalModalOpen = stack.includes("legal");
  const isAiConnectorsOpen = stack.includes("ai-connectors");
  const isEditItemOpen = stack.includes("edit-item");
  const isTodoDialogOpen = stack.includes("add-todo") || stack.includes("edit-todo");

  const {
    itemName,
    setItemName,
    suggestions,
    duplicatePreview,
    openAddDialog,
    closeAddDialog,
    handleAddItem,
    handleAddSuggestion,
  } = useAddItemDialog({ isOpen: isAddDialogOpen, openPopup, closePopup });

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
    createListType,
    setCreateListType,
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
    handlePasteJoin,
  } = useJoinListDialog({ openPopup, closePopup, onJoinFailed: handleJoinFailed });

  const {
    inviteToken,
    isInviteCopied,
    showInviteLanding,
    closeInviteLanding,
    copyInvite,
    joinInBrowser,
  } = useInviteLanding({ openPopup, closePopup, onCopyFailed: handleInviteCopyFailed, onJoinFailed: handleJoinFailed });

  useAppBootstrap({ onShareLinkJoinFailed: handleJoinFailed, onIosShareLink: showInviteLanding });
  useReportDeviceLists({ lists, deviceId, isLoaded, backendSharingEnabled, backendConnection });

  const activeListTypeRef = useRef(activeListType);
  useEffect(() => { activeListTypeRef.current = activeListType; });

  // Tapping an entry removes it from the visible list: a shopping item is
  // checked off (deleted, comes back as a suggestion), a todo is completed.
  // Decided by the item's own list (not the active one, which can change
  // during the exit animation), and returned so the undo toast matches.
  const removeEntry = useCallback(async (itemId: string): Promise<RemovedEntry> => {
    const { items: currentItems, lists: currentLists } = useStore.getState();
    const listId = currentItems.find((entry) => entry.id === itemId)?.listId;
    if (resolveListType(currentLists.find((list) => list.id === listId)) === "todo") {
      const { spawnedItemId } = await toggleTodoCompleted(itemId);
      return { kind: "completed", spawnedItemId };
    }
    await toggleItem(itemId);
    return { kind: "deleted" };
  }, []);

  const handleEntryRemoved = useCallback((item: Item, result: RemovedEntry) => {
    if (result.kind === "completed") {
      showUndoComplete(item, result.spawnedItemId);
    } else {
      showUndoDelete(item);
    }
  }, [showUndoComplete, showUndoDelete]);

  const { exitingItemIds, removedItemIds, handleExitComplete, handleToggleItem } = useItemExitAnimation({
    items,
    toggleItem: removeEntry,
    onItemDeleted: handleEntryRemoved,
  });

  const handleActivateTodo = useCallback((itemId: string) => {
    void handleToggleItem(itemId);
  }, [handleToggleItem]);

  const handleDeleteTodo = useCallback((itemId: string) => {
    const item = useStore.getState().items.find((entry) => entry.id === itemId);
    if (!item || item.deleted) {
      return;
    }
    void (async () => {
      await toggleItem(itemId);
      showUndoDelete(item);
    })();
  }, [showUndoDelete]);

  const {
    todoDialogMode,
    todoFormValues,
    changeTodoFormValues,
    openAddTodo,
    openEditTodo,
    closeTodoDialog,
    saveTodo,
    deleteTodo,
  } = useTodoDialog({ activeListId, items, openPopup, closePopup, onDelete: handleDeleteTodo });

  // Long press edits the entry with the dialog matching the list type.
  const handleLongPress = useCallback((itemId: string, name: string, quantityOrUnit?: string) => {
    if (activeListTypeRef.current === "todo") {
      openEditTodo(itemId);
    } else {
      openEditItem(itemId, name, quantityOrUnit);
    }
  }, [openEditTodo, openEditItem]);

  const { handleShareList } = useShareList({ activeList, pushAppToast });

  const { languageSuggestion, acceptLanguageSuggestion, dismissLanguageSuggestion } =
    useLanguageSuggestion({ items, lists, deviceId, isLoaded });

  const {
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    longPressTriggeredRef,
    pressedItemId,
  } = useLongPressItem({
    onLongPress: handleLongPress,
    onShortPress: handleToggleItem,
  });

  const { pullIndicatorRef, isPullRefreshing, suppressItemPressRef } = usePullToRefresh({
    isPopupOpenRef,
    onPullDetected: handlePointerCancel,
    refresh: refreshRealtimeConnection,
  });

  useBackGestureTrap({ isPopupOpenRef, closeTopPopup });

  const visibleListItems = useMemo(
    () => (removedItemIds.size > 0 ? listItems.filter((item) => !removedItemIds.has(item.id)) : listItems),
    [listItems, removedItemIds],
  );

  // Walks the item history of every list, so it is only computed while the
  // stats modal is actually showing.
  const listStats = useMemo(
    () => (isListStatsOpen && activeListType === "shopping" ? calculateListStats(items, activeListId) : null),
    [isListStatsOpen, activeListType, items, activeListId],
  );

  const todoStats = useMemo(
    () => (isListStatsOpen && activeListType === "todo" && activeListId ? calculateTodoStats(items, activeListId) : null),
    [isListStatsOpen, activeListType, items, activeListId],
  );

  // Only computed while the todo dialog is showing.
  const knownAssignees = useMemo(
    () => (isTodoDialogOpen ? recentAssignees(items, activeListId) : noAssignees),
    [isTodoDialogOpen, items, activeListId],
  );

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

  const handleUndoComplete = useCallback((toastId: string, itemId: string, spawnedItemId?: string) => {
    removeUndoToast(toastId);
    void undoTodoCompleted(itemId, spawnedItemId);
  }, [removeUndoToast]);

  const handleChangeListType = useCallback((listType: ListType) => {
    const list = activeListRef.current;
    if (list) {
      void setListType(list.id, listType);
    }
  }, []);

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
  const handleOpenAiConnectors = useCallback(() => openPopup("ai-connectors"), [openPopup]);
  const handleCloseAiConnectors = useCallback(() => closePopup("ai-connectors"), [closePopup]);

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
    if (activeListTypeRef.current === "todo") {
      // Mount the dialog and focus it within the tap, so iOS opens the keyboard.
      flushSync(() => {
        openAddTodo();
      });
      document.getElementById(TODO_TITLE_INPUT_ID)?.focus();
      return;
    }
    flushSync(() => {
      openAddDialog();
    });
    addItemDialogRef.current?.focusInput();
  }, [openAddDialog, openAddTodo]);

  const handleSaveCreateList = useCallback(() => {
    void handleConfirmCreateList();
  }, [handleConfirmCreateList]);

  const handleConfirmJoinList = useCallback(() => {
    void handleJoinList();
  }, [handleJoinList]);

  const handleSaveEditItem = useCallback(() => {
    void handleSaveItem();
  }, [handleSaveItem]);

  const handleSaveTodo = useCallback(() => {
    void saveTodo();
  }, [saveTodo]);

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
        activeListType={activeListType}
        onChangeListType={handleChangeListType}
        onOpenStats={handleOpenStats}
        onSaveRename={handleSaveRename}
      />

      {listStats && (
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

      {todoStats && (
        <Suspense fallback={null}>
          <TodoStatsModal isOpen rows={todoStats} onClose={handleCloseStats} />
        </Suspense>
      )}

      {activeListType === "todo" ? (
        <TodoList
          items={visibleListItems}
          onActivate={handleActivateTodo}
          exitingItemIds={exitingItemIds}
          onExitComplete={handleExitComplete}
          longPressTriggeredRef={longPressTriggeredRef}
          suppressItemPressRef={suppressItemPressRef}
          pressedItemId={pressedItemId}
          onPointerDown={handleGridPointerDown}
          onPointerUp={handleGridPointerUp}
          onPointerCancel={handlePointerCancel}
        />
      ) : (
        <ItemGrid
          items={visibleListItems}
          listId={activeListId}
          exitingItemIds={exitingItemIds}
          onExitComplete={handleExitComplete}
          longPressTriggeredRef={longPressTriggeredRef}
          suppressItemPressRef={suppressItemPressRef}
          pressedItemId={pressedItemId}
          onPointerDown={handleGridPointerDown}
          onPointerUp={handleGridPointerUp}
          onPointerCancel={handlePointerCancel}
        />
      )}

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
        onUndoComplete={handleUndoComplete}
      />

      {showBackendLogs ? <BackendLogPanel /> : null}

      <ListsDrawer
        isOpen={isDrawerOpen}
        lists={lists}
        activeListId={activeListId}
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
        listType={createListType}
        onListTypeChange={setCreateListType}
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
            onPasteJoin={handlePasteJoin}
          />
        </Suspense>
      )}

      {isInviteLandingOpen && inviteToken !== null && (
        <Suspense fallback={null}>
          <InviteLandingModal
            isOpen
            isCopied={isInviteCopied}
            onCopy={copyInvite}
            onJoinHere={joinInBrowser}
            onClose={closeInviteLanding}
          />
        </Suspense>
      )}

      {isSettingsModalOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen
            onClose={handleCloseSettings}
            onOpenAiConnectors={backendSharingEnabled ? handleOpenAiConnectors : undefined}
          />
        </Suspense>
      )}

      {isAiConnectorsOpen && (
        <Suspense fallback={null}>
          <AiConnectorsModal
            isOpen
            deviceId={deviceId}
            onClose={handleCloseAiConnectors}
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

      <TodoFormModal
        isOpen={isTodoDialogOpen}
        mode={todoDialogMode}
        values={todoFormValues}
        knownAssignees={knownAssignees}
        onChange={changeTodoFormValues}
        onCancel={closeTodoDialog}
        onSave={handleSaveTodo}
        onDelete={deleteTodo}
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
