import { useCallback, useState } from "react";
import { useStore } from "../state/useStore";
import type { PopupId } from "./usePopupStack";

// Store actions are stable references — select them once at module scope.
const { joinSharedList } = useStore.getState();

type JoinListDialogOptions = {
  openPopup: (id: PopupId) => void;
  closePopup: (id: PopupId) => void;
};

export const useJoinListDialog = ({ openPopup, closePopup }: JoinListDialogOptions) => {
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
    await joinSharedList(joinListValue);
    setJoinListValue("");
    closePopup("join-list");
  }, [joinListValue, closePopup]);

  return {
    joinListValue,
    setJoinListValue,
    openJoinList,
    cancelJoinList,
    handleJoinList,
  };
};
