import { memo, useCallback, type MouseEvent, type MutableRefObject } from "react";
import type { Item } from "@golist/shared/domain/types";
import { formatDueDate, isOverdue } from "../domain/dueDate";
import { useI18n } from "../i18n";

// Row view of a todo-type list (ported from DoList). Shares the press,
// long-press, exit-animation and pull-to-refresh plumbing with ItemGrid.

type TodoRowProps = {
  item: Item;
  isExiting: boolean;
  onExitComplete: (itemId: string) => void;
  isPressing: boolean;
  onPointerDown: (itemId: string, name: string) => void;
  onPointerUp: (itemId: string) => void;
  onPointerCancel: () => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

const TodoRow = memo(function TodoRow({
  item,
  isExiting,
  onExitComplete,
  isPressing,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onClick,
}: TodoRowProps) {
  const { locale, t } = useI18n();

  return (
    <button
      type="button"
      data-item-id={item.id}
      className={`todo-item${isPressing ? " todo-item--pressing" : ""}${isExiting ? " todo-item--exit" : ""}`}
      onPointerDown={() => onPointerDown(item.id, item.name)}
      onPointerUp={() => onPointerUp(item.id)}
      onPointerLeave={onPointerCancel}
      onPointerCancel={onPointerCancel}
      onAnimationEnd={() => {
        if (isExiting) {
          onExitComplete(item.id);
        }
      }}
      onClick={onClick}
    >
      <span className="todo-item__checkbox" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </span>
      <span className="todo-item__content">
        <span className="todo-item__title">{item.name}</span>
        <span className="todo-item__meta">
          {item.dueDate !== undefined ? (
            <span className={`todo-item__due-date${isOverdue(item.dueDate) ? " todo-item__due-date--overdue" : ""}`}>
              {formatDueDate(item.dueDate, locale, t)}
            </span>
          ) : null}
          {item.assignedTo ? <span className="todo-item__assigned-to">{item.assignedTo}</span> : null}
          {item.recurrence ? (
            <span className="todo-item__recurrence" aria-label={t("todo.recurring")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
});

type TodoListProps = {
  items: Item[];
  exitingItemIds: Set<string>;
  onExitComplete: (itemId: string) => void;
  longPressTriggeredRef: MutableRefObject<boolean>;
  suppressItemPressRef: MutableRefObject<boolean>;
  pressedItemId: string | null;
  onPointerDown: (itemId: string, name: string) => void;
  onPointerUp: (itemId: string) => void;
  onPointerCancel: () => void;
};

const TodoList = memo(function TodoList({
  items,
  exitingItemIds,
  onExitComplete,
  longPressTriggeredRef,
  suppressItemPressRef,
  pressedItemId,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: TodoListProps) {
  const { t } = useI18n();

  // Stable identity for the memoized rows (see ItemGrid).
  const handleItemClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (longPressTriggeredRef.current || suppressItemPressRef.current) {
        event.preventDefault();
      }
    },
    [longPressTriggeredRef, suppressItemPressRef],
  );

  return (
    <main className="todo-list" aria-label={t("todo.listLabel")}>
      {items.length === 0 ? <p className="todo-list__empty">{t("todo.empty")}</p> : null}
      {items.map((item) => (
        <TodoRow
          key={item.id}
          item={item}
          isExiting={exitingItemIds.has(item.id)}
          onExitComplete={onExitComplete}
          isPressing={pressedItemId === item.id}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={handleItemClick}
        />
      ))}
    </main>
  );
});

export default TodoList;
