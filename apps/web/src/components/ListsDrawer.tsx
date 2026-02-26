import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { List } from "@golist/shared/domain/types";
import { useI18n } from "../i18n";

type ListMeta = {
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
  onOpenSettings: () => void;
  onOpenImprint: () => void;
  onOpenPrivacy: () => void;
};

type DragMode = "opening" | "closing";

const EDGE_SWIPE_WIDTH = 28;

const getCurrentTimestamp = () => Date.now();

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
  onOpenSettings,
  onOpenImprint,
  onOpenPrivacy,
}: ListsDrawerProps) => {
  const { t, locale } = useI18n();
  const drawerRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; mode: DragMode } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [confirmDeleteListId, setConfirmDeleteListId] = useState<string | null>(null);


  const relativeTimeFormatter = useMemo(
    () =>
      new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
      }),
    [locale],
  );

  const formatLastUpdated = (timestamp: number) => {
    if (!timestamp) {
      return t("drawer.neverUpdated");
    }

    const elapsedMs = getCurrentTimestamp() - timestamp;
    const elapsedMinutes = Math.round(elapsedMs / 60000);

    if (elapsedMinutes < 1) {
      return relativeTimeFormatter.format(0, "minute");
    }
    if (elapsedMinutes < 60) {
      return relativeTimeFormatter.format(-elapsedMinutes, "minute");
    }

    const elapsedHours = Math.round(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return relativeTimeFormatter.format(-elapsedHours, "hour");
    }

    const elapsedDays = Math.round(elapsedHours / 24);
    return relativeTimeFormatter.format(-elapsedDays, "day");
  };

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
    if (event.pointerType !== "touch") {return;}
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
            <p className="drawer__title">{t("drawer.myLists")}</p>
            <div className="drawer__list">
              {lists.map((list) => {
                const listMeta = listMetaById[list.id] ?? { lastUpdatedAt: list.updatedAt };
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
                        <span className="drawer__item-meta">
                          {t("drawer.openUpdated", {
                            updated: formatLastUpdated(listMeta.lastUpdatedAt),
                          })}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`drawer__delete ${isConfirmingDelete ? "drawer__delete--confirm" : ""}`}
                      aria-label={
                        isConfirmingDelete
                          ? t("drawer.confirmDelete", { name: list.name })
                          : t("drawer.delete", { name: list.name })
                      }
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
              {nextDeleteLabel ? <p className="drawer__delete-hint">{t("drawer.tapAgainToDelete", { name: nextDeleteLabel })}</p> : null}
              <button type="button" className="drawer__new" onClick={onCreateList}>
                <span className="drawer__item-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
                  </svg>
                </span>
                {t("drawer.createList")}
              </button>
            </div>
          </div>

          <div className="drawer__legal-actions" aria-label={t("drawer.legal")}>
            <button type="button" className="drawer__legal-button" onClick={onOpenImprint}>
              <span className="drawer__item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z" fill="currentColor" />
                </svg>
              </span>
              {t("drawer.imprint")}
            </button>
            <button type="button" className="drawer__legal-button" onClick={onOpenPrivacy}>
              <span className="drawer__item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3zm0 3.18 5 1.88V11c0 4.04-2.59 7.9-5 9.25-2.41-1.35-5-5.21-5-9.25V7.06l5-1.88zM11 9h2v5h-2V9zm0 6h2v2h-2v-2z" fill="currentColor" />
                </svg>
              </span>
              {t("drawer.privacy")}
            </button>
          </div>

          <button type="button" className="drawer__settings" onClick={onOpenSettings}>
            <span>{t("drawer.settings")}</span>
            <span className="drawer__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54a7.2 7.2 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.43 7.43 0 0 0-.05.94c0 .32.02.63.05.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </button>
        </aside>
      </div>
    </>
  );
};

export default ListsDrawer;
