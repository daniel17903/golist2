import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import { useEffect, useRef } from "react";
import { getItemIcon } from "../domain/categories";
import { parseItemInput } from "../domain/inputParser";

type AddItemDialogProps = {
  isOpen: boolean;
  itemName: string;
  suggestions: string[];
  onItemNameChange: (value: string) => void;
  onClose: () => void;
  onAddItem: () => void;
  onAddSuggestion: (name: string, quantityOrUnit?: string) => void;
};

const AddItemDialog = ({
  isOpen,
  itemName,
  suggestions,
  onItemNameChange,
  onClose,
  onAddItem,
  onAddSuggestion
}: AddItemDialogProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      className="add-dialog"
      slotProps={{
        paper: {
          className: "modal"
        }
      }}
    >
      <DialogContent className="modal__body">
        <form
          className="add-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void onAddItem();
          }}
        >
          <input
            ref={inputRef}
            value={itemName}
            onChange={(event) => onItemNameChange(event.target.value)}
            placeholder="Was möchtest du einkaufen?"
            aria-label="Item name"
          />
        </form>
        <div className="modal__grid">
          {suggestions.map((name) => {
            const parsed = parseItemInput(name);
            const displayName = parsed.name || name;
            return (
              <button
                key={name}
                type="button"
                className="item-card item-card--dialog"
                onClick={() => {
                  if (!parsed.name) return;
                  void onAddSuggestion(parsed.name, parsed.quantityOrUnit);
                }}
              >
                <span className="item-icon" aria-hidden="true">
                  <img src={getItemIcon(displayName)} alt="" />
                </span>
                <div className="item-text">
                  <span className="item-name">{displayName}</span>
                  {parsed.quantityOrUnit && (
                    <span className="item-quantity">{parsed.quantityOrUnit}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemDialog;
