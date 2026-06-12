import { useMemo } from "react";
import { sortItemsForList } from "../domain/sort";
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

  const listItems = useMemo(() => {
    const filtered = items.filter((item) => item.listId === activeListId && !item.deleted);
    return sortItemsForList(filtered);
  }, [items, activeListId]);

  return {
    lists,
    items,
    activeListId,
    activeList,
    listItems,
    backendConnection,
    backendBusyRequests,
    backendSharingEnabled,
    isLoaded,
    deviceId: metadata?.deviceId,
  };
};
