import type { MouseEvent } from "react";
import { getItemIcon } from "../domain/categories";
import type { Item } from "../domain/types";

type ItemCardProps = {
  item: Item;
  onPointerDown: (itemId: string, name: string, quantityOrUnit?: string) => void;
  onPointerUp: (itemId: string) => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

const ItemCard = ({
  item,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onClick
}: ItemCardProps) => {
  return (
    <button
      type="button"
      className={`item-card ${item.checked ? "item-card--checked" : ""}`}
      onPointerDown={() => onPointerDown(item.id, item.name, item.quantityOrUnit)}
      onPointerUp={() => onPointerUp(item.id)}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
    >
      <span className="item-icon" aria-hidden="true">
        <img src={getItemIcon(item.name)} alt="" />
      </span>
      <div className="item-text">
        <span className="item-name">{item.name}</span>
        {item.quantityOrUnit && <span className="item-quantity">{item.quantityOrUnit}</span>}
      </div>
    </button>
  );
};

export default ItemCard;
