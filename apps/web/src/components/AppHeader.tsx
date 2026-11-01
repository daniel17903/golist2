import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ListType } from "@golist/shared/domain/types";
import ListTypeToggle from "./ListTypeToggle";
import { useI18n } from "../i18n";

type AppHeaderProps = {
  activeListName: string;
  activeListType: ListType;
  onChangeListType: (listType: ListType) => void;
  onOpenStats: () => void;
  onSaveRename: (nextName: string) => void;
};

const AppHeader = memo(function AppHeader({
  activeListName,
  activeListType,
  onChangeListType,
  onOpenStats,
  onSaveRename,
}: AppHeaderProps) {
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurSaveRef = useRef(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const { t } = useI18n();

  useEffect(() => {
    if (isEditingName) {
      skipBlurSaveRef.current = false;
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isEditingName]);

  const handleStartRename = useCallback(() => {
    setRenameValue(activeListName);
    setIsEditingName(true);
  }, [activeListName]);

  const handleSaveRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      return;
    }

    setIsEditingName(false);

    if (trimmed !== activeListName) {
      onSaveRename(trimmed);
    }
  }, [renameValue, activeListName, onSaveRename]);

  const handleCancelRename = useCallback(() => {
    setIsEditingName(false);
  }, []);

  return (
    <header className="app__header" aria-label={t("header.activeList")}>
      <div className="header-card">
        <div className="title-row">
          {isEditingName ? (
            <div
              className="title-edit"
              role="group"
              aria-label={t("header.editListName")}
              onBlur={(event) => {
                // Moving focus between the name input and the type toggle
                // (e.g. Tab) stays in edit mode; leaving the group saves.
                if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
                  return;
                }
                if (skipBlurSaveRef.current) {
                  skipBlurSaveRef.current = false;
                  return;
                }
                handleSaveRename();
              }}
            >
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    // Saving unmounts the input, which can still fire blur —
                    // skip it so the rename isn't saved twice.
                    skipBlurSaveRef.current = true;
                    handleSaveRename();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    skipBlurSaveRef.current = true;
                    handleCancelRename();
                  }
                }}
                aria-label={t("modal.listName")}
                maxLength={120}
              />
              {/* Editing a list also lets you switch its type. */}
              <ListTypeToggle value={activeListType} onChange={onChangeListType} />
            </div>
          ) : (
            <>
              <button
                type="button"
                className="title-button"
                onClick={handleStartRename}
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
});

export default AppHeader;
