import type { FormEvent } from "react";
import { extractShareToken } from "../sharing/apiClient";
import { useI18n } from "../i18n";

type JoinListModalProps = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onJoin: () => void;
};

const JoinListModal = ({
  isOpen,
  value,
  onChange,
  onCancel,
  onJoin,
}: JoinListModalProps) => {
  const { t } = useI18n();

  if (!isOpen) {return null;}

  const normalizedValue = extractShareToken(value) ?? value;
  const isJoinDisabled = !extractShareToken(value);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isJoinDisabled) {return;}

    onJoin();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <form
        className="modal"
        onSubmit={handleSubmit}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal__header">
          <h2>{t("modal.joinList")}</h2>
        </div>
        <div className="modal__body">
          <div className="modal__field">
            <label htmlFor="join-list-token">{t("modal.shareToken")}</label>
            <input
              id="join-list-token"
              value={normalizedValue}
              onChange={(event) => onChange(event.target.value)}
              placeholder={t("modal.shareTokenPlaceholder")}
              autoFocus
            />
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="text-button" disabled={isJoinDisabled}>
            {t("modal.join")}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JoinListModal;
