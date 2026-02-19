type AppHeaderProps = {
  activeListName: string;
  isEditingName: boolean;
  draftListName: string;
  itemCount: number;
  backendConnection: "unknown" | "online" | "offline";
  onStartEditingName: () => void;
  onDraftNameChange: (value: string) => void;
  onCancelEditingName: () => void;
  onSaveListName: () => void;
};

const connectionLabel: Record<AppHeaderProps["backendConnection"], string> = {
  unknown: "Verbinde…",
  online: "Online",
  offline: "Offline",
};

const AppHeader = ({
  activeListName,
  isEditingName,
  draftListName,
  itemCount,
  backendConnection,
  onStartEditingName,
  onDraftNameChange,
  onCancelEditingName,
  onSaveListName,
}: AppHeaderProps) => {
  return (
    <header className="app__header" aria-label="List header">
      <div className="title-row">
        {isEditingName ? (
          <form
            className="title-edit"
            onSubmit={(event) => {
              event.preventDefault();
              void onSaveListName();
            }}
          >
            <input
              value={draftListName}
              onChange={(event) => onDraftNameChange(event.target.value)}
              placeholder="Listenname"
              aria-label="List name"
              autoFocus
            />
            <button type="submit" className="ghost-button">Speichern</button>
            <button type="button" className="ghost-button ghost-button--secondary" onClick={onCancelEditingName}>
              Abbrechen
            </button>
          </form>
        ) : (
          <>
            <h1>{activeListName}</h1>
            <button
              type="button"
              className="icon-button"
              onClick={onStartEditingName}
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
      <div className="header-meta">
        <span className="header-meta__count">{itemCount} offen</span>
        <span
          className={`connection-pill connection-pill--${backendConnection}`}
          aria-label={`Backend status: ${connectionLabel[backendConnection]}`}
          title={`Backend status: ${connectionLabel[backendConnection]}`}
        >
          <span className="connection-pill__dot" aria-hidden="true" />
          {connectionLabel[backendConnection]}
        </span>
      </div>
    </header>
  );
};

export default AppHeader;
