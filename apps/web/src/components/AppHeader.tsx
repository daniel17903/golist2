type AppHeaderProps = {
  activeListName: string;
  editedListName: string;
  isEditingTitle: boolean;
  openItemCount: number;
  backendConnection: "unknown" | "online" | "offline";
  isBackendBusy: boolean;
  onStartEditListName: () => void;
  onEditedListNameChange: (value: string) => void;
  onSaveListName: () => void;
  onCancelEditListName: () => void;
};

const AppHeader = ({
  activeListName,
  editedListName,
  isEditingTitle,
  openItemCount,
  backendConnection,
  isBackendBusy,
  onStartEditListName,
  onEditedListNameChange,
  onSaveListName,
  onCancelEditListName,
}: AppHeaderProps) => {
  const statusLabel = isBackendBusy
    ? "Backend status: synchronizing"
    : `Backend status: ${backendConnection}`;

  return (
    <header className="app__header" aria-label="List header">
      <div className="app__header-glass">
        <div className="title-row">
          {isEditingTitle ? (
            <div className="title-edit" role="group" aria-label="Rename list">
              <input
                value={editedListName}
                onChange={(event) => onEditedListNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSaveListName();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEditListName();
                  }
                }}
                aria-label="List name"
                autoFocus
              />
              <button type="button" className="icon-button" onClick={onSaveListName} aria-label="Save list name">
                ✓
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={onCancelEditListName}
                aria-label="Cancel renaming"
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <h1 title={activeListName}>{activeListName}</h1>
              <button
                type="button"
                className="icon-button"
                onClick={onStartEditListName}
                aria-label="Edit list name"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.5c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="header-meta-row">
          <span className="header-meta-row__count">{openItemCount} offen</span>
          <span className="header-meta-row__status" aria-label={statusLabel} title={statusLabel}>
            {isBackendBusy ? (
              <span className="header-spinner" aria-hidden="true" />
            ) : (
              <span
                className={`connection-status-icon connection-status-icon--${backendConnection}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24">
                  <path
                    d="M12 2a9 9 0 0 0-9 9v2a3 3 0 0 0 3 3h1v4h10v-4h1a3 3 0 0 0 3-3v-2a9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7v2a1 1 0 0 1-1 1h-1v-3H7v3H6a1 1 0 0 1-1-1v-2a7 7 0 0 1 7-7zm-3 9h6v5H9v-5z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            )}
          </span>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
