import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { Item, List } from "@golist/shared/domain/types";

type ListsDrawerProps = {
  isOpen: boolean;
  lists: List[];
  items: Item[];
  activeListId: string | null | undefined;
  onClose: () => void;
  onOpen: () => void;
  onSelectList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onCreateList: () => void;
};

type DragMode = "opening" | "closing";

const EDGE_SWIPE_WIDTH = 28;

const formatUpdatedAt = (value: number) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const ListsDrawer = ({
  isOpen,
  lists,
  items,
  activeListId,
  onClose,
  onOpen,
  onSelectList,
  onDeleteList,
  onCreateList,
}: ListsDrawerProps) => {
  const drawerRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; mode: DragMode } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [confirmDeleteListId, setConfirmDeleteListId] = useState<string | null>(null);

  const metadataByListId = useMemo(() => {
    const entries = new Map<string, { openItemCount: number; lastUpdatedAt: number }>();
    lists.forEach((list) => {
      const listItems = items.filter((item) => item.listId === list.id);
      entries.set(list.id, {
        openItemCount: listItems.filter((item) => !item.deleted).length,
        lastUpdatedAt:
          listItems.reduce((max, item) => Math.max(max, item.updatedAt), list.updatedAt) || list.updatedAt,
      });
    });
    return entries;
  }, [lists, items]);

  const getDrawerWidth = () => {
    const measured = drawerRef.current?.offsetWidth;
    if (measured && measured > 0) {
      return measured;
    }
    return Math.min(320, Math.round(window.innerWidth * 0.8));
  };

  const handleDragStart = (event: PointerEvent<HTMLElement>, mode: DragMode) => {
    dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, mode };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const drawerWidth = getDrawerWidth();
    const deltaX = event.clientX - dragState.startX;

    if (dragState.mode === "opening") {
      const clampedDelta = Math.min(drawerWidth, Math.max(0, deltaX));
      setDragOffset(-drawerWidth + clampedDelta);
      return;
    }

    const clampedDelta = Math.max(-drawerWidth, Math.min(0, deltaX));
    setDragOffset(clampedDelta);
  };

  const handleDragEnd = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const drawerWidth = getDrawerWidth();
    const deltaX = event.clientX - dragState.startX;
    const threshold = drawerWidth * 0.35;

    if (dragState.mode === "opening") {
      if (deltaX > threshold) {
        onOpen();
      }
    } else if (-deltaX > threshold) {
      onClose();
    }

    setDragOffset(null);
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const drawerStyle =
    dragOffset === null ? undefined : { transform: `translateX(${dragOffset}px)`, transition: "none" };

  return (
    <>
      {!isOpen ? (
        <div
          className="drawer-edge-swipe-zone"
          aria-hidden="true"
          onPointerDown={(event) => {
            if (event.clientX > EDGE_SWIPE_WIDTH) {
              return;
            }
            handleDragStart(event, "opening");
          }}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        />
      ) : null}
      <div className={`drawer-overlay ${isOpen ? "drawer-overlay--open" : ""}`}>
        <div
          className="drawer-backdrop"
          role="button"
          tabIndex={-1}
          onClick={onClose}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
            }
          }}
        />
        <aside
          ref={drawerRef}
          className={`drawer ${isOpen ? "drawer--open" : ""}`}
          style={drawerStyle}
          aria-hidden={!isOpen}
          onPointerDown={(event) => handleDragStart(event, "closing")}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="drawer__header">
            <span>GoList</span>
          </div>
          <div className="drawer__section">
            <p className="drawer__title">Meine Listen</p>
            <div className="drawer__list">
              {lists.map((list) => {
                const metadata = metadataByListId.get(list.id);
                return (
                  <div key={list.id} className="drawer__item">
                    <button
                      type="button"
                      className={`drawer__item-button ${list.id === activeListId ? "drawer__item-button--active" : ""}`}
                      onClick={() => onSelectList(list.id)}
                    >
                      <span className="drawer__item-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path
                            d="M3 5h2v2H3V5zm0 6h2v2H3v-2zm0 6h2v2H3v-2zm4-12h14v2H7V5zm0 6h14v2H7v-2zm0 6h14v2H7v-2z"
                            fill="currentColor"
                          />
                        </svg>
                      </span>
                      <span className="drawer__item-text">
                        <span className="drawer__item-label">{list.name}</span>
                        <span className="drawer__item-meta">
                          {metadata?.openItemCount ?? 0} offen · {formatUpdatedAt(metadata?.lastUpdatedAt ?? list.updatedAt)}
                        </span>
                      </span>
                    </button>
                    {confirmDeleteListId === list.id ? (
                      <div className="drawer__delete-confirm" role="group" aria-label={`Delete ${list.name}`}>
                        <button
                          type="button"
                          className="drawer__delete-confirm-action"
                          onClick={() => {
                            onDeleteList(list.id);
                            setConfirmDeleteListId(null);
                          }}
                        >
                          Löschen
                        </button>
                        <button
                          type="button"
                          className="drawer__delete-confirm-cancel"
                          onClick={() => setConfirmDeleteListId(null)}
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="drawer__delete"
                        aria-label={`Delete ${list.name}`}
                        onClick={() => setConfirmDeleteListId(list.id)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              <button type="button" className="drawer__new" onClick={onCreateList}>
                <span className="drawer__item-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
                  </svg>
                </span>
                Neue Liste erstellen
              </button>
            </div>
          </div>
          <button type="button" className="drawer__settings">
            <span>Einstellungen</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.65 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.04.71 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.23 1.13-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
                fill="currentColor"
              />
            </svg>
          </button>
        </aside>
      </div>
    </>
  );
};

export default ListsDrawer;
