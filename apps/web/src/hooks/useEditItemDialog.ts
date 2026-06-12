import { useCallback, useState } from "react";
import { useStore } from "../state/useStore";
import type { PopupId } from "./usePopupStack";

// Store actions are stable references — select them once at module scope.
const { updateItem } = useStore.getState();

type EditItemDialogOptions = {
  openPopup: (id: PopupId) => void;
  closePopup: (id: PopupId) => void;
};

export const useEditItemDialog = ({ openPopup, closePopup }: EditItemDialogOptions) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQuantity, setEditItemQuantity] = useState("");

  const openEditItem = useCallback((itemId: string, name: string, quantityOrUnit?: string) => {
    setEditingItemId(itemId);
    setEditItemName(name);
    setEditItemQuantity(quantityOrUnit ?? "");
    openPopup("edit-item");
  }, [openPopup]);

  const cancelEditItem = useCallback(() => {
    setEditingItemId(null);
    closePopup("edit-item");
  }, [closePopup]);

  const handleSaveItem = useCallback(async () => {
    if (!editingItemId) {return;}
    const trimmed = editItemName.trim();
    if (!trimmed) {return;}
    await updateItem(
      editingItemId,
      trimmed,
      editItemQuantity.trim() ? editItemQuantity.trim() : undefined,
    );
    setEditingItemId(null);
    closePopup("edit-item");
  }, [editingItemId, editItemName, editItemQuantity, closePopup]);

  return {
    editingItemId,
    editItemName,
    editItemQuantity,
    setEditItemName,
    setEditItemQuantity,
    openEditItem,
    cancelEditItem,
    handleSaveItem,
  };
};
