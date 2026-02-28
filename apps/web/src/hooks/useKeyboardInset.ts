import { useEffect } from "react";

const KEYBOARD_INSET_CSS_VAR = "--keyboard-inset";

const updateKeyboardInset = () => {
  const viewport = window.visualViewport;

  if (!viewport) {
    document.documentElement.style.setProperty(KEYBOARD_INSET_CSS_VAR, "0px");
    return;
  }

  const keyboardInset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
  document.documentElement.style.setProperty(KEYBOARD_INSET_CSS_VAR, `${keyboardInset}px`);
};

export const useKeyboardInset = () => {
  useEffect(() => {
    updateKeyboardInset();

    const viewport = window.visualViewport;

    window.addEventListener("resize", updateKeyboardInset);
    window.addEventListener("orientationchange", updateKeyboardInset);
    viewport?.addEventListener("resize", updateKeyboardInset);
    viewport?.addEventListener("scroll", updateKeyboardInset);

    return () => {
      window.removeEventListener("resize", updateKeyboardInset);
      window.removeEventListener("orientationchange", updateKeyboardInset);
      viewport?.removeEventListener("resize", updateKeyboardInset);
      viewport?.removeEventListener("scroll", updateKeyboardInset);
      document.documentElement.style.removeProperty(KEYBOARD_INSET_CSS_VAR);
    };
  }, []);
};
