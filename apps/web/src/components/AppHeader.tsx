type AppHeaderProps = {
  activeListName: string;
  openItemsCount: number;
  isEditingTitle: boolean;
  titleDraft: string;
  onEditListName: () => void;
  onTitleDraftChange: (value: string) => void;
  onSaveTitle: () => void;
  onCancelTitle: () => void;
  backendConnection: "unknown" | "online" | "offline";
  hasPendingBackendRequest: boolean;
};

const AppHeader = ({
  activeListName,
  openItemsCount,
  isEditingTitle,
  titleDraft,
  onEditListName,
  onTitleDraftChange,
  onSaveTitle,
  onCancelTitle,
  backendConnection,
  hasPendingBackendRequest,
}: AppHeaderProps) => {
  const metadataLabel = `${openItemsCount} offen`;

  return (
    <header className="app__header" role="banner">
      <div className="app__header-glass">
        <div className="title-row">
          {isEditingTitle ? (
            <div className="title-edit">
              <input
                value={titleDraft}
                onChange={(event) => onTitleDraftChange(event.target.value)}
                autoFocus
                aria-label="Listenname bearbeiten"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSaveTitle();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelTitle();
                  }
                }}
              />
              <button type="button" className="ghost-button" onClick={onSaveTitle}>
                Speichern
              </button>
              <button type="button" className="ghost-button" onClick={onCancelTitle}>
                Abbrechen
              </button>
            </div>
          ) : (
            <>
              <h1>{activeListName}</h1>
              <div className="header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={onEditListName}
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

        <div className="header-meta-row">
          <span className="header-meta-row__count" title={`${openItemsCount} offene Einträge`}>
            {metadataLabel}
          </span>
          <span
            className={`header-status ${hasPendingBackendRequest ? "header-status--loading" : ""}`}
            aria-label={
              hasPendingBackendRequest
                ? "Backend-Anfrage läuft"
                : `Backend-Status: ${backendConnection}`
            }
            title={
              hasPendingBackendRequest
                ? "Backend-Anfrage läuft"
                : `Backend-Status: ${backendConnection}`
            }
          >
            {hasPendingBackendRequest ? (
              <span className="header-status__spinner" aria-hidden="true" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 19h16v-8h-2v6H6v-6H4v8zm8-16c-3.31 0-6 2.69-6 6h2a4 4 0 0 1 8 0h2c0-3.31-2.69-6-6-6z"
                  fill="currentColor"
                />
              </svg>
            )}
          </span>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
