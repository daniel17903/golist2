import { memo, type FormEvent } from "react";
import Modal from "./Modal";
import { useI18n } from "../i18n";

type CreateListModalProps = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const CreateListModal = memo(function CreateListModal({
  isOpen,
  value,
  onChange,
  onCancel,
  onSave,
}: CreateListModalProps) {
  const { t } = useI18n();

  if (!isOpen) {return null;}

  const isSaveDisabled = !value.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaveDisabled) {return;}

    onSave();
  };

  return (
    <Modal
      title={t("modal.createList")}
      onClose={onCancel}
      onSubmit={handleSubmit}
      actions={
        <>
          <button type="button" className="text-button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="text-button" disabled={isSaveDisabled}>
            {t("modal.create")}
          </button>
        </>
      }
    >
      <div className="modal__field">
        <label htmlFor="new-list-name">{t("common.name")}</label>
        <input
          id="new-list-name"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("modal.listName")}
          autoFocus
        />
      </div>
    </Modal>
  );
});

export default CreateListModal;
