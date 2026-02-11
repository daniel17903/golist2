import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import type { ChangeEvent } from "react";

type RenameListModalProps = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const RenameListModal = ({
  isOpen,
  value,
  onChange,
  onCancel,
  onSave
}: RenameListModalProps) => {
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
        <h2>Liste bearbeiten</h2>
      </DialogTitle>
      <DialogContent className="modal__body">
        <div className="modal__field">
          <label htmlFor="list-name">Name</label>
          <TextField
            id="list-name"
            fullWidth
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
            placeholder="Listenname"
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

export default RenameListModal;
