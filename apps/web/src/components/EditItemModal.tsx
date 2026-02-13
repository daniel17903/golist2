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
  onSave
}: EditItemModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal__header">
          <h2>Eintrag bearbeiten</h2>
        </div>
        <div className="modal__body">
          <div className="modal__field">
            <label htmlFor="item-name">Name</label>
            <input
              id="item-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Name"
            />
          </div>
          <div className="modal__field">
            <label htmlFor="item-quantity">Menge</label>
            <input
              id="item-quantity"
              value={quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
              placeholder="Menge"
            />
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" className="text-button" onClick={onSave}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditItemModal;
