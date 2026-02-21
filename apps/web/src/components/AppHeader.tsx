type AppHeaderProps = {
  activeListName: string;
  openItemsCount: number;
  isEditingTitle: boolean;
  draftListName: string;
  onDraftListNameChange: (value: string) => void;
  onStartEditingTitle: () => void;
  onCancelEditingTitle: () => void;
  onSaveEditingTitle: () => void;
  backendConnection: "unknown" | "online" | "offline";
  isBackendBusy: boolean;
};

const backendLabelByState: Record<AppHeaderProps["backendConnection"], string> = {
  online: "Backend verbunden",
  offline: "Backend nicht erreichbar",
  unknown: "Backend-Status unbekannt",
};

const AppHeader = ({
  activeListName,
  openItemsCount,
  isEditingTitle,
  draftListName,
  onDraftListNameChange,
  onStartEditingTitle,
  onCancelEditingTitle,
  onSaveEditingTitle,
  backendConnection,
  isBackendBusy,
}: AppHeaderProps) => {
  const backendLabel = isBackendBusy
    ? "Backend-Anfrage läuft"
    : backendLabelByState[backendConnection];

  return (
    <header className="app__header glass-header">
      <div className="title-row">
        {isEditingTitle ? (
          <div className="title-edit">
            <input
              aria-label="Listenname bearbeiten"
              value={draftListName}
              onChange={(event) => onDraftListNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSaveEditingTitle();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelEditingTitle();
                }
              }}
              autoFocus
            />
            <button type="button" className="icon-button" onClick={onSaveEditingTitle} aria-label="Umbenennen speichern">
              ✓
            </button>
            <button type="button" className="icon-button" onClick={onCancelEditingTitle} aria-label="Umbenennen abbrechen">
              ✕
            </button>
          </div>
        ) : (
          <>
            <h1 title={activeListName}>{activeListName}</h1>
            <button
              type="button"
              className="icon-button"
              onClick={onStartEditingTitle}
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
        <span className="header-meta-text">{openItemsCount} offen</span>
        <span
          className={`backend-status-icon backend-status-icon--${backendConnection}`}
          aria-label={backendLabel}
          title={backendLabel}
          role="img"
        >
          {isBackendBusy ? (
            <span className="backend-spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19.35 10.04A7.49 7.49 0 0 0 5.3 8.16 5.5 5.5 0 0 0 6.5 19h12a4.5 4.5 0 0 0 .85-8.96ZM18.5 17h-12a3.5 3.5 0 1 1 .52-6.97l1.05.16.31-1.02a5.5 5.5 0 0 1 10.67 1.37l.1.96h.97a2.5 2.5 0 0 1 0 5Z"
                fill="currentColor"
              />
            </svg>
          )}
        </span>
      </div>
    </header>
  );
};

export default AppHeader;
