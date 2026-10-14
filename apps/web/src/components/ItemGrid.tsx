import { memo, useCallback, useRef, type MouseEvent, type MutableRefObject } from "react";
import type { Item } from "@golist/shared/domain/types";
import ItemCard from "./ItemCard";
import { useGridLayoutAnimation } from "../hooks/useGridLayoutAnimation";

type ItemGridProps = {
  items: Item[];
  listId: string | undefined;
  exitingItemIds: Set<string>;
  onExitComplete: (itemId: string) => void;
  longPressTriggeredRef: MutableRefObject<boolean>;
  suppressItemPressRef: MutableRefObject<boolean>;
  pressedItemId: string | null;
  onPointerDown: (itemId: string, name: string, quantityOrUnit?: string) => void;
  onPointerUp: (itemId: string) => void;
  onPointerCancel: () => void;
};

const ItemGrid = memo(function ItemGrid({
  items,
  listId,
  exitingItemIds,
  onExitComplete,
  longPressTriggeredRef,
  suppressItemPressRef,
  pressedItemId,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: ItemGridProps) {
  const gridRef = useRef<HTMLElement | null>(null);
  useGridLayoutAnimation(gridRef, items, listId);

  // Hoisted so ItemCard (a React.memo component) receives a stable onClick
  // identity — an inline arrow here would give every card a new prop on
  // every ItemGrid render, defeating memoization. Reads two stable ref
  // objects, so the callback itself never needs to change identity.
  const handleItemClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (longPressTriggeredRef.current || suppressItemPressRef.current) {
        event.preventDefault();
      }
    },
    [longPressTriggeredRef, suppressItemPressRef],
  );

  return (
    <main ref={gridRef} className="list-grid">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isExiting={exitingItemIds.has(item.id)}
          onExitComplete={onExitComplete}
          isPressing={pressedItemId === item.id}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerCancel}
          onPointerCancel={onPointerCancel}
          onClick={handleItemClick}
        />
      ))}
    </main>
  );
});

export default ItemGrid;
