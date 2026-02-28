import type { MutableRefObject } from "react";
import type { Item } from "@golist/shared/domain/types";
import ItemCard from "./ItemCard";

type ItemGridProps = {
  items: Item[];
  exitingItemIds: Set<string>;
  onExitComplete: (itemId: string) => void;
  longPressTriggeredRef: MutableRefObject<boolean>;
  suppressItemPressRef: MutableRefObject<boolean>;
  onPointerDown: (itemId: string, name: string, quantityOrUnit?: string) => void;
  onPointerUp: (itemId: string) => void;
  onPointerCancel: () => void;
};

const ItemGrid = ({
  items,
  exitingItemIds,
  onExitComplete,
  longPressTriggeredRef,
  suppressItemPressRef,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: ItemGridProps) => {
  return (
    <main className="list-grid">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          isExiting={exitingItemIds.has(item.id)}
          onExitComplete={onExitComplete}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerCancel}
          onPointerCancel={onPointerCancel}
          onClick={(event) => {
            if (longPressTriggeredRef.current || suppressItemPressRef.current) {
              event.preventDefault();
            }
          }}
        />
      ))}
    </main>
  );
};

export default ItemGrid;
