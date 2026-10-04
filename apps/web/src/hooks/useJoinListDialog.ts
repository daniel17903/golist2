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

  const handleJoinList = useCallback(async () => {
    try {
      await joinSharedList(joinListValue);
    } catch {
      onJoinFailed();
      return;
    }
    setJoinListValue("");
    closePopup("join-list");
  }, [joinListValue, closePopup, onJoinFailed]);

  return {
    joinListValue,
    setJoinListValue,
    openJoinList,
    cancelJoinList,
    handleJoinList,
  };
};
