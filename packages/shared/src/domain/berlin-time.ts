/**
 * Calendar math in the Europe/Berlin time zone.
 *
 * Due dates and recurrences of todos are calendar days. Every device (and,
 * later, the backend) computes them in Europe/Berlin regardless of its own
 * time zone, so all peers agree on "today", "overdue" and the next
 * occurrence of a recurring todo. A due date is stored as the epoch millis of
 * Berlin midnight of that day.
 */

export const appTimeZone = "Europe/Berlin";

/** A calendar day; `month` is 1-12. */
export type CalendarDate = { year: number; month: number; day: number };

const dayMs = 24 * 60 * 60 * 1000;

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: appTimeZone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const partsOf = (ms: number) => {
  const values: Record<string, number> = {};
  for (const part of dateTimeFormat.formatToParts(new Date(ms))) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }
  return values;
};

/** Offset of Berlin local time from UTC at the instant `ms` (3600000 or 7200000). */
const berlinOffsetMs = (ms: number): number => {
  const parts = partsOf(ms);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
};

/** The Berlin calendar day the instant `ms` falls on. */
export const berlinDateOf = (ms: number): CalendarDate => {
  const parts = partsOf(ms);
  return { year: parts.year, month: parts.month, day: parts.day };
};

/** Epoch millis of midnight (start of day) in Berlin on `date`. */
export const berlinMidnight = (date: CalendarDate): number => {
  const utcMidnight = Date.UTC(date.year, date.month - 1, date.day);
  // Berlin switches DST at 02:00/03:00, never at midnight, so the offset at
  // the first estimate is already the offset at midnight; the second pass
  // only guards the estimate landing on the other side of a switch.
  let result = utcMidnight - berlinOffsetMs(utcMidnight);
  result = utcMidnight - berlinOffsetMs(result);
  return result;
};

/** Normalizes year/month/day overflow (e.g. day 32, month 13) like `Date.UTC`. */
const fromUtcDate = (date: Date): CalendarDate => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

/** `date` plus `days` calendar days (negative to go back). */
export const addCalendarDays = (date: CalendarDate, days: number): CalendarDate =>
  fromUtcDate(new Date(Date.UTC(date.year, date.month - 1, date.day + days)));

/** `date` plus `months` months, clamped to the last day of the target month (Jan 31 + 1 month = Feb 28/29). */
export const addCalendarMonths = (date: CalendarDate, months: number): CalendarDate => {
  const lastDay = new Date(Date.UTC(date.year, date.month - 1 + months + 1, 0)).getUTCDate();
  return fromUtcDate(new Date(Date.UTC(date.year, date.month - 1 + months, Math.min(date.day, lastDay))));
};

/** Day of the week of `date`: 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (date: CalendarDate): number => new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();

/** Whole calendar days from `from` to `to` (Berlin days, DST-safe). */
export const calendarDaysBetween = (from: CalendarDate, to: CalendarDate): number =>
  Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / dayMs,
  );

/** Epoch millis of Berlin midnight of the day the instant `ms` falls on. */
export const berlinStartOfDay = (ms: number): number => berlinMidnight(berlinDateOf(ms));

/** `yyyy-mm-dd` of a calendar day (the value format of `<input type="date">`). */
export const formatCalendarDate = (date: CalendarDate): string =>
  `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

/** Parses `yyyy-mm-dd`; `null` when it isn't a valid calendar day. */
export const parseCalendarDate = (value: string): CalendarDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const normalized = addCalendarDays(date, 0);
  return normalized.year === date.year && normalized.month === date.month && normalized.day === date.day
    ? date
    : null;
};
