import { describe, expect, it } from "vitest";
import { berlinMidnight } from "@golist/shared/domain/berlin-time";
import { dateInputToMillis, formatDueDate, isOverdue, millisToDateInput } from "./dueDate";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(",")})` : key;

// Thursday, 2026-03-26 at noon (local time).
const now = new Date(2026, 2, 26, 12).getTime();
const day = (offset: number) => new Date(2026, 2, 26 + offset, 9).getTime();

describe("formatDueDate", () => {
  it("uses relative labels around today", () => {
    expect(formatDueDate(day(0), "en", t, now)).toBe("todo.due.today");
    expect(formatDueDate(day(1), "en", t, now)).toBe("todo.due.tomorrow");
    expect(formatDueDate(day(-1), "en", t, now)).toBe("todo.due.yesterday");
  });

  it("uses weekday names within a week and a short date beyond", () => {
    expect(formatDueDate(day(2), "en", t, now)).toBe("Saturday");
    expect(formatDueDate(day(-3), "en", t, now)).toBe("todo.due.lastWeekday(Monday)");
    expect(formatDueDate(day(10), "en", t, now)).toBe("Apr 5");
  });
});

describe("isOverdue", () => {
  it("is overdue only once the due day has passed", () => {
    expect(isOverdue(day(0), now)).toBe(false);
    expect(isOverdue(day(-1), now)).toBe(true);
  });
});

describe("date input conversion", () => {
  it("round-trips dates as Berlin calendar days", () => {
    const millis = dateInputToMillis("2026-03-07");
    expect(millis).toBe(berlinMidnight({ year: 2026, month: 3, day: 7 }));
    expect(millisToDateInput(millis)).toBe("2026-03-07");
    expect(dateInputToMillis("")).toBeUndefined();
    expect(millisToDateInput(undefined)).toBe("");
  });
});
