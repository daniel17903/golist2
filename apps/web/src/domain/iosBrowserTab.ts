export type DisplayEnvironment = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  // Safari's non-standard `navigator.standalone` (true inside a home-screen web app).
  standalone: boolean | undefined;
  displayModeStandalone: boolean;
};

// True when the page runs in a regular iOS browser tab (Safari or an in-app
// browser) rather than the installed home-screen web app. iOS cannot open a
// home-screen web app from a link, and the two keep separate storage, so a
// list joined here would not show up in the installed app.
export const isIosBrowserTab = (environment: DisplayEnvironment): boolean => {
  const isIos =
    /iPhone|iPad|iPod/.test(environment.userAgent) ||
    // iPadOS reports itself as a Mac; touch support gives it away.
    (environment.platform === "MacIntel" && environment.maxTouchPoints > 1);
  const isStandalone = environment.standalone === true || environment.displayModeStandalone;
  return isIos && !isStandalone;
};

const readStandalone = (): boolean | undefined => {
  const value: unknown = Reflect.get(navigator, "standalone");
  return typeof value === "boolean" ? value : undefined;
};

export const readDisplayEnvironment = (): DisplayEnvironment => ({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
  standalone: readStandalone(),
  displayModeStandalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
});
