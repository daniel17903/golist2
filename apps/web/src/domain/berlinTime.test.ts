import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  addCalendarMonths,
  berlinDateOf,
  berlinMidnight,
  calendarDaysBetween,
  parseCalendarDate,
  weekdayOf,
} from "@golist/shared/domain/berlin-time";
import { computeNextDueDate } from "./recurrence";
import { calculateTodoStats } from "./todoStats";
import { dateInputToMillis, formatDueDate, isOverdue, millisToDateInput } from "./dueDate";

// These tests must pass in any device time zone; run them e.g. with
// TZ=America/New_York or TZ=Asia/Tokyo as well.
const iso = (ms: number) => new Date(ms).toISOString();
const daily = JSON.stringify({ every: 1, unit: "day", anchor: "from_due_date" });
const weekly = JSON.stringify({ every: 1, unit: "week", anchor: "from_due_date" });
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(",")})` : key;

describe("Berlin calendar math", () => {
  it("puts midnight at UTC+1 in winter and UTC+2 in summer", () => {
    expect(iso(berlinMidnight({ year: 2026, month: 1, day: 15 }))).toBe("2026-01-14T23:00:00.000Z");
    expect(iso(berlinMidnight({ year: 2026, month: 7, day: 15 }))).toBe("2026-07-14T22:00:00.000Z");
  });

  it("handles both DST switches (last Sunday of March and of October)", () => {
    expect(iso(berlinMidnight({ year: 2026, month: 3, day: 29 }))).toBe("2026-03-28T23:00:00.000Z");
    expect(iso(berlinMidnight({ year: 2026, month: 3, day: 30 }))).toBe("2026-03-29T22:00:00.000Z");
    expect(iso(berlinMidnight({ year: 2026, month: 10, day: 25 }))).toBe("2026-10-24T22:00:00.000Z");
    expect(iso(berlinMidnight({ year: 2026, month: 10, day: 26 }))).toBe("2026-10-25T23:00:00.000Z");
  });

  it("reads the Berlin day of an instant, not the UTC or device day", () => {
    expect(berlinDateOf(Date.parse("2026-03-28T23:30:00Z"))).toEqual({ year: 2026, month: 3, day: 29 });
    expect(berlinDateOf(Date.parse("2026-07-14T21:59:59Z"))).toEqual({ year: 2026, month: 7, day: 14 });
  });

  it("does calendar arithmetic without time-of-day drift", () => {
    expect(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addCalendarMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 28 });
    expect(weekdayOf({ year: 2026, month: 3, day: 29 })).toBe(0);
    expect(calendarDaysBetween({ year: 2026, month: 3, day: 28 }, { year: 2026, month: 3, day: 30 })).toBe(2);
    expect(parseCalendarDate("2026-02-30")).toBeNull();
  });
});

describe("todos use Berlin calendar days", () => {
  it("steps a daily and a weekly recurrence across the spring DST switch to Berlin midnights", () => {
    const due = berlinMidnight({ year: 2026, month: 3, day: 28 });
    expect(iso(computeNextDueDate(daily, due, due)!)).toBe("2026-03-28T23:00:00.000Z"); // Mar 29
    const sunday = computeNextDueDate(daily, due, due)!;
    expect(iso(computeNextDueDate(daily, sunday, sunday)!)).toBe("2026-03-29T22:00:00.000Z"); // Mar 30
    expect(iso(computeNextDueDate(weekly, due, due)!)).toBe("2026-04-03T22:00:00.000Z"); // Apr 4
  });

  it("takes the from_completion base day in Berlin", () => {
    const completedLateEvening = Date.parse("2026-01-14T23:30:00Z"); // Jan 15, 00:30 in Berlin
    const rule = JSON.stringify({ every: 1, unit: "day", anchor: "from_completion" });
    expect(iso(computeNextDueDate(rule, 0, completedLateEvening)!)).toBe("2026-01-15T23:00:00.000Z"); // Jan 16
  });

  it("labels and flags due dates by the Berlin day", () => {
    // 00:30 on Friday Mar 27 in Berlin, still Thursday in UTC.
    const now = Date.parse("2026-03-26T23:30:00Z");
    expect(formatDueDate(berlinMidnight({ year: 2026, month: 3, day: 27 }), "en", t, now)).toBe("todo.due.today");
    expect(isOverdue(berlinMidnight({ year: 2026, month: 3, day: 26 }), now)).toBe(true);
    expect(isOverdue(berlinMidnight({ year: 2026, month: 3, day: 27 }), now)).toBe(false);
  });

  it("round-trips the date input as a Berlin day", () => {
    const millis = dateInputToMillis("2026-10-25")!;
    expect(iso(millis)).toBe("2026-10-24T22:00:00.000Z");
    expect(millisToDateInput(millis)).toBe("2026-10-25");
  });

  it("starts stats weeks on Monday midnight in Berlin", () => {
    const now = Date.parse("2026-03-26T12:00:00Z"); // Thursday
    const item = (completedAt: number) => ({
      id: crypto.randomUUID(),
      listId: "l",
      name: "x",
      iconName: "default",
      category: "other",
      deleted: false,
      points: 1,
      completedAt,
      createdAt: 0,
      updatedAt: 0,
    });
    // 23:30 UTC on Sunday Mar 22 is already Monday Mar 23 in Berlin: this week.
    const [stats] = calculateTodoStats([item(Date.parse("2026-03-22T23:30:00Z"))], "l", now);
    expect(stats).toMatchObject({ completedThisWeek: 1, completedLastWeek: 0 });
  });
});
