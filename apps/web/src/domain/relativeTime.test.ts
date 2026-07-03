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

  it("formats small negative elapsed time (clock jitter) as now", () => {
    expect(formatRelativeElapsedTime(-20_000, formatter)).toBe(formatter.format(0, "minute"));
  });

  it("formats negative elapsed time at the jitter threshold as now", () => {
    expect(formatRelativeElapsedTime(-5 * 60_000, formatter)).toBe(formatter.format(0, "minute"));
  });

  it("does not render large negative elapsed time (clock skew) as now", () => {
    const result = formatRelativeElapsedTime(-10 * 60_000, formatter);
    expect(result).not.toBe(formatter.format(0, "minute"));
    expect(result).toBe(formatter.format(-10, "minute"));
  });

  it("formats large negative elapsed hours by their absolute magnitude", () => {
    expect(formatRelativeElapsedTime(-3 * 3_600_000, formatter)).toBe(formatter.format(-3, "hour"));
  });

  it("formats large negative elapsed days by their absolute magnitude", () => {
    expect(formatRelativeElapsedTime(-49 * 3_600_000, formatter)).toBe(formatter.format(-2, "day"));
  });
});
