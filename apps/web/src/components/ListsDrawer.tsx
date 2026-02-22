import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { List } from "@golist/shared/domain/types";

type ListMeta = {
  openItems: number;
  lastUpdatedAt: number;
};

type ListsDrawerProps = {
  isOpen: boolean;
  lists: List[];
  activeListId: string | null | undefined;
  listMetaById: Record<string, ListMeta>;
  onClose: () => void;
  onOpen: () => void;
  onSelectList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onCreateList: () => void;
};

type DragMode = "opening" | "closing";

const EDGE_SWIPE_WIDTH = 28;

const formatLastUpdated = (timestamp: number) => {
  if (!timestamp) {
    return "Noch nie aktualisiert";
  }

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 0) {
    return "gerade eben";
  }

  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 1) {
    return "gerade eben";
  }

  if (elapsedMinutes < 60) {
    return `vor ${elapsedMinutes} Min.`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `vor ${elapsedHours} Std.`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays <= 7) {
    return `vor ${elapsedDays} Tag${elapsedDays === 1 ? "" : "en"}`;
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const ListsDrawer = ({
  isOpen,
  lists,
  activeListId,
  listMetaById,
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

  const getDrawerWidth = () => {
    const measured = drawerRef.current?.offsetWidth;
    if (measured && measured > 0) {return measured;}
    return Math.min(320, Math.round(window.innerWidth * 0.8));
  };

  const canDelete = lists.length > 1;
  const nextDeleteLabel = useMemo(
    () => lists.find((list) => list.id === confirmDeleteListId)?.name ?? "",
    [lists, confirmDeleteListId],
  );

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
          </div>
          <div className="drawer__section">
            <p className="drawer__title">Meine Listen</p>
            <div className="drawer__list">
              {lists.map((list) => {
                const listMeta = listMetaById[list.id] ?? { openItems: 0, lastUpdatedAt: list.updatedAt };
                const isConfirmingDelete = confirmDeleteListId === list.id;

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
                        <span className="drawer__item-meta">{`${listMeta.openItems} offen · aktualisiert ${formatLastUpdated(listMeta.lastUpdatedAt)}`}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`drawer__delete ${isConfirmingDelete ? "drawer__delete--confirm" : ""}`}
                      aria-label={isConfirmingDelete ? `Löschen bestätigen: ${list.name}` : `Löschen: ${list.name}`}
                      disabled={!canDelete}
                      onClick={() => {
                        if (isConfirmingDelete) {
                          onDeleteList(list.id);
                          setConfirmDeleteListId(null);
                          return;
                        }

                        setConfirmDeleteListId(list.id);
                      }}
                    >
                      {isConfirmingDelete ? "OK" : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
              {nextDeleteLabel ? <p className="drawer__delete-hint">Erneut tippen, um „{nextDeleteLabel}“ zu löschen.</p> : null}
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
        </aside>
      </div>
    </>
  );
};

export default ListsDrawer;
