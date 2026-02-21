type CreateListModalProps = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const CreateListModal = ({
  isOpen,
  value,
  onChange,
  onCancel,
  onSave,
}: CreateListModalProps) => {
  if (!isOpen) {return null;}

  const isSaveDisabled = !value.trim();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal__header">
          <h2>Neue Liste erstellen</h2>
        </div>
        <div className="modal__body">
          <div className="modal__field">
            <label htmlFor="new-list-name">Name</label>
            <input
              id="new-list-name"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Listenname"
              autoFocus
            />
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" className="text-button" onClick={onSave} disabled={isSaveDisabled}>
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateListModal;
