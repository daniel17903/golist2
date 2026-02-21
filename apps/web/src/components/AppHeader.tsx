type AppHeaderProps = {
  activeListName: string;
  openItemCount: number;
  isEditingTitle: boolean;
  renameValue: string;
  backendConnection: "unknown" | "online" | "offline";
  hasActiveBackendRequests: boolean;
  onEditListName: () => void;
  onRenameValueChange: (value: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
};

const AppHeader = ({
  activeListName,
  openItemCount,
  isEditingTitle,
  renameValue,
  backendConnection,
  hasActiveBackendRequests,
  onEditListName,
  onRenameValueChange,
  onSaveRename,
  onCancelRename,
}: AppHeaderProps) => {
  const statusLabel = hasActiveBackendRequests
    ? "Backend activity in progress"
    : `Backend status: ${backendConnection}`;

  return (
    <header className="app__header">
      <div className="app__header-glass">
        <div className="title-row">
          {isEditingTitle ? (
            <div className="title-edit" role="group" aria-label="Rename list inline">
              <input
                value={renameValue}
                onChange={(event) => onRenameValueChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSaveRename();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelRename();
                  }
                }}
                autoFocus
                aria-label="List name"
              />
              <button type="button" className="ghost-button" onClick={onSaveRename}>
                Speichern
              </button>
              <button type="button" className="ghost-button" onClick={onCancelRename}>
                Abbrechen
              </button>
            </div>
          ) : (
            <>
              <h1>{activeListName}</h1>
              <div className="header-actions">
                <span
                  className={`backend-status backend-status--${backendConnection} ${
                    hasActiveBackendRequests ? "backend-status--busy" : ""
                  }`}
                  aria-label={statusLabel}
                  title={statusLabel}
                  role="img"
                >
                  {hasActiveBackendRequests ? (
                    <span className="backend-status__spinner" aria-hidden="true" />
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M19.36 10.46A7 7 0 0 0 5.22 9.09 4.5 4.5 0 0 0 6.5 18h12.2a3.8 3.8 0 0 0 .66-7.54zM18.7 16H6.5a2.5 2.5 0 0 1-.4-4.97l1.23-.2.41-1.18A5 5 0 0 1 17.3 11h1.4a1.8 1.8 0 1 1 0 5z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={onEditListName}
                  aria-label="Edit list name"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.5c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
        <div className="header-meta-row" aria-live="polite">
          <span>{openItemCount} offen</span>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
