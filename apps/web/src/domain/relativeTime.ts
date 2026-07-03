const MINUTE_MS = 60_000;

// Ordinary clock jitter between devices (e.g. a peer's clock a couple of
// minutes ahead) can make `elapsedMs` slightly negative even for a genuinely
// recent update; render those as "now". Beyond this threshold, a negative
// value means the recorded timestamp is meaningfully in the future relative
// to the local clock (e.g. a clock-skewed peer syncing a list rename). We
// don't actually know the true elapsed time in that case, but treating the
// skew as stale (its absolute magnitude) is safer than silently claiming
// "now" for an update that could be hours or days old by the local clock.
const CLOCK_JITTER_THRESHOLD_MS = 5 * MINUTE_MS;

export const formatRelativeElapsedTime = (
  elapsedMs: number,
  formatter: Intl.RelativeTimeFormat,
): string => {
  const normalizedElapsedMs =
    elapsedMs < 0 && Math.abs(elapsedMs) > CLOCK_JITTER_THRESHOLD_MS ? Math.abs(elapsedMs) : elapsedMs;

  const elapsedMinutes = Math.round(normalizedElapsedMs / MINUTE_MS);

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
