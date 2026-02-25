import { type PointerEvent, useMemo, useRef, useState } from "react";
import type { List } from "@golist/shared/domain/types";
import { useI18n } from "../i18n";

type ListsDrawerProps = {
  isOpen: boolean;
  lists: List[];
  activeListId?: string;
  listMetaById: Record<string, { openItems: number; lastUpdatedAt: number }>;
  onClose: () => void;
  onOpen: () => void;
  onSelectList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onCreateList: () => void;
};

type DragState = {
  mode: "opening" | "closing";
  pointerId: number;
  startX: number;
};

const EDGE_SWIPE_WIDTH = 28;

const formatLastUpdated = (timestamp: number) => new Date(timestamp).toLocaleDateString();

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
  const canDelete = lists.length > 1;
  const [confirmDeleteListId, setConfirmDeleteListId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const { t, locale, setLocale, supportedLocales } = useI18n();

  const isSupportedLocale = (value: string): value is (typeof supportedLocales)[number] =>
    supportedLocales.some((entry) => entry === value);

  const nextDeleteLabel = useMemo(() => {
    if (!confirmDeleteListId) {return null;}
    return lists.find((list) => list.id === confirmDeleteListId)?.name ?? null;
  }, [confirmDeleteListId, lists]);

  const getDrawerWidth = () => drawerRef.current?.getBoundingClientRect().width ?? 320;

  const handleDragStart = (event: PointerEvent<HTMLElement>, mode: DragState["mode"]) => {
    dragStateRef.current = { mode, pointerId: event.pointerId, startX: event.clientX };
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
      if (deltaX > threshold) {onOpen();}
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
          onKeyDown={(event) => event.key === "Escape" && onClose()}
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
          <div className="drawer__header"><span>GoList</span></div>
          <div className="drawer__section">
            <p className="drawer__title">{t("drawer.myLists")}</p>
            <div className="drawer__list">
              {lists.map((list) => {
                const listMeta = listMetaById[list.id] ?? { openItems: 0, lastUpdatedAt: list.updatedAt };
                const isConfirmingDelete = confirmDeleteListId === list.id;

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
                      <span className="drawer__item-copy">
                        <span className="drawer__item-label">{list.name}</span>
                        <span className="drawer__item-meta">
                          {`${t("list.openItems", { count: listMeta.openItems })} · ${t("list.updated", {
                            time: formatLastUpdated(listMeta.lastUpdatedAt),
                          })}`}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`drawer__delete ${isConfirmingDelete ? "drawer__delete--confirm" : ""}`}
                      aria-label={
                        isConfirmingDelete
                          ? t("drawer.deleteConfirm", { name: list.name })
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
                      {isConfirmingDelete ? (
                        t("common.ok")
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
              {nextDeleteLabel ? <p className="drawer__delete-hint">{t("drawer.deleteHint", { name: nextDeleteLabel })}</p> : null}
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
          <button type="button" className="drawer__settings" onClick={() => setIsSettingsOpen(true)}>
            {t("settings.open")}
            <span className="drawer__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M19.14,12.94a7.43,7.43,0,0,0,.05-.94,7.43,7.43,0,0,0-.05-.94l2.11-1.65a.48.48,0,0,0,.12-.61l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.49.49,0,0,0,13.77,2H10.23a.49.49,0,0,0-.49.42L9.36,5.07a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.48.48,0,0,0,.12.61l2.11,1.65a7.43,7.43,0,0,0-.05.94,7.43,7.43,0,0,0,.05.94L2.76,14.59a.48.48,0,0,0-.12.61l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.49.49,0,0,0,.49.42h3.54a.49.49,0,0,0,.49-.42l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.48.48,0,0,0-.12-.61ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </button>
        </aside>
      </div>

      {isSettingsOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h2>{t("settings.title")}</h2>
            </div>
            <div className="modal__body">
              <div className="modal__field">
                <label htmlFor="language-select">{t("common.language")}</label>
                <select
                  id="language-select"
                  value={locale}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (isSupportedLocale(next)) {
                      setLocale(next);
                    }
                  }}
                >
                  {supportedLocales.map((entry) => (
                    <option key={entry} value={entry}>{entry.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal__actions">
              <button type="button" className="text-button" onClick={() => setIsSettingsOpen(false)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ListsDrawer;
