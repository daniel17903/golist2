import { useI18n } from "../i18n";

type CreateListModalProps = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const CreateListModal = ({ isOpen, value, onChange, onCancel, onSave }: CreateListModalProps) => {
  const { t } = useI18n();
  if (!isOpen) {return null;}

  const isSaveDisabled = !value.trim();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <h2>{t("createList.title")}</h2>
        </div>
        <div className="modal__body">
          <div className="modal__field">
            <label htmlFor="new-list-name">{t("common.name")}</label>
            <input
              id="new-list-name"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={t("createList.placeholder")}
              autoFocus
            />
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="button" className="text-button" onClick={onSave} disabled={isSaveDisabled}>
            {t("common.create")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateListModal;
