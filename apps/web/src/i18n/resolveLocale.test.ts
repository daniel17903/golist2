import { describe, expect, it } from "vitest";
import { readUrlLocale, resolveLocale } from "./resolveLocale";

describe("resolveLocale", () => {
  it("prefers explicit user choice", () => {
    expect(
      resolveLocale({
        userPreference: "de",
        urlLocale: "es",
        storedLocale: "en",
        browserLocales: ["es-ES"],
        geoLocale: "es",
      }),
    ).toBe("de");
  });

  it("falls back through url, stored, browser and default", () => {
    expect(resolveLocale({ urlLocale: "es" })).toBe("es");
    expect(resolveLocale({ storedLocale: "de" })).toBe("de");
    expect(resolveLocale({ browserLocales: ["es-MX"] })).toBe("es");
    expect(resolveLocale({ browserLocales: ["fr-FR"] })).toBe("en");
  });

  it("reads lang from query first and path second", () => {
    const withQuery = new URL("https://example.com/de?lang=es");
    const withPath = new URL("https://example.com/de");

    expect(readUrlLocale(withQuery)).toBe("es");
    expect(readUrlLocale(withPath)).toBe("de");
  });
});
