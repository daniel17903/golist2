import { useCallback, useEffect, useRef, useState } from "react";
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

  const onLongPressRef = useRef(onLongPress);
  useEffect(() => { onLongPressRef.current = onLongPress; });

  const onShortPressRef = useRef(onShortPress);
  useEffect(() => { onShortPressRef.current = onShortPress; });

  const delayRef = useRef(delay);
  useEffect(() => { delayRef.current = delay; });

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current === null) {
      return;
    }
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const handlePointerDown = useCallback((itemId: string, name: string, quantityOrUnit?: string) => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    setPressedItemId(itemId);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPressRef.current(itemId, name, quantityOrUnit);
    }, delayRef.current);
  }, [clearLongPressTimer]);

  const handlePointerUp = useCallback((itemId: string) => {
    clearLongPressTimer();
    setPressedItemId((current) => (current === itemId ? null : current));
    if (!longPressTriggeredRef.current) {
      void onShortPressRef.current(itemId);
    }
    longPressTriggeredRef.current = false;
  }, [clearLongPressTimer]);

  const handlePointerCancel = useCallback(() => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    setPressedItemId(null);
  }, [clearLongPressTimer]);

  return {
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    longPressTriggeredRef,
    pressedItemId,
  };
};
