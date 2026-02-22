import { useEffect, useRef } from "react";

type AppHeaderProps = {
  activeListName: string;
  openItemCount: number;
  backendConnection: "unknown" | "online" | "offline";
  isBackendBusy: boolean;
  renameValue: string;
  isEditingName: boolean;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
};

const AppHeader = ({
  activeListName,
  openItemCount,
  backendConnection,
  isBackendBusy,
  renameValue,
  isEditingName,
  onRenameValueChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
}: AppHeaderProps) => {
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditingName) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isEditingName]);

  return (
    <header className="app__header" aria-label="Aktive Liste">
      <div className="header-card">
        <div className="title-row">
          {isEditingName ? (
            <div className="title-edit" role="group" aria-label="Listenname bearbeiten">
              <input
                ref={renameInputRef}
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
                aria-label="Listenname"
                maxLength={120}
              />
              <button type="button" className="header-chip-button" onClick={onSaveRename}>
                Speichern
              </button>
              <button type="button" className="header-chip-button" onClick={onCancelRename}>
                Abbrechen
              </button>
            </div>
          ) : (
            <>
              <h1>{activeListName}</h1>
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
            </>
          )}
        </div>

        <div className="header-meta-row">
          <span className="header-meta">{openItemCount} offen</span>
          <span className="header-status" role="status" aria-live="polite">
            {isBackendBusy ? (
              <span
                className="connection-spinner"
                aria-label="Backend synchronisiert gerade"
                title="Backend synchronisiert gerade"
              />
            ) : (
              <span
                className={`connection-icon connection-icon--${backendConnection}`}
                aria-label={`Backend Status: ${backendConnection}`}
                title={`Backend Status: ${backendConnection}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M19 18H6a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 17.06 9a3.75 3.75 0 0 1 1.94 7z"
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
