import { memo, type MouseEvent } from "react";
import { getListItemIcon } from "../domain/categories";
import type { Item } from "@golist/shared/domain/types";

type ItemCardProps = {
  item: Item;
  isExiting: boolean;
  onExitComplete: (itemId: string) => void;
  isPressing: boolean;
  onPointerDown: (itemId: string, name: string, quantityOrUnit?: string) => void;
  onPointerUp: (itemId: string) => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

const ItemCard = memo(function ItemCard({
  item,
  isExiting,
  onExitComplete,
  isPressing,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onClick,
}: ItemCardProps) {
  return (
    <button
      type="button"
      className={`item-card ${isPressing ? "item-card--pressing" : ""} ${isExiting ? "item-card--exit" : ""}`.trim()}
      onPointerDown={() => onPointerDown(item.id, item.name, item.quantityOrUnit)}
      onPointerUp={() => onPointerUp(item.id)}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onAnimationEnd={() => {
        if (isExiting) {
          onExitComplete(item.id);
        }
      }}
      onClick={onClick}
    >
      <span className="item-icon" aria-hidden="true">
        <img src={getListItemIcon(item.iconName)} alt="" />
      </span>
      <div className="item-text">
        <span className="item-name">{item.name}</span>
        {item.quantityOrUnit && <span className="item-quantity">{item.quantityOrUnit}</span>}
      </div>
    </button>
  );
});

export default ItemCard;
