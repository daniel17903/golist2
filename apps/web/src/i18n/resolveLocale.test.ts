import { describe, expect, it } from "vitest";
import { getLocaleFromUrl, resolveLocale } from "./resolveLocale";

describe("resolveLocale", () => {
  it("prioritizes explicit preference over all other sources", () => {
    expect(
      resolveLocale({
        userPreference: "es",
        urlLocale: "de",
        storedLocale: "en",
        browserLocales: ["de-DE"],
        geoLocale: "de",
      }),
    ).toBe("es");
  });

  it("falls back through sources and defaults to en", () => {
    expect(resolveLocale({ urlLocale: "fr", storedLocale: "de" })).toBe("de");
    expect(resolveLocale({ browserLocales: ["it-IT", "es-ES"] })).toBe("es");
    expect(resolveLocale({ geoLocale: "pt" })).toBe("en");
  });
});

describe("getLocaleFromUrl", () => {
  it("reads lang query and path segment", () => {
    expect(getLocaleFromUrl("https://x.test/app?lang=de")).toBe("de");
    expect(getLocaleFromUrl("https://x.test/es/list")).toBe("es");
  });
});
