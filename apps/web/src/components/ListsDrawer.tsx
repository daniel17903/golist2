import { useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import type { List } from "@golist/shared/domain/types";
import { supportedLocales } from "../i18n/config";

type ListsDrawerProps = {
  isOpen: boolean;
  lists: List[];
  activeListId: string | null | undefined;
  onClose: () => void;
  onOpen: () => void;
  onSelectList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onCreateList: () => void;
  locale: string;
  onLocaleChange: (locale: string) => void;
};

type DragMode = "opening" | "closing";
const EDGE_SWIPE_WIDTH = 28;

const ListsDrawer = ({ isOpen, lists, activeListId, onClose, onOpen, onSelectList, onDeleteList, onCreateList, locale, onLocaleChange }: ListsDrawerProps) => {
  const { t } = useTranslation();
  const drawerRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; mode: DragMode } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const getDrawerWidth = () => drawerRef.current?.offsetWidth || Math.min(320, Math.round(window.innerWidth * 0.8));

  const handleDragStart = (event: PointerEvent<HTMLElement>, mode: DragMode) => { dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, mode }; event.currentTarget.setPointerCapture(event.pointerId); };
  const handleDragMove = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {return;}
    const drawerWidth = getDrawerWidth();
    const deltaX = event.clientX - dragState.startX;
    if (dragState.mode === "opening") { setDragOffset(-drawerWidth + Math.min(drawerWidth, Math.max(0, deltaX))); return; }
    setDragOffset(Math.max(-drawerWidth, Math.min(0, deltaX)));
  };
  const handleDragEnd = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {return;}
    const drawerWidth = getDrawerWidth();
    const deltaX = event.clientX - dragState.startX;
    const threshold = drawerWidth * 0.35;
    if (dragState.mode === "opening") { if (deltaX > threshold) { onOpen(); } } else if (-deltaX > threshold) { onClose(); }
    setDragOffset(null); dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) { event.currentTarget.releasePointerCapture(event.pointerId); }
  };

  const drawerStyle = dragOffset === null ? undefined : { transform: `translateX(${dragOffset}px)`, transition: "none" };

  return (<>
    {!isOpen ? <div className="drawer-edge-swipe-zone" aria-hidden="true" onPointerDown={(event) => { if (event.clientX > EDGE_SWIPE_WIDTH) {return;} handleDragStart(event, "opening"); }} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd} /> : null}
    <div className={`drawer-overlay ${isOpen ? "drawer-overlay--open" : ""}`}>
      <div className="drawer-backdrop" role="button" tabIndex={-1} onClick={onClose} onKeyDown={(event) => { if (event.key === "Escape") { onClose(); } }} />
      <aside ref={drawerRef} className={`drawer ${isOpen ? "drawer--open" : ""}`} style={drawerStyle} aria-hidden={!isOpen} onPointerDown={(event) => handleDragStart(event, "closing")} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}>
        <div className="drawer__header"><span>{t("app.name")}</span></div>
        <div className="drawer__section">
          <p className="drawer__title">{t("drawer.myLists")}</p>
          <div className="drawer__list">
            {lists.map((list) => <div key={list.id} className="drawer__item"><button type="button" className={`drawer__item-button ${list.id === activeListId ? "drawer__item-button--active" : ""}`} onClick={() => onSelectList(list.id)}><span className="drawer__item-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 5h2v2H3V5zm0 6h2v2H3v-2zm0 6h2v2H3v-2zm4-12h14v2H7V5zm0 6h14v2H7v-2zm0 6h14v2H7v-2z" fill="currentColor" /></svg></span><span className="drawer__item-label">{list.name}</span></button><button type="button" className="drawer__delete" aria-label={t("drawer.deleteList", { name: list.name })} onClick={() => onDeleteList(list.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z" fill="currentColor" /></svg></button></div>)}
            <button type="button" className="drawer__new" onClick={onCreateList}><span className="drawer__item-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" /></svg></span>{t("drawer.createNewList")}</button>
          </div>
        </div>
        <div className="drawer__section">
          <p className="drawer__title">{t("drawer.settings")}</p>
          <label htmlFor="language" className="drawer__title">{t("drawer.language")}</label>
          <select id="language" value={locale} onChange={(event) => onLocaleChange(event.target.value)}>
            {supportedLocales.map((entry) => <option key={entry} value={entry}>{entry.toUpperCase()}</option>)}
          </select>
        </div>
      </aside>
    </div>
  </>);
};

export default ListsDrawer;
