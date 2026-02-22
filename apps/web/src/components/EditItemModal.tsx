import { useI18n } from "../i18n";

type EditItemModalProps = {
  isOpen: boolean;
  name: string;
  quantity: string;
  onNameChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const EditItemModal = ({
  isOpen,
  name,
  quantity,
  onNameChange,
  onQuantityChange,
  onCancel,
  onSave,
}: EditItemModalProps) => {
  const { t } = useI18n();
  if (!isOpen) {return null;}

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <h2>{t("editItem.title")}</h2>
        </div>
        <div className="modal__body">
          <div className="modal__field">
            <label htmlFor="item-name">{t("common.name")}</label>
            <input id="item-name" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={t("common.name")} />
          </div>
          <div className="modal__field">
            <label htmlFor="item-quantity">{t("editItem.quantity")}</label>
            <input
              id="item-quantity"
              value={quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
              placeholder={t("editItem.quantity")}
            />
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="button" className="text-button" onClick={onSave}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditItemModal;
