import { describe, expect, it } from "vitest";
import { formatRelativeElapsedTime } from "./relativeTime";

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

describe("formatRelativeElapsedTime", () => {
  it("formats less than a minute as now", () => {
    expect(formatRelativeElapsedTime(20_000, formatter)).toBe(formatter.format(0, "minute"));
  });

  it("formats minutes", () => {
    expect(formatRelativeElapsedTime(5 * 60_000, formatter)).toBe(formatter.format(-5, "minute"));
  });

  it("formats hours", () => {
    expect(formatRelativeElapsedTime(3 * 3_600_000, formatter)).toBe(formatter.format(-3, "hour"));
  });

  it("formats days", () => {
    expect(formatRelativeElapsedTime(49 * 3_600_000, formatter)).toBe(formatter.format(-2, "day"));
  });
});
