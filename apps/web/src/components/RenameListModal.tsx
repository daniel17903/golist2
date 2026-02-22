import { useTranslation } from "react-i18next";

type RenameListModalProps = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const RenameListModal = ({ isOpen, value, onChange, onCancel, onSave }: RenameListModalProps) => {
  const { t } = useTranslation();
  if (!isOpen) {return null;}

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal" onClick={(event) => { event.stopPropagation(); }}>
        <div className="modal__header"><h2>{t("dialog.editList")}</h2></div>
        <div className="modal__body"><div className="modal__field"><label htmlFor="list-name">{t("dialog.name")}</label><input id="list-name" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t("dialog.listNamePlaceholder")} /></div></div>
        <div className="modal__actions"><button type="button" className="text-button" onClick={onCancel}>{t("dialog.cancel")}</button><button type="button" className="text-button" onClick={onSave}>{t("dialog.save")}</button></div>
      </div>
    </div>
  );
};

export default RenameListModal;
