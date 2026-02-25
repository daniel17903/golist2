import type { MouseEvent } from "react";
import { getListItemIcon } from "../domain/categories";
import type { Item } from "@golist/shared/domain/types";

type ItemCardProps = {
  item: Item;
  isExiting: boolean;
  onExitComplete: (itemId: string) => void;
  onPointerDown: (itemId: string, name: string, quantityOrUnit?: string) => void;
  onPointerUp: (itemId: string) => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

const ItemCard = ({
  item,
  isExiting,
  onExitComplete,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onClick,
}: ItemCardProps) => {
  return (
    <button
      type="button"
      className={`item-card ${isExiting ? "item-card--exit" : ""}`}
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
        <img src={getListItemIcon(item.name, item.category)} alt="" />
      </span>
      <div className="item-text">
        <span className="item-name">{item.name}</span>
        {item.quantityOrUnit && <span className="item-quantity">{item.quantityOrUnit}</span>}
      </div>
    </button>
  );
};

export default ItemCard;
