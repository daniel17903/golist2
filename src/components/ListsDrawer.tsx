import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import type { List } from "../domain/types";

type ListsDrawerProps = {
  isOpen: boolean;
  lists: List[];
  activeListId: string | null | undefined;
  onClose: () => void;
  onSelectList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onCreateList: () => void;
};

const DRAWER_WIDTH = "min(320px, 80vw)";

const ListsDrawer = ({
  isOpen,
  lists,
  activeListId,
  onClose,
  onSelectList,
  onDeleteList,
  onCreateList
}: ListsDrawerProps) => {
  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={isOpen}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        className: `drawer ${isOpen ? "drawer--open" : ""}`,
        sx: {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          borderRight: "none"
        }
      }}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        zIndex: (theme) => theme.zIndex.appBar + 1
      }}
    >
      <Box className="drawer__header">
        <span>GoList</span>
      </Box>
      <Box className="drawer__section">
        <p className="drawer__title">Meine Listen</p>
        <Box className="drawer__list">
          {lists.map((list) => (
            <Box key={list.id} className="drawer__item">
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
                <span className="drawer__item-label">{list.name}</span>
              </button>
              <button
                type="button"
                className="drawer__delete"
                aria-label={`Delete ${list.name}`}
                onClick={() => onDeleteList(list.id)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </Box>
          ))}
          <button type="button" className="drawer__new" onClick={onCreateList}>
            <span className="drawer__item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
              </svg>
            </span>
            Neue Liste erstellen
          </button>
        </Box>
      </Box>
      <button type="button" className="drawer__settings">
        <span>Einstellungen</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.65 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.04.71 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.23 1.13-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
            fill="currentColor"
          />
        </svg>
      </button>
    </Drawer>
  );
};

export default ListsDrawer;
