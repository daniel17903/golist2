import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";

type AppHeaderProps = {
  activeListName: string;
  renameValue: string;
  isEditingName: boolean;
  onOpenStats: () => void;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
};

const AppHeader = ({
  activeListName,
  renameValue,
  isEditingName,
  onOpenStats,
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
              <button
                type="button"
                className="title-button"
                onClick={onStartRename}
                aria-label={t("header.editListName")}
              >
                {activeListName}
              </button>
              <button
                type="button"
                className="header-icon-button"
                onClick={onOpenStats}
                aria-label={t("header.openStats")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 9.2h2.6V19H5V9.2zm5.7-4.2h2.6V19h-2.6V5zm5.7 7.1H19V19h-2.6v-6.9z"
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
