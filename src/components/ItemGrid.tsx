import type { MutableRefObject } from "react";
import type { Item } from "../domain/types";
import ItemCard from "./ItemCard";

type ItemGridProps = {
  items: Item[];
  longPressTriggeredRef: MutableRefObject<boolean>;
  onPointerDown: (itemId: string, name: string, quantityOrUnit?: string) => void;
  onPointerUp: (itemId: string) => void;
  onPointerCancel: () => void;
};

const ItemGrid = ({
  items,
  longPressTriggeredRef,
  onPointerDown,
  onPointerUp,
  onPointerCancel
}: ItemGridProps) => {
  return (
    <main className="list-grid">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerCancel}
          onPointerCancel={onPointerCancel}
          onClick={(event) => {
            if (longPressTriggeredRef.current) {
              event.preventDefault();
            }
          }}
        />
      ))}
    </main>
  );
};

export default ItemGrid;
