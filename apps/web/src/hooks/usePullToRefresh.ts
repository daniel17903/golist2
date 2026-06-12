import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const PULL_THRESHOLD = 72;
const PULL_SUPPRESSION_THRESHOLD = 10;
const MAX_PULL = 96;
const MIN_SPINNER_VISIBLE_MS = 1000;

type PullToRefreshOptions = {
  isPopupOpenRef: RefObject<boolean>;
  onPullDetected: () => void;
  refresh: () => Promise<unknown>;
};

// Window-level touch handling for the pull-to-refresh gesture. The pull
// distance is written straight to the indicator element so the whole app
// doesn't re-render on every touchmove frame while pulling.
export const usePullToRefresh = ({ isPopupOpenRef, onPullDetected, refresh }: PullToRefreshOptions) => {
  const pullStartYRef = useRef<number | null>(null);
  const pullIndicatorRef = useRef<HTMLDivElement | null>(null);
  const pullDistanceRef = useRef(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const isPullRefreshingRef = useRef(false);
  const pullRefreshStartedAtRef = useRef<number | null>(null);
  // Set while a pull gesture is in progress so item press handlers can ignore
  // the touch; cleared by the consumer on the next pointer-up.
  const suppressItemPressRef = useRef(false);

  const onPullDetectedRef = useRef(onPullDetected);
  useEffect(() => { onPullDetectedRef.current = onPullDetected; });

  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });

  useEffect(() => {
    const getScrollY = () => document.body.scrollTop || window.scrollY || document.scrollingElement?.scrollTop || 0;

    const setPullDistance = (distance: number) => {
      pullDistanceRef.current = distance;
      const indicator = pullIndicatorRef.current;
      if (indicator) {
        indicator.style.transform = `translate(-50%, ${-56 + distance}px)`;
      }
    };

    const setPullRefreshing = (value: boolean) => {
      isPullRefreshingRef.current = value;
      setIsPullRefreshing(value);
    };

    const onTouchStart = (event: TouchEvent) => {
      suppressItemPressRef.current = false;
      if (isPopupOpenRef.current || isPullRefreshingRef.current || event.touches.length !== 1 || getScrollY() > 0) {
        pullStartYRef.current = null;
        return;
      }

      pullStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (pullStartYRef.current === null || isPopupOpenRef.current || isPullRefreshingRef.current) {
        return;
      }

      const currentY = event.touches[0]?.clientY;
      if (typeof currentY !== "number") {
        return;
      }

      const rawDistance = currentY - pullStartYRef.current;
      if (rawDistance <= 0) {
        if (pullDistanceRef.current !== 0) {
          setPullDistance(0);
        }
        return;
      }

      const pullDistanceAfterThreshold = rawDistance - PULL_SUPPRESSION_THRESHOLD;
      if (pullDistanceAfterThreshold <= 0) {
        return;
      }

      suppressItemPressRef.current = true;
      onPullDetectedRef.current();
      event.preventDefault();
      setPullDistance(Math.min(MAX_PULL, pullDistanceAfterThreshold * 0.45));
    };

    const onTouchEnd = () => {
      pullStartYRef.current = null;
      const shouldRefresh =
        pullDistanceRef.current >= PULL_THRESHOLD && !isPopupOpenRef.current && !isPullRefreshingRef.current;

      if (!shouldRefresh) {
        setPullDistance(0);
        return;
      }

      setPullDistance(PULL_THRESHOLD);
      setPullRefreshing(true);
      pullRefreshStartedAtRef.current = Date.now();

      void refreshRef.current()
        .catch(() => "failed")
        .finally(() => {
          const startedAt = pullRefreshStartedAtRef.current ?? Date.now();
          const elapsed = Date.now() - startedAt;
          const remainingMs = Math.max(0, MIN_SPINNER_VISIBLE_MS - elapsed);

          window.setTimeout(() => {
            setPullRefreshing(false);
            setPullDistance(0);
            pullRefreshStartedAtRef.current = null;
          }, remainingMs);
        });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isPopupOpenRef]);

  return { pullIndicatorRef, isPullRefreshing, suppressItemPressRef };
};
