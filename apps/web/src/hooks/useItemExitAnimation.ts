import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@golist/shared/domain/types";

// Exit animation runs 220ms; the fallback covers animationend never firing
// (hidden tab, interrupted animation, card removed from the DOM).
const EXIT_ANIMATION_FALLBACK_MS = 400;

const withoutId = (ids: Set<string>, itemId: string) => {
  const next = new Set(ids);
  next.delete(itemId);
  return next;
};

type ItemExitAnimationOptions<TResult> = {
  items: Item[];
  // Removes the item from the visible list: deleting a shopping item or
  // completing a todo. Its result is handed to `onItemDeleted`.
  toggleItem: (itemId: string) => Promise<TResult>;
  onItemDeleted: (item: Item, result: TResult) => void;
};

// Plays the card exit animation before an item is toggled away, with a timer
// fallback so the item is still removed when animationend never fires. Once
// the animation is done the card is hidden right away (`removedItemIds`), so
// the grid reflows without waiting for the IndexedDB write behind the toggle.
export const useItemExitAnimation = <TResult>({ items, toggleItem, onItemDeleted }: ItemExitAnimationOptions<TResult>) => {
  const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set());

  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; });

  const onItemDeletedRef = useRef(onItemDeleted);
  useEffect(() => { onItemDeletedRef.current = onItemDeleted; });

  // Pending exit fallbacks, keyed by item id. An entry also marks the item as
  // "exit in progress", so completion runs exactly once even when both
  // animationend and the fallback timer fire.
  const exitTimeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(
    () => () => {
      exitTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      exitTimeoutsRef.current.clear();
    },
    [],
  );

  const handleExitComplete = useCallback(async (itemId: string) => {
    const fallbackTimeout = exitTimeoutsRef.current.get(itemId);
    if (fallbackTimeout === undefined) {return;}
    window.clearTimeout(fallbackTimeout);
    exitTimeoutsRef.current.delete(itemId);
    const deletedItem = itemsRef.current.find((item) => item.id === itemId);
    setRemovedItemIds((current) => new Set(current).add(itemId));
    setExitingItemIds((current) => withoutId(current, itemId));
    let result: TResult;
    try {
      result = await toggleItem(itemId);
    } finally {
      setRemovedItemIds((current) => withoutId(current, itemId));
    }
    if (deletedItem) {
      onItemDeletedRef.current(deletedItem, result);
    }
  }, [toggleItem]);

  const handleToggleItem = useCallback(async (itemId: string) => {
    if (exitTimeoutsRef.current.has(itemId)) {return;}
    const itemToDelete = itemsRef.current.find((item) => item.id === itemId);
    if (!itemToDelete) {return;}

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const result = await toggleItem(itemId);
      onItemDeletedRef.current(itemToDelete, result);
      return;
    }
    const fallbackTimeout = window.setTimeout(() => {
      void handleExitComplete(itemId);
    }, EXIT_ANIMATION_FALLBACK_MS);
    exitTimeoutsRef.current.set(itemId, fallbackTimeout);
    setExitingItemIds((current) => new Set(current).add(itemId));
  }, [toggleItem, handleExitComplete]);

  return { exitingItemIds, removedItemIds, handleExitComplete, handleToggleItem };
};
