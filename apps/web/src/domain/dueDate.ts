import {
  appTimeZone,
  berlinDateOf,
  berlinMidnight,
  berlinStartOfDay,
  calendarDaysBetween,
  formatCalendarDate,
  parseCalendarDate,
} from "@golist/shared/domain/berlin-time";

// Due dates are Berlin calendar days (see berlin-time.ts): "today",
// "overdue" and the labels are the same on every device.

/** Relative due-date label (ported from DoList): today/tomorrow/yesterday, weekday names within a week, else a short date. */
export const formatDueDate = (
  dueDate: number,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string,
  now = Date.now(),
): string => {
  const diffDays = calendarDaysBetween(berlinDateOf(now), berlinDateOf(dueDate));

  if (diffDays === 0) { return t("todo.due.today"); }
  if (diffDays === 1) { return t("todo.due.tomorrow"); }
  if (diffDays === -1) { return t("todo.due.yesterday"); }

  const weekday = new Date(dueDate).toLocaleDateString(locale, { weekday: "long", timeZone: appTimeZone });
  if (diffDays >= 2 && diffDays <= 6) { return weekday; }
  if (diffDays <= -2 && diffDays >= -6) { return t("todo.due.lastWeekday", { weekday }); }

  return new Date(dueDate).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: appTimeZone });
};

/** A todo is overdue once its due day (in Berlin) has passed. */
export const isOverdue = (dueDate: number, now = Date.now()): boolean => dueDate < berlinStartOfDay(now);

/** `yyyy-mm-dd` (an `<input type="date">` value) to Berlin midnight of that day in epoch millis. */
export const dateInputToMillis = (value: string): number | undefined => {
  const date = parseCalendarDate(value);
  return date ? berlinMidnight(date) : undefined;
};

/** Epoch millis to the `yyyy-mm-dd` value of an `<input type="date">` (the Berlin day). */
export const millisToDateInput = (value: number | undefined): string =>
  value === undefined ? "" : formatCalendarDate(berlinDateOf(value));
