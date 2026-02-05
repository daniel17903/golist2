import { useEffect, useMemo, useRef, useState } from "react";
import { getItemIcon } from "./domain/categories";
import { sortItemsForList } from "./domain/sort";
import { useStore } from "./state/useStore";

const defaultListName = "Einkaufsliste";

const App = () => {
  const {
    lists,
    items,
    activeListId,
    isLoaded,
    load,
    addList,
    renameList,
    setActiveList,
    addItem,
    toggleItem,
    updateItem,
    deleteList
  } = useStore();

  const [newListName, setNewListName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [itemName, setItemName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQuantity, setEditItemQuantity] = useState("");
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isLoaded && lists.length === 0) {
      void addList(defaultListName);
    }
  }, [isLoaded, lists.length, addList]);

  const activeList = lists.find((list) => list.id === activeListId);
  const listItems = useMemo(() => {
    const filtered = items.filter((item) => item.listId === activeListId && !item.checked);
    return sortItemsForList(filtered);
  }, [items, activeListId]);

  const suggestionPool = useMemo(() => {
    if (!activeListId) return [];
    const stats = new Map<string, { count: number; lastUsed: number }>();
    items
      .filter((item) => item.listId === activeListId)
      .forEach((item) => {
        const key = item.name.trim();
        if (!key) return;
        const existing = stats.get(key) ?? { count: 0, lastUsed: 0 };
        stats.set(key, {
          count: existing.count + 1,
          lastUsed: Math.max(existing.lastUsed, item.updatedAt)
        });
      });
    return Array.from(stats.entries()).map(([name, data]) => ({ name, ...data }));
  }, [items, activeListId]);

  const currentItemNames = useMemo(() => {
    const names = new Set<string>();
    listItems.forEach((item) => {
      const key = item.name.trim().toLowerCase();
      if (key) {
        names.add(key);
      }
    });
    return names;
  }, [listItems]);

  const suggestions = useMemo(() => {
    const trimmed = itemName.trim();
    const query = trimmed.toLowerCase();
    const sorted = suggestionPool
      .slice()
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return b.lastUsed - a.lastUsed;
      })
      .map((entry) => entry.name)
      .filter((name) => !currentItemNames.has(name.trim().toLowerCase()));
    if (!query) return sorted.slice(0, 12);
    const filtered = sorted.filter((name) => name.toLowerCase().includes(query));
    if (trimmed && !currentItemNames.has(query)) {
      const alreadySuggested = filtered.some((name) => name.toLowerCase() === query);
      if (!alreadySuggested) {
        filtered.unshift(trimmed);
      }
    }
    return filtered.slice(0, 12);
  }, [itemName, suggestionPool, currentItemNames]);

  const handleAddItem = async () => {
    if (!activeListId) return;
    const trimmed = itemName.trim();
    if (!trimmed) return;
    await addItem(activeListId, trimmed);
    setItemName("");
    setIsAddDialogOpen(false);
  };

  const handleRenameList = async () => {
    if (!activeListId) return;
    const trimmed = newListName.trim();
    if (!trimmed) return;
    await renameList(activeListId, trimmed);
    setEditingTitle(false);
  };

  const openEditItem = (itemId: string, name: string, quantityOrUnit?: string) => {
    setEditingItemId(itemId);
    setEditItemName(name);
    setEditItemQuantity(quantityOrUnit ?? "");
  };

  const handleSaveItem = async () => {
    if (!editingItemId) return;
    const trimmed = editItemName.trim();
    if (!trimmed) return;
    await updateItem(
      editingItemId,
      trimmed,
      editItemQuantity.trim() ? editItemQuantity.trim() : undefined
    );
    setEditingItemId(null);
  };

  const handleItemPointerDown = (itemId: string, name: string, quantityOrUnit?: string) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      openEditItem(itemId, name, quantityOrUnit);
    }, 600);
  };

  const handleItemPointerUp = async (itemId: string) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    if (!longPressTriggeredRef.current) {
      await toggleItem(itemId);
    }
    longPressTriggeredRef.current = false;
  };

  const handleItemPointerCancel = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTriggeredRef.current = false;
  };

  const openAddDialog = () => {
    setIsAddDialogOpen(true);
    window.setTimeout(() => addInputRef.current?.focus(), 0);
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="title-row">
          {editingTitle ? (
            <div className="title-edit">
              <input
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="Listenname"
              />
              <button type="button" className="ghost-button" onClick={handleRenameList}>
                Speichern
              </button>
            </div>
          ) : (
            <h1>{activeList?.name ?? ""}</h1>
          )}
          {!editingTitle && (
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setNewListName(activeList?.name ?? "");
                setEditingTitle(true);
              }}
              aria-label="Edit list name"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.5c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className="list-grid">
        {listItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`item-card ${item.checked ? "item-card--checked" : ""}`}
            onPointerDown={() => handleItemPointerDown(item.id, item.name, item.quantityOrUnit)}
            onPointerUp={() => void handleItemPointerUp(item.id)}
            onPointerLeave={handleItemPointerCancel}
            onPointerCancel={handleItemPointerCancel}
            onClick={(event) => {
              if (longPressTriggeredRef.current) {
                event.preventDefault();
              }
            }}
          >
            <span className="item-icon" aria-hidden="true">
              <img src={getItemIcon(item.name)} alt="" />
            </span>
            <div className="item-text">
              <span className="item-name">{item.name}</span>
              {item.quantityOrUnit && (
                <span className="item-quantity">{item.quantityOrUnit}</span>
              )}
            </div>
          </button>
        ))}
      </main>

      <footer className="bottom-bar">
        <button
          className="bottom-icon"
          type="button"
          aria-label="Open list menu"
          onClick={() => setIsDrawerOpen(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button className="fab" type="button" onClick={openAddDialog} aria-label="Add item">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
          </svg>
        </button>
        <button className="bottom-icon" type="button" aria-label="Share list">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7 0-.24-.03-.47-.09-.7l7.02-4.11c.54.5 1.25.81 2.07.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.03.47.09.7L8.91 9.81C8.37 9.31 7.66 9 6.84 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.82 0 1.53-.31 2.07-.81l7.12 4.19c-.05.2-.08.41-.08.62 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"
              fill="currentColor"
            />
          </svg>
        </button>
      </footer>

      <div className={`drawer-overlay ${isDrawerOpen ? "drawer-overlay--open" : ""}`}>
        <div
          className="drawer-backdrop"
          role="button"
          tabIndex={-1}
          onClick={() => setIsDrawerOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsDrawerOpen(false);
            }
          }}
        />
        <aside className={`drawer ${isDrawerOpen ? "drawer--open" : ""}`} aria-hidden={!isDrawerOpen}>
          <div className="drawer__header">
            <span>GoList</span>
          </div>
          <div className="drawer__section">
            <p className="drawer__title">Meine Listen</p>
            <div className="drawer__list">
              {lists.map((list) => (
                <div key={list.id} className="drawer__item">
                  <button
                    type="button"
                    className={`drawer__item-button ${
                      list.id === activeListId ? "drawer__item-button--active" : ""
                    }`}
                    onClick={() => {
                      setActiveList(list.id);
                      setIsDrawerOpen(false);
                    }}
                  >
                    <span className="drawer__item-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M3 5h2v2H3V5zm0 6h2v2H3v-2zm0 6h2v2H3v-2zm4-12h14v2H7V5zm0 6h14v2H7v-2zm0 6h14v2H7v-2z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span>{list.name}</span>
                  </button>
                  <button
                    type="button"
                    className="drawer__delete"
                    aria-label={`Delete ${list.name}`}
                    onClick={async () => {
                      await deleteList(list.id);
                      setIsDrawerOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="drawer__new"
                onClick={() => {
                  void addList(`Liste ${lists.length + 1}`);
                  setIsDrawerOpen(false);
                }}
              >
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

      {isAddDialogOpen && (
        <div
          className="modal-backdrop add-dialog"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsAddDialogOpen(false)}
        >
          <div
            className="modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <form
              className="add-panel"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddItem();
              }}
            >
              <input
                ref={addInputRef}
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="Was möchtest du einkaufen?"
                aria-label="Item name"
              />
            </form>
            <div className="modal__grid">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="item-card item-card--dialog"
                  onClick={async () => {
                    if (!activeListId) return;
                    await addItem(activeListId, name);
                    setItemName("");
                    setIsAddDialogOpen(false);
                  }}
                >
                  <span className="item-icon" aria-hidden="true">
                    <img src={getItemIcon(name)} alt="" />
                  </span>
                  <span className="item-name">{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingItemId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal__header">
              <h2>Edit item</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditingItemId(null)}
                aria-label="Close edit item"
              >
                ✕
              </button>
            </div>
            <div className="modal__body">
              <input
                value={editItemName}
                onChange={(event) => setEditItemName(event.target.value)}
                placeholder="Item name"
                aria-label="Item name"
              />
              <input
                value={editItemQuantity}
                onChange={(event) => setEditItemQuantity(event.target.value)}
                placeholder="Qty / unit (optional)"
                aria-label="Quantity or unit"
              />
            </div>
            <div className="modal__actions">
              <button type="button" className="ghost-button" onClick={() => setEditingItemId(null)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSaveItem}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
