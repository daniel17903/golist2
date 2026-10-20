import { describe, expect, it } from "vitest";
import { isIosBrowserTab, type DisplayEnvironment } from "./iosBrowserTab";

const iphoneSafari: DisplayEnvironment = {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
  maxTouchPoints: 5,
  standalone: false,
  displayModeStandalone: false,
};

describe("isIosBrowserTab", () => {
  it("detects Safari on an iPhone", () => {
    expect(isIosBrowserTab(iphoneSafari)).toBe(true);
  });

  it("detects other iOS browsers and in-app browsers", () => {
    expect(
      isIosBrowserTab({
        ...iphoneSafari,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
        standalone: undefined,
      }),
    ).toBe(true);
    expect(
      isIosBrowserTab({
        ...iphoneSafari,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0",
        standalone: undefined,
      }),
    ).toBe(true);
  });

  it("detects iPadOS, which reports a Mac user agent", () => {
    expect(
      isIosBrowserTab({
        ...iphoneSafari,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("is false inside the installed home-screen web app", () => {
    expect(isIosBrowserTab({ ...iphoneSafari, standalone: true })).toBe(false);
    expect(isIosBrowserTab({ ...iphoneSafari, standalone: undefined, displayModeStandalone: true })).toBe(false);
  });

  it("is false on a desktop Mac and on Android", () => {
    expect(
      isIosBrowserTab({
        ...iphoneSafari,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "MacIntel",
        maxTouchPoints: 0,
        standalone: undefined,
      }),
    ).toBe(false);
    expect(
      isIosBrowserTab({
        ...iphoneSafari,
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
        platform: "Linux armv8l",
        standalone: undefined,
      }),
    ).toBe(false);
  });
});
