import { useEffect, useMemo, useState } from "react";
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
    toggleItem
  } = useStore();

  const [newListName, setNewListName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [itemName, setItemName] = useState("");
  const [quantityOrUnit, setQuantityOrUnit] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

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
    const filtered = items.filter((item) => item.listId === activeListId);
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
    await addItem(activeListId, trimmed, quantityOrUnit.trim() || undefined);
    setItemName("");
    setQuantityOrUnit("");
    setIsAddOpen(false);
  };

  const handleRenameList = async () => {
    if (!activeListId) return;
    const trimmed = newListName.trim();
    if (!trimmed) return;
    await renameList(activeListId, trimmed);
    setEditingTitle(false);
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
      </header>

      <main className="list-grid">
        {listItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`item-card ${item.checked ? "item-card--checked" : ""}`}
            onClick={() => toggleItem(item.id)}
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
        <button className="fab" type="button" onClick={() => setIsAddOpen(true)}>
          +
        </button>
      </footer>

      {isAddOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal__header">
              <h2>Add item</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsAddOpen(false)}
                aria-label="Close add item"
              >
                ✕
              </button>
            </div>
            <div className="modal__body">
              <div className="input-stack">
                <input
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  placeholder="Add item"
                  aria-label="Item name"
                />
                {suggestions.length > 0 && (
                  <div className="suggestions">
                    {suggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setItemName(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                value={quantityOrUnit}
                onChange={(event) => setQuantityOrUnit(event.target.value)}
                placeholder="Qty / unit (optional)"
                aria-label="Quantity or unit"
              />
            </div>
            <div className="modal__actions">
              <button type="button" className="ghost-button" onClick={() => setIsAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleAddItem}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
