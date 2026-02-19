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

const formatRelativeUpdate = (updatedAt: number) => {
  const minutes = Math.round((Date.now() - updatedAt) / 60_000);
  if (minutes <= 1) {return "gerade eben";}
  if (minutes < 60) {return `vor ${minutes} min`;}
  const hours = Math.round(minutes / 60);
  if (hours < 24) {return `vor ${hours} h`;}
  const days = Math.round(hours / 24);
  return `vor ${days} T`;
};

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const listMeta = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      if (item.deleted) {return;}
      counts.set(item.listId, (counts.get(item.listId) ?? 0) + 1);
    });
    return counts;
  }, [items]);

  const getDrawerWidth = () => {
    const measured = drawerRef.current?.offsetWidth;
    if (measured && measured > 0) {return measured;}
    return Math.min(320, Math.round(window.innerWidth * 0.8));
  };

  const handleDragStart = (event: PointerEvent<HTMLElement>, mode: DragMode) => {
    dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, mode };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {return;}

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
    if (!dragState || dragState.pointerId !== event.pointerId) {return;}

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

  const drawerStyle = dragOffset === null ? undefined : { transform: `translateX(${dragOffset}px)`, transition: "none" };

  return (
    <>
      {!isOpen ? (
        <div
          className="drawer-edge-swipe-zone"
          aria-hidden="true"
          onPointerDown={(event) => {
            if (event.clientX > EDGE_SWIPE_WIDTH) {return;}
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
            <small>{lists.length} Listen</small>
          </div>
          <div className="drawer__section">
            <p className="drawer__title">Meine Listen</p>
            <div className="drawer__list">
              {lists.map((list) => {
                const itemCount = listMeta.get(list.id) ?? 0;
                const isDeleteConfirming = confirmDeleteId === list.id;
                return (
                  <div key={list.id} className="drawer__item">
                    <button
                      type="button"
                      className={`drawer__item-button ${
                        list.id === activeListId ? "drawer__item-button--active" : ""
                      }`}
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
                      <span className="drawer__item-copy">
                        <span className="drawer__item-label">{list.name}</span>
                        <span className="drawer__item-meta">
                          {itemCount} offen · {formatRelativeUpdate(list.updatedAt)}
                        </span>
                      </span>
                    </button>
                    {isDeleteConfirming ? (
                      <button
                        type="button"
                        className="drawer__delete drawer__delete--confirm"
                        aria-label={`Delete ${list.name} now`}
                        onClick={() => {
                          void onDeleteList(list.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        Löschen?
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="drawer__delete"
                        aria-label={`Delete ${list.name}`}
                        onClick={() => setConfirmDeleteId(list.id)}
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
          <button type="button" className="drawer__settings" disabled>
            <span>Einstellungen</span>
            <small>bald verfügbar</small>
          </button>
        </aside>
      </div>
    </>
  );
};

export default ListsDrawer;
