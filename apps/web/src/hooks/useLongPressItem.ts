import { useRef } from "react";
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
};

export const useLongPressItem = ({
  onLongPress,
  onShortPress,
  delay = 600
}: LongPressHandlers): LongPressReturn => {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const handlePointerDown = (itemId: string, name: string, quantityOrUnit?: string) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress(itemId, name, quantityOrUnit);
    }, delay);
  };

  const handlePointerUp = (itemId: string) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    if (!longPressTriggeredRef.current) {
      void onShortPress(itemId);
    }
    longPressTriggeredRef.current = false;
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTriggeredRef.current = false;
  };

  return {
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    longPressTriggeredRef
  };
};
