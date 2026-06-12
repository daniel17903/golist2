const MINUTE_MS = 60_000;

export const formatRelativeElapsedTime = (
  elapsedMs: number,
  formatter: Intl.RelativeTimeFormat,
): string => {
  const elapsedMinutes = Math.round(elapsedMs / MINUTE_MS);

  if (elapsedMinutes < 1) {
    return formatter.format(0, "minute");
  }
  if (elapsedMinutes < 60) {
    return formatter.format(-elapsedMinutes, "minute");
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return formatter.format(-elapsedHours, "hour");
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  return formatter.format(-elapsedDays, "day");
};
