import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export type PopupId =
  | "drawer"
  | "add-item"
  | "create-list"
  | "join-list"
  | "settings"
  | "list-stats"
  | "legal"
  | "edit-item";

type PopupStack = {
  stack: PopupId[];
  isPopupOpen: boolean;
  // Ref mirror for event handlers that must not re-register on every change.
  isPopupOpenRef: RefObject<boolean>;
  openPopup: (id: PopupId) => void;
  closePopup: (id: PopupId) => void;
  closeTopPopup: () => void;
};

// Single source of truth for which overlays are open. The stack order is the
// open order, so "close the topmost popup" (Android back gesture) peels off
// one layer at a time without a hand-maintained priority list.
export const usePopupStack = (): PopupStack => {
  const [stack, setStack] = useState<PopupId[]>([]);

  const openPopup = useCallback((id: PopupId) => {
    setStack((current) => [...current.filter((entry) => entry !== id), id]);
  }, []);

  const closePopup = useCallback((id: PopupId) => {
    setStack((current) => current.filter((entry) => entry !== id));
  }, []);

  const closeTopPopup = useCallback(() => {
    setStack((current) => current.slice(0, -1));
  }, []);

  const isPopupOpen = stack.length > 0;
  const isPopupOpenRef = useRef(isPopupOpen);
  useEffect(() => { isPopupOpenRef.current = isPopupOpen; });

  return { stack, isPopupOpen, isPopupOpenRef, openPopup, closePopup, closeTopPopup };
};
