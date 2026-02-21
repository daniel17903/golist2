import { useEffect, useRef } from "react";

type AppHeaderProps = {
  activeListName: string;
  openItemCount: number;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSaveRename: () => void;
  backendConnection: "unknown" | "online" | "offline";
  isBackendBusy: boolean;
};

const AppHeader = ({
  activeListName,
  openItemCount,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onStartRename,
  onCancelRename,
  onSaveRename,
  backendConnection,
  isBackendBusy,
}: AppHeaderProps) => {
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isRenaming) {
      return;
    }
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [isRenaming]);

  const backendLabel = isBackendBusy
    ? "Backend status: Synchronisiert"
    : `Backend status: ${backendConnection}`;

  return (
    <header className="app__header">
      <div className="app__header-glass">
        <div className="title-row">
          {isRenaming ? (
            <div className="title-edit">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(event) => onRenameValueChange(event.target.value)}
                aria-label="List name"
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
              />
              <button type="button" className="icon-button" onClick={onSaveRename} aria-label="Save list name">
                ✓
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={onCancelRename}
                aria-label="Cancel list name edit"
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <h1>{activeListName}</h1>
              <div className="header-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={onStartRename}
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
        <div className="header-meta-row">
          <span>{openItemCount} offen</span>
          <span className="header-meta-row__divider" aria-hidden="true">
            •
          </span>
          <span className="backend-status" aria-label={backendLabel} title={backendLabel}>
            {isBackendBusy ? (
              <span className="backend-spinner" aria-hidden="true" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 18a4 4 0 0 1-.65-7.95A6.5 6.5 0 0 1 17.44 8.6 4 4 0 1 1 18 18H6Zm0-2h12a2 2 0 1 0-.38-3.96l-1.08-.2-.24-1.07A4.5 4.5 0 0 0 7.74 11l-.15.9-.89.23A2 2 0 0 0 6 16Z"
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
