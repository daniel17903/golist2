import { useMemo } from "react";
import { resolveListType } from "@golist/shared/domain/types";
import { sortItemsForList } from "../domain/sort";
import { isOpenTodo, sortTodoItems } from "../domain/todoSort";
import { useStore } from "../state/useStore";

// Store-derived data shared across the app shell. Fine-grained selectors:
// each subscription only triggers a re-render when that specific slice of
// state changes. Actions are stable references in Zustand — modules that
// need them select them once at module scope via `useStore.getState()`.
export const useAppState = () => {
  const lists = useStore((s) => s.lists);
  const items = useStore((s) => s.items);
  const activeListId = useStore((s) => s.activeListId);
  const isLoaded = useStore((s) => s.isLoaded);
  const backendConnection = useStore((s) => s.backendConnection);
  const backendBusyRequests = useStore((s) => s.backendBusyRequests);
  const backendSharingEnabled = useStore((s) => s.backendSharingEnabled);
  const metadata = useStore((s) => s.metadata);

  const activeList = useMemo(
    () => lists.find((list) => list.id === activeListId) ?? null,
    [lists, activeListId],
  );

  const activeListType = resolveListType(activeList);

  // Shopping lists show items that are not checked off (deleted); todo lists
  // show open todos. Completed todos stay hidden in both views, so a list
  // whose type is switched keeps showing just its open entries.
  const listItems = useMemo(() => {
    if (activeListType === "todo") {
      return sortTodoItems(items.filter((item) => item.listId === activeListId && isOpenTodo(item)));
    }
    const filtered = items.filter(
      (item) => item.listId === activeListId && !item.deleted && item.completedAt === undefined,
    );
    return sortItemsForList(filtered);
  }, [items, activeListId, activeListType]);

  return {
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
    deviceId: metadata?.deviceId,
  };
};
