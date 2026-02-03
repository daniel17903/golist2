import { useEffect, useMemo, useRef, useState } from "react";
import { getItemIcon } from "./domain/categories";
import { sortItemsForList } from "./domain/sort";
import { useStore } from "./state/useStore";

const defaultListName = "My List";

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
    updateItem
  } = useStore();

  const [newListName, setNewListName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [itemName, setItemName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQuantity, setEditItemQuantity] = useState("");
  const addInputRef = useRef<HTMLInputElement | null>(null);
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

  const suggestions = useMemo(() => {
    const query = itemName.trim().toLowerCase();
    if (!query) return [];
    return suggestionPool
      .filter((entry) => entry.name.toLowerCase().includes(query))
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return b.lastUsed - a.lastUsed;
      })
      .slice(0, 5)
      .map((entry) => entry.name);
  }, [itemName, suggestionPool]);

  const handleAddItem = async () => {
    if (!activeListId) return;
    const trimmed = itemName.trim();
    if (!trimmed) return;
    await addItem(activeListId, trimmed);
    setItemName("");
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

  return (
    <div className="app">
      <header className="app__header">
        <div className="list-selector">
          <select
            value={activeListId}
            onChange={(event) => setActiveList(event.target.value)}
            aria-label="Select list"
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
          <button
            className="ghost-button"
            type="button"
            onClick={() => addList(`List ${lists.length + 1}`)}
          >
            + New
          </button>
        </div>
        <div className="title-row">
          {editingTitle ? (
            <div className="title-edit">
              <input
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="List name"
              />
              <button type="button" onClick={handleRenameList}>
                Save
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
              ✏️
            </button>
          )}
        </div>
        <form
          className="add-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAddItem();
          }}
        >
          <div className="input-stack">
            <input
              ref={addInputRef}
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="Was möchtest du einkaufen?"
              aria-label="Item name"
            />
            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((name) => (
                  <button key={name} type="button" onClick={() => setItemName(name)}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
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
              {getItemIcon(item.name)}
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
        <button className="bottom-icon" type="button" aria-label="Open list menu">
          ≡
        </button>
        <button
          className="fab"
          type="button"
          onClick={() => addInputRef.current?.focus()}
          aria-label="Add item"
        >
          +
        </button>
        <button className="bottom-icon" type="button" aria-label="Share list">
          ↗
        </button>
      </footer>

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
