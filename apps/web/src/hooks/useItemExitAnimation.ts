import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@golist/shared/domain/types";

// Exit animation runs 220ms; the fallback covers animationend never firing
// (hidden tab, interrupted animation, card removed from the DOM).
const EXIT_ANIMATION_FALLBACK_MS = 400;

type ItemExitAnimationOptions = {
  items: Item[];
  toggleItem: (itemId: string) => Promise<void>;
  onItemDeleted: (item: Item) => void;
};

// Plays the card exit animation before an item is toggled away, with a timer
// fallback so the item is still removed when animationend never fires.
export const useItemExitAnimation = ({ items, toggleItem, onItemDeleted }: ItemExitAnimationOptions) => {
  const [exitingItemIds, setExitingItemIds] = useState<Set<string>>(new Set());

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
    await toggleItem(itemId);
    if (deletedItem) {
      onItemDeletedRef.current(deletedItem);
    }
    setExitingItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }, [toggleItem]);

  const handleToggleItem = useCallback(async (itemId: string) => {
    if (exitTimeoutsRef.current.has(itemId)) {return;}
    const itemToDelete = itemsRef.current.find((item) => item.id === itemId);
    if (!itemToDelete) {return;}

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await toggleItem(itemId);
      onItemDeletedRef.current(itemToDelete);
      return;
    }
    const fallbackTimeout = window.setTimeout(() => {
      void handleExitComplete(itemId);
    }, EXIT_ANIMATION_FALLBACK_MS);
    exitTimeoutsRef.current.set(itemId, fallbackTimeout);
    setExitingItemIds((current) => new Set(current).add(itemId));
  }, [toggleItem, handleExitComplete]);

  return { exitingItemIds, handleExitComplete, handleToggleItem };
};
