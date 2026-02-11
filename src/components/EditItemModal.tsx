import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import type { ChangeEvent } from "react";

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
  return (
    <Dialog
      open={isOpen}
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          className: "modal"
        }
      }}
    >
      <DialogTitle className="modal__header">
        <h2>Eintrag bearbeiten</h2>
      </DialogTitle>
      <DialogContent className="modal__body">
        <div className="modal__field">
          <label htmlFor="item-name">Name</label>
          <TextField
            id="item-name"
            fullWidth
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onNameChange(event.target.value)}
            placeholder="Name"
            variant="outlined"
            size="small"
          />
        </div>
        <div className="modal__field">
          <label htmlFor="item-quantity">Menge</label>
          <TextField
            id="item-quantity"
            fullWidth
            value={quantity}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onQuantityChange(event.target.value)
            }
            placeholder="Menge"
            variant="outlined"
            size="small"
          />
        </div>
      </DialogContent>
      <DialogActions className="modal__actions">
        <Button type="button" className="text-button" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="button" className="text-button" onClick={onSave}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditItemModal;
