import { useEffect, useRef } from "react";

type AppHeaderProps = {
  activeListName: string;
  openItemsCount: number;
  isEditingTitle: boolean;
  draftTitle: string;
  onStartEditing: () => void;
  onDraftTitleChange: (value: string) => void;
  onSaveTitle: () => void;
  onCancelTitle: () => void;
  backendConnection: "unknown" | "online" | "offline";
  hasActiveBackendRequests: boolean;
};

const statusLabelByConnection: Record<AppHeaderProps["backendConnection"], string> = {
  unknown: "Backend-Status unbekannt",
  online: "Backend verbunden",
  offline: "Backend nicht erreichbar",
};

const AppHeader = ({
  activeListName,
  openItemsCount,
  isEditingTitle,
  draftTitle,
  onStartEditing,
  onDraftTitleChange,
  onSaveTitle,
  onCancelTitle,
  backendConnection,
  hasActiveBackendRequests,
}: AppHeaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingTitle) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditingTitle]);

  return (
    <header className="app__header" aria-label="Listenkopf">
      <div className="title-row">
        {isEditingTitle ? (
          <div className="title-edit">
            <label htmlFor="rename-list-input" className="sr-only">
              Listenname bearbeiten
            </label>
            <input
              id="rename-list-input"
              ref={inputRef}
              value={draftTitle}
              onChange={(event) => onDraftTitleChange(event.target.value)}
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
              aria-label="Listenname"
            />
            <button type="button" className="icon-button" onClick={onSaveTitle} aria-label="Umbenennen speichern">
              ✓
            </button>
            <button type="button" className="icon-button" onClick={onCancelTitle} aria-label="Umbenennen abbrechen">
              ✕
            </button>
          </div>
        ) : (
          <>
            <h1 title={activeListName}>{activeListName}</h1>
            <div className="header-actions">
              {hasActiveBackendRequests ? (
                <span className="connection-spinner" role="status" aria-label="Backend-Anfrage läuft" title="Backend-Anfrage läuft" />
              ) : (
                <span
                  className={`connection-icon connection-icon--${backendConnection}`}
                  aria-label={statusLabelByConnection[backendConnection]}
                  title={statusLabelByConnection[backendConnection]}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3H4V5zm0 6h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8zm3 2v2h3v-2H7zm5 0v2h5v-2h-5z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
              )}
              <button
                type="button"
                className="icon-button"
                onClick={onStartEditing}
                aria-label="Listennamen bearbeiten"
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
        <span>{openItemsCount} offen</span>
      </div>
    </header>
  );
};

export default AppHeader;
