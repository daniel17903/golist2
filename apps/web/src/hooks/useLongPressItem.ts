import { useRef, useState } from "react";
import type { MutableRefObject } from "react";

type LongPressHandlers = {
  onLongPress: (itemId: string, name: string, quantityOrUnit?: string) => void;
  onShortPress: (itemId: string) => void | Promise<void>;
  delay?: number;
};

type LongPressReturn = {
  handlePointerDown: (itemId: string, name: string, quantityOrUnit?: string) => void;
  handlePointerUp: (itemId: string) => void;
  handlePointerCancel: () => void;
  longPressTriggeredRef: MutableRefObject<boolean>;
  pressedItemId: string | null;
};

export const useLongPressItem = ({
  onLongPress,
  onShortPress,
  delay = 600,
}: LongPressHandlers): LongPressReturn => {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [pressedItemId, setPressedItemId] = useState<string | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current === null) {
      return;
    }
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const handlePointerDown = (itemId: string, name: string, quantityOrUnit?: string) => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    setPressedItemId(itemId);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress(itemId, name, quantityOrUnit);
    }, delay);
  };

  const handlePointerUp = (itemId: string) => {
    clearLongPressTimer();
    setPressedItemId((current) => (current === itemId ? null : current));
    if (!longPressTriggeredRef.current) {
      void onShortPress(itemId);
    }
    longPressTriggeredRef.current = false;
  };

  const handlePointerCancel = () => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    setPressedItemId(null);
  };

  return {
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    longPressTriggeredRef,
    pressedItemId,
  };
};
