type AppHeaderProps = {
  activeListName: string;
  pendingName: string;
  isEditingName: boolean;
  openItemCount: number;
  lastUpdatedLabel: string;
  backendConnection: "unknown" | "online" | "offline";
  isBackendBusy: boolean;
  onStartRename: () => void;
  onNameChange: (value: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
};

const AppHeader = ({
  activeListName,
  pendingName,
  isEditingName,
  openItemCount,
  lastUpdatedLabel,
  backendConnection,
  isBackendBusy,
  onStartRename,
  onNameChange,
  onSaveRename,
  onCancelRename,
}: AppHeaderProps) => {
  return (
    <header className="app__header" aria-label="Aktive Liste">
      <div className="title-row">
        {isEditingName ? (
          <div className="title-edit">
            <input
              value={pendingName}
              onChange={(event) => onNameChange(event.target.value)}
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
              aria-label="Listenname bearbeiten"
              autoFocus
            />
            <button type="button" className="icon-button" onClick={onSaveRename} aria-label="Speichern">
              ✓
            </button>
            <button type="button" className="icon-button" onClick={onCancelRename} aria-label="Abbrechen">
              ✕
            </button>
          </div>
        ) : (
          <>
            <h1 title={activeListName}>{activeListName}</h1>
            <div className="header-actions">
              <button
                type="button"
                className={`status-indicator status-indicator--${backendConnection}`}
                aria-label={
                  isBackendBusy ? "Backend-Anfrage läuft" : `Backend-Status: ${backendConnection}`
                }
                title={isBackendBusy ? "Backend-Anfrage läuft" : `Backend-Status: ${backendConnection}`}
              >
                {isBackendBusy ? (
                  <span className="status-spinner" aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M19.35 10.04A7.49 7.49 0 0 0 5 12a7.5 7.5 0 0 0 14.35 2.96A4.5 4.5 0 1 0 19.5 6a4.48 4.48 0 0 0-.15 4.04zM12 17a5 5 0 1 1 .001-10.001A5 5 0 0 1 12 17z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={onStartRename}
                aria-label="Listenname bearbeiten"
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
      <p className="header-meta" aria-live="polite">
        <span>{openItemCount} offen</span>
        <span aria-hidden="true">•</span>
        <span>{lastUpdatedLabel}</span>
      </p>
    </header>
  );
};

export default AppHeader;
