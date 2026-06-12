import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type BackGestureTrapOptions = {
  isPopupOpenRef: RefObject<boolean>;
  closeTopPopup: () => void;
};

// Keeps the Android/Firefox back gesture inside the app: a sentinel history
// entry absorbs each back navigation, and an open popup is closed instead.
export const useBackGestureTrap = ({ isPopupOpenRef, closeTopPopup }: BackGestureTrapOptions) => {
  const closeTopPopupRef = useRef(closeTopPopup);
  useEffect(() => { closeTopPopupRef.current = closeTopPopup; });

  useEffect(() => {
    const getHistoryState = (): Record<string, unknown> => {
      const { state } = window.history;
      return typeof state === "object" && state !== null ? state : {};
    };

    const pushSentinel = () => {
      window.history.pushState({ ...getHistoryState(), golistBackBlocked: true }, "");
    };

    // Do NOT push a sentinel on mount. Firefox skips history entries the user
    // never interacted with when navigating back (browser.navigation.
    // requireUserInteraction; Fenix's back gesture uses goBack(userInteraction
    // = true)). A pushState issued before the first interaction buries the
    // initial app entry while it is still "uninteracted", so it can never
    // receive the per-entry interaction flag. The back gesture then skips the
    // entire app history and lands on the PWA session's initial blank entry —
    // the dark grey manifest background_color screen. Pushing the first
    // sentinel only from a user gesture lets that same gesture mark the
    // underlying app entry as interacted, making it the landing target for
    // every back gesture so popstate fires and the trap re-arms.
    let gestureSentinelArmed = false;
    const gestureEvents: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];
    const removeGestureListeners = () => {
      gestureEvents.forEach((eventName) =>
        window.removeEventListener(eventName, armGestureSentinel, true),
      );
    };
    const armGestureSentinel = () => {
      if (gestureSentinelArmed) {
        return;
      }
      gestureSentinelArmed = true;
      pushSentinel();
      removeGestureListeners();
    };
    gestureEvents.forEach((eventName) =>
      window.addEventListener(eventName, armGestureSentinel, { capture: true, passive: true }),
    );

    const handlePopState = () => {
      // Re-push so another trap entry sits above the app entry. Even where the
      // re-pushed entry itself never counts as user-interacted (Firefox), the
      // next back gesture falls through to the interacted app entry below,
      // fires popstate again and re-arms the trap — it never exits the app.
      pushSentinel();

      if (isPopupOpenRef.current) {
        closeTopPopupRef.current();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      removeGestureListeners();
    };
  }, [isPopupOpenRef]);
};
