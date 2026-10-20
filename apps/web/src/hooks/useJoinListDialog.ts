import { useCallback, useState } from "react";
import { useStore } from "../state/useStore";
import type { PopupId } from "./usePopupStack";

// Store actions are stable references — select them once at module scope.
const { joinSharedList } = useStore.getState();

type JoinListDialogOptions = {
  openPopup: (id: PopupId) => void;
  closePopup: (id: PopupId) => void;
  // Called when redeeming the token fails; the dialog stays open so the user
  // can correct the token.
  onJoinFailed: () => void;
};

export const useJoinListDialog = ({ openPopup, closePopup, onJoinFailed }: JoinListDialogOptions) => {
  const [joinListValue, setJoinListValue] = useState("");

  const openJoinList = useCallback(() => {
    setJoinListValue("");
    closePopup("drawer");
    openPopup("join-list");
  }, [openPopup, closePopup]);

  const cancelJoinList = useCallback(() => {
    setJoinListValue("");
    closePopup("join-list");
  }, [closePopup]);

  const joinWithValue = useCallback(async (value: string) => {
    try {
      await joinSharedList(value);
    } catch {
      onJoinFailed();
      return;
    }
    setJoinListValue("");
    closePopup("join-list");
  }, [closePopup, onJoinFailed]);

  const handleJoinList = useCallback(() => joinWithValue(joinListValue), [joinWithValue, joinListValue]);

  // Joins with a link pasted from the clipboard in one tap.
  const handlePasteJoin = useCallback((pastedValue: string) => {
    setJoinListValue(pastedValue);
    void joinWithValue(pastedValue);
  }, [joinWithValue]);

  return {
    joinListValue,
    setJoinListValue,
    openJoinList,
    cancelJoinList,
    handleJoinList,
    handlePasteJoin,
  };
};
