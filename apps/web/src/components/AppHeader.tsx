import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";

type AppHeaderProps = {
  activeListName: string;
  renameValue: string;
  isEditingName: boolean;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
};

const AppHeader = ({
  activeListName,
  renameValue,
  isEditingName,
  onRenameValueChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
}: AppHeaderProps) => {
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (isEditingName) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (!isEditingName) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const clickedInput = renameInputRef.current?.contains(target);
      const clickedSave = saveButtonRef.current?.contains(target);
      if (clickedInput || clickedSave) {
        return;
      }

      onCancelRename();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isEditingName, onCancelRename]);

  return (
    <header className="app__header" aria-label={t("header.activeList")}>
      <div className="header-card">
        <div className="title-row">
          {isEditingName ? (
            <div className="title-edit" role="group" aria-label={t("header.editListName")}>
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
                aria-label={t("modal.listName")}
                maxLength={120}
              />
              <div className="title-edit__actions">
                <button
                  ref={saveButtonRef}
                  type="button"
                  className="header-chip-button"
                  onClick={onSaveRename}
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1>{activeListName}</h1>
              <button
                type="button"
                className="icon-button"
                onClick={onStartRename}
                aria-label={t("header.editListName")}
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

      </div>
    </header>
  );
};

export default AppHeader;
