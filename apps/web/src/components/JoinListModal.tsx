import { memo, type FormEvent } from "react";
import Modal from "./Modal";
import { extractShareToken } from "../sharing/apiClient";
import { useI18n } from "../i18n";

type JoinListModalProps = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onJoin: () => void;
};

const JoinListModal = memo(function JoinListModal({
  isOpen,
  value,
  onChange,
  onCancel,
  onJoin,
}: JoinListModalProps) {
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
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("modal.shareTokenPlaceholder")}
          autoFocus
        />
      </div>
    </Modal>
  );
});

export default JoinListModal;
