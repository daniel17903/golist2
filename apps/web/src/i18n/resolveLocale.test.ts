import { describe, expect, it } from "vitest";
import { getLocaleFromUrl, resolveLocale } from "./resolveLocale";

describe("resolveLocale", () => {
  it("uses explicit preference first", () => {
    expect(resolveLocale({ userPreference: "es", urlLocale: "de", storedLocale: "en" })).toBe("es");
  });

  it("falls back through url, storage, browser, and default", () => {
    expect(resolveLocale({ urlLocale: "de", storedLocale: "es", browserLocales: ["en-US"] })).toBe("de");
    expect(resolveLocale({ storedLocale: "es", browserLocales: ["en-US"] })).toBe("es");
    expect(resolveLocale({ browserLocales: ["de-DE"] })).toBe("de");
    expect(resolveLocale({ browserLocales: ["fr-FR"] })).toBe("en");
  });
});

describe("getLocaleFromUrl", () => {
  it("reads locale from pathname first", () => {
    expect(getLocaleFromUrl({ pathname: "/es/list", search: "?lang=de" })).toBe("es");
  });

  it("reads locale from query when path is not locale", () => {
    expect(getLocaleFromUrl({ pathname: "/", search: "?lang=de" })).toBe("de");
  });
});
