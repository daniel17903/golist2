import { describe, expect, it } from "vitest";
import { computeNextDueDate, nextOccurrenceId, parseRecurrence } from "./recurrence";

// Helper: build epoch millis for a local midnight date (same convention as the app)
const localMidnight = (year: number, month: number, day: number): number =>
  new Date(year, month - 1, day).getTime();

describe("parseRecurrence", () => {
  it("returns a valid rule for a minimal daily recurrence", () => {
    const result = parseRecurrence('{"every":1,"unit":"day","anchor":"from_due_date"}');
    expect(result).toEqual({ every: 1, unit: "day", anchor: "from_due_date" });
  });

  it("returns a valid rule with weekday set", () => {
    const result = parseRecurrence('{"every":2,"unit":"week","weekday":"mon","anchor":"from_completion"}');
    expect(result).toEqual({ every: 2, unit: "week", weekday: "mon", anchor: "from_completion" });
  });

  it("returns null for invalid JSON", () => {
    expect(parseRecurrence("not-json")).toBeNull();
  });

  it("returns null when every is out of range", () => {
    expect(parseRecurrence('{"every":0,"unit":"day","anchor":"from_due_date"}')).toBeNull();
    expect(parseRecurrence('{"every":100,"unit":"day","anchor":"from_due_date"}')).toBeNull();
  });

  it("returns null when unit is invalid", () => {
    expect(parseRecurrence('{"every":1,"unit":"hour","anchor":"from_due_date"}')).toBeNull();
  });

  it("returns null when anchor is invalid", () => {
    expect(parseRecurrence('{"every":1,"unit":"day","anchor":"from_creation"}')).toBeNull();
  });

  it("returns null for an array", () => {
    expect(parseRecurrence("[]")).toBeNull();
  });

  it("returns null when weekday is invalid", () => {
    expect(parseRecurrence('{"every":1,"unit":"week","weekday":"xyz","anchor":"from_due_date"}')).toBeNull();
  });
});

describe("computeNextDueDate", () => {
  it("returns null for unparseable recurrence JSON", () => {
    const result = computeNextDueDate("bad json", localMidnight(2025, 1, 15), Date.now());
    expect(result).toBeNull();
  });

  describe("unit: day", () => {
    it("adds every days from due date when anchor is from_due_date", () => {
      const due = localMidnight(2025, 3, 10);
      const completion = localMidnight(2025, 3, 12);
      const rule = '{"every":7,"unit":"day","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, completion)).toBe(localMidnight(2025, 3, 17));
    });

    it("adds every days from completion date when anchor is from_completion", () => {
      const due = localMidnight(2025, 3, 10);
      const completion = localMidnight(2025, 3, 12);
      const rule = '{"every":3,"unit":"day","anchor":"from_completion"}';
      expect(computeNextDueDate(rule, due, completion)).toBe(localMidnight(2025, 3, 15));
    });

    it("handles adding 1 day across a month boundary", () => {
      const due = localMidnight(2025, 1, 31);
      const rule = '{"every":1,"unit":"day","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, due)).toBe(localMidnight(2025, 2, 1));
    });
  });

  describe("unit: week (no weekday)", () => {
    it("adds every * 7 days from due date", () => {
      const due = localMidnight(2025, 3, 10); // Monday
      const rule = '{"every":2,"unit":"week","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, due)).toBe(localMidnight(2025, 3, 24));
    });

    it("uses completion date as base when anchor is from_completion", () => {
      const due = localMidnight(2025, 3, 1);
      const completion = localMidnight(2025, 3, 10); // Monday
      const rule = '{"every":1,"unit":"week","anchor":"from_completion"}';
      expect(computeNextDueDate(rule, due, completion)).toBe(localMidnight(2025, 3, 17));
    });
  });

  describe("unit: week (with weekday)", () => {
    it("advances every weeks then adjusts to target weekday (already on target)", () => {
      // 2025-03-10 is a Monday. Advance 1 week → 2025-03-17 (Monday). Target: mon → same day.
      const due = localMidnight(2025, 3, 10);
      const rule = '{"every":1,"unit":"week","weekday":"mon","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, due)).toBe(localMidnight(2025, 3, 17));
    });

    it("advances every weeks then adjusts forward to target weekday", () => {
      // 2025-03-10 is a Monday. Advance 1 week → 2025-03-17 (Monday). Target: wed → 2025-03-19
      const due = localMidnight(2025, 3, 10);
      const rule = '{"every":1,"unit":"week","weekday":"wed","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, due)).toBe(localMidnight(2025, 3, 19));
    });

    it("wraps forward to next weekday without going back", () => {
      // 2025-03-10 is a Monday. Advance 1 week → 2025-03-17 (Monday). Target: sun → 2025-03-23
      const due = localMidnight(2025, 3, 10);
      const rule = '{"every":1,"unit":"week","weekday":"sun","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, due)).toBe(localMidnight(2025, 3, 23));
    });
  });

  describe("unit: month", () => {
    it("adds every months from due date", () => {
      const due = localMidnight(2025, 1, 15);
      const rule = '{"every":1,"unit":"month","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, due)).toBe(localMidnight(2025, 2, 15));
    });

    it("clamps month overflow (Jan 31 + 1 month → Feb 28)", () => {
      const due = localMidnight(2025, 1, 31);
      const rule = '{"every":1,"unit":"month","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, due)).toBe(localMidnight(2025, 2, 28));
    });

    it("clamps month overflow to Feb 29 in a leap year (Jan 31, 2028 + 1 month → Feb 29, 2028)", () => {
      const due = localMidnight(2028, 1, 31);
      const rule = '{"every":1,"unit":"month","anchor":"from_due_date"}';
      expect(computeNextDueDate(rule, due, due)).toBe(localMidnight(2028, 2, 29));
    });

    it("uses completion date when anchor is from_completion", () => {
      const due = localMidnight(2025, 1, 1);
      const completion = localMidnight(2025, 1, 20);
      const rule = '{"every":2,"unit":"month","anchor":"from_completion"}';
      expect(computeNextDueDate(rule, due, completion)).toBe(localMidnight(2025, 3, 20));
    });
  });
});

describe("nextOccurrenceId", () => {
  const source = "3f2b8c1e-5a6d-4e7f-8a9b-0c1d2e3f4a5b";

  it("is a deterministic, valid UUID that differs per source and along the chain", () => {
    const next = nextOccurrenceId(source);
    expect(next).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(nextOccurrenceId(source)).toBe(next);
    expect(nextOccurrenceId(next)).not.toBe(next);
    expect(nextOccurrenceId("4f2b8c1e-5a6d-4e7f-8a9b-0c1d2e3f4a5b")).not.toBe(next);
  });
});
