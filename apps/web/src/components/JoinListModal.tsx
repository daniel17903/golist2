import { memo, useState, type FormEvent } from "react";
import Modal from "./Modal";
import { extractShareToken } from "../sharing/apiClient";
import { useI18n } from "../i18n";

type JoinListModalProps = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onJoin: () => void;
  // Joins with a share link read from the clipboard.
  onPasteJoin: (value: string) => void;
};

// Reading the clipboard needs a user gesture (iOS then shows its own "Paste"
// confirmation), so it can only happen from a button tap.
const canReadClipboard = () => typeof navigator.clipboard?.readText === "function";

const JoinListModal = memo(function JoinListModal({
  isOpen,
  value,
  onChange,
  onCancel,
  onJoin,
  onPasteJoin,
}: JoinListModalProps) {
  const { t } = useI18n();
  const [pasteError, setPasteError] = useState<"unreadable" | "noLink" | null>(null);

  if (!isOpen) {return null;}

  const normalizedValue = extractShareToken(value) ?? value;
  const isJoinDisabled = !extractShareToken(value);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isJoinDisabled) {return;}

    onJoin();
  };

  const handlePaste = () => {
    void (async () => {
      let pasted: string;
      try {
        pasted = await navigator.clipboard.readText();
      } catch {
        // Permission denied or the iOS "Paste" prompt was dismissed.
        setPasteError("unreadable");
        return;
      }
      if (!extractShareToken(pasted)) {
        setPasteError("noLink");
        return;
      }
      setPasteError(null);
      onPasteJoin(pasted);
    })();
  };

  return (
    <Modal
      title={t("modal.joinList")}
      onClose={onCancel}
      onSubmit={handleSubmit}
      actions={
        <>
          <button type="button" className="text-button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="text-button" disabled={isJoinDisabled}>
            {t("modal.join")}
          </button>
        </>
      }
    >
      <div className="modal__field">
        <label htmlFor="join-list-token">{t("modal.shareToken")}</label>
        <input
          id="join-list-token"
          value={normalizedValue}
          onChange={(event) => {
            setPasteError(null);
            onChange(event.target.value);
          }}
          placeholder={t("modal.shareTokenPlaceholder")}
          autoFocus
        />
      </div>
      {canReadClipboard() ? (
        <div className="join-list__paste">
          <button type="button" className="text-button" onClick={handlePaste}>
            {t("joinList.paste")}
          </button>
          {pasteError ? (
            <p className="join-list__paste-error" role="alert">
              {pasteError === "noLink" ? t("joinList.pasteFailed") : t("joinList.pasteUnreadable")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
});

export default JoinListModal;
