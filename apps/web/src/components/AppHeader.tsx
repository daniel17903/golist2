type AppHeaderProps = {
  activeListName: string;
  openItemsCount: number;
  isEditingTitle: boolean;
  newListName: string;
  onListNameChange: (value: string) => void;
  onStartEditListName: () => void;
  onCancelEditListName: () => void;
  onSaveListName: () => void;
  backendConnection: "unknown" | "online" | "offline";
};

const connectionLabelMap = {
  online: "Online",
  offline: "Offline",
  unknown: "Prüfung",
} as const;

const AppHeader = ({
  activeListName,
  openItemsCount,
  isEditingTitle,
  newListName,
  onListNameChange,
  onStartEditListName,
  onCancelEditListName,
  onSaveListName,
  backendConnection,
}: AppHeaderProps) => {
  const connectionLabel = connectionLabelMap[backendConnection];

  return (
    <header className="app__header">
      <div className="app__header-shell">
        {!isEditingTitle ? (
          <>
            <div className="title-row">
              <h1>{activeListName}</h1>
              <button
                type="button"
                className="icon-button"
                onClick={onStartEditListName}
                aria-label="Liste umbenennen"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.5c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            <div className="header-meta-row">
              <p className="header-open-count">{`${openItemsCount} offen`}</p>
              <div
                className={`connection-pill connection-pill--${backendConnection}`}
                aria-label={`Backend Status: ${connectionLabel}`}
                title={`Backend Status: ${connectionLabel}`}
              >
                <span className="connection-indicator" aria-hidden="true" />
                <span>{connectionLabel}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="title-edit" role="group" aria-label="Listenname bearbeiten">
            <input
              value={newListName}
              onChange={(event) => onListNameChange(event.target.value)}
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
              autoFocus
              aria-label="Listenname"
              placeholder="Listenname"
              maxLength={100}
            />
            <button type="button" className="ghost-button" onClick={onCancelEditListName}>
              Abbrechen
            </button>
            <button type="button" className="primary-button" onClick={onSaveListName}>
              Speichern
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
