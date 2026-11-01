import { useCallback, useState } from "react";
import { defaultListType, type ListType } from "@golist/shared/domain/types";
import { useStore } from "../state/useStore";
import type { PopupId } from "./usePopupStack";

// Store actions are stable references — select them once at module scope.
const { addList } = useStore.getState();

type CreateListDialogOptions = {
  openPopup: (id: PopupId) => void;
  closePopup: (id: PopupId) => void;
};

export const useCreateListDialog = ({ openPopup, closePopup }: CreateListDialogOptions) => {
  const [createListName, setCreateListName] = useState("");
  const [createListType, setCreateListType] = useState<ListType>(defaultListType);

  const openCreateList = useCallback(() => {
    setCreateListName("");
    setCreateListType(defaultListType);
    closePopup("drawer");
    openPopup("create-list");
  }, [openPopup, closePopup]);

  const cancelCreateList = useCallback(() => {
    setCreateListName("");
    closePopup("create-list");
  }, [closePopup]);

  const handleConfirmCreateList = useCallback(async () => {
    const trimmedName = createListName.trim();
    if (!trimmedName) {
      return;
    }

    await addList(trimmedName, createListType);
    setCreateListName("");
    closePopup("create-list");
  }, [createListName, createListType, closePopup]);

  return {
    createListName,
    setCreateListName,
    createListType,
    setCreateListType,
    openCreateList,
    cancelCreateList,
    handleConfirmCreateList,
  };
};
