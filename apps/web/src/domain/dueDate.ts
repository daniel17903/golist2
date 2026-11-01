const dayMs = 24 * 60 * 60 * 1000;

const startOfDay = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** Relative due-date label (ported from DoList): today/tomorrow/yesterday, weekday names within a week, else a short date. */
export const formatDueDate = (
  dueDate: number,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string,
  now = Date.now(),
): string => {
  const diffDays = Math.round((startOfDay(dueDate) - startOfDay(now)) / dayMs);

  if (diffDays === 0) { return t("todo.due.today"); }
  if (diffDays === 1) { return t("todo.due.tomorrow"); }
  if (diffDays === -1) { return t("todo.due.yesterday"); }

  const weekday = new Date(dueDate).toLocaleDateString(locale, { weekday: "long" });
  if (diffDays >= 2 && diffDays <= 6) { return weekday; }
  if (diffDays <= -2 && diffDays >= -6) { return t("todo.due.lastWeekday", { weekday }); }

  return new Date(dueDate).toLocaleDateString(locale, { month: "short", day: "numeric" });
};

/** A todo is overdue once its due day has passed. */
export const isOverdue = (dueDate: number, now = Date.now()): boolean => dueDate < startOfDay(now);
