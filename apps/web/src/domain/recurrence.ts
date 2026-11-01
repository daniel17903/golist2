import {
  addCalendarDays,
  addCalendarMonths,
  berlinDateOf,
  berlinMidnight,
  weekdayOf,
  type CalendarDate,
} from "@golist/shared/domain/berlin-time";

type RecurrenceUnit = "day" | "week" | "month";
type RecurrenceWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type RecurrenceAnchor = "from_due_date" | "from_completion";

export type RecurrenceRule = {
  every: number;
  unit: RecurrenceUnit;
  weekday?: RecurrenceWeekday;
  anchor: RecurrenceAnchor;
};

const WEEKDAY_INDEX: Record<RecurrenceWeekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const VALID_UNITS: readonly string[] = ["day", "week", "month"];
const VALID_ANCHORS: readonly string[] = ["from_due_date", "from_completion"];
const VALID_WEEKDAYS: readonly string[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const isRecurrenceUnit = (value: unknown): value is RecurrenceUnit =>
  typeof value === "string" && VALID_UNITS.includes(value);

const isRecurrenceAnchor = (value: unknown): value is RecurrenceAnchor =>
  typeof value === "string" && VALID_ANCHORS.includes(value);

const isRecurrenceWeekday = (value: unknown): value is RecurrenceWeekday =>
  typeof value === "string" && VALID_WEEKDAYS.includes(value);

export function parseRecurrence(json: string): RecurrenceRule | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const every = Reflect.get(parsed, "every");
    const unit = Reflect.get(parsed, "unit");
    const anchor = Reflect.get(parsed, "anchor");
    const weekday = Reflect.get(parsed, "weekday");

    if (
      typeof every !== "number" ||
      !Number.isInteger(every) ||
      every < 1 ||
      every > 99
    ) {
      return null;
    }

    if (!isRecurrenceUnit(unit)) {
      return null;
    }

    if (!isRecurrenceAnchor(anchor)) {
      return null;
    }

    if (weekday !== undefined && !isRecurrenceWeekday(weekday)) {
      return null;
    }

    return {
      every,
      unit,
      anchor,
      weekday: isRecurrenceWeekday(weekday) ? weekday : undefined,
    };
  } catch {
    return null;
  }
}

export function computeNextDueDate(
  recurrenceJson: string,
  currentDueDateMs: number,
  completionDateMs: number,
): number | null {
  const rule = parseRecurrence(recurrenceJson);
  if (!rule) {
    return null;
  }

  // Calendar math on the Berlin day of the anchor (see berlin-time.ts):
  // every device computes the same next due date, whatever its time zone.
  const baseMs = rule.anchor === "from_due_date" ? currentDueDateMs : completionDateMs;
  const base = berlinDateOf(baseMs);

  let next: CalendarDate;

  if (rule.unit === "day") {
    next = addCalendarDays(base, rule.every);
  } else if (rule.unit === "week") {
    // Advance every * 7 days first, then forward to the requested weekday.
    const advanced = addCalendarDays(base, rule.every * 7);
    if (rule.weekday !== undefined) {
      const diff = (WEEKDAY_INDEX[rule.weekday] - weekdayOf(advanced) + 7) % 7;
      next = addCalendarDays(advanced, diff);
    } else {
      next = advanced;
    }
  } else {
    // month: add every months, clamping to the last day of the target month.
    next = addCalendarMonths(base, rule.every);
  }

  return berlinMidnight(next);
}

// 64-bit FNV-1a over UTF-16 code units, as 16 hex digits.
const fnv1a64 = (value: string): string => {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

/**
 * Id of the occurrence that follows the todo `sourceId` (a version-8 UUID
 * derived from it). Deterministic, so two devices completing the same
 * recurring todo offline create the same next occurrence instead of two, and
 * an undo on either device removes it everywhere.
 */
export const nextOccurrenceId = (sourceId: string): string => {
  const hex = `${fnv1a64(`${sourceId}:next`)}${fnv1a64(`${sourceId}:next:2`)}`.split("");
  hex[12] = "8";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
};
