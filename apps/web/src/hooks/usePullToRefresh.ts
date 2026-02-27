import { useRef, useState } from "react";
import type { TouchEvent } from "react";

type UsePullToRefreshOptions = {
  isEnabled: boolean;
  onRefresh: () => Promise<void>;
};


const MAX_PULL_DISTANCE = 110;
const TRIGGER_PULL_DISTANCE = 72;

export const usePullToRefresh = ({ isEnabled, onRefresh }: UsePullToRefreshOptions) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const reset = () => {
    startYRef.current = null;
    isTrackingRef.current = false;
    setPullDistance(0);
  };

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (!isEnabled || isRefreshingRef.current || event.touches.length !== 1) {
      return;
    }

    if (window.scrollY > 0) {
      return;
    }

    startYRef.current = event.touches[0]?.clientY ?? null;
    isTrackingRef.current = startYRef.current !== null;
  };

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (!isTrackingRef.current || startYRef.current === null || isRefreshingRef.current) {
      return;
    }

    const touchY = event.touches[0]?.clientY;
    if (typeof touchY !== "number") {
      return;
    }

    const delta = touchY - startYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    const dampedDelta = Math.min(MAX_PULL_DISTANCE, delta * 0.45);
    if (dampedDelta > 0) {
      event.preventDefault();
    }
    setPullDistance(dampedDelta);
  };

  const onTouchEnd = () => {
    if (!isTrackingRef.current || isRefreshingRef.current) {
      reset();
      return;
    }

    const shouldRefresh = pullDistance >= TRIGGER_PULL_DISTANCE;
    if (!shouldRefresh) {
      reset();
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    void onRefresh().finally(() => {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      reset();
    });
  };

  return {
    pullDistance,
    isRefreshing,
    isPulling: pullDistance > 0,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: reset,
  };
};
