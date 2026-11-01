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

  const baseMs = rule.anchor === "from_due_date" ? currentDueDateMs : completionDateMs;
  const base = new Date(baseMs);

  let next: Date;

  if (rule.unit === "day") {
    next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + rule.every);
  } else if (rule.unit === "week") {
    // Advance every * 7 days first
    const advanced = new Date(base.getFullYear(), base.getMonth(), base.getDate() + rule.every * 7);

    if (rule.weekday !== undefined) {
      const targetDay = WEEKDAY_INDEX[rule.weekday];
      const advancedDay = advanced.getDay();
      const diff = (targetDay - advancedDay + 7) % 7;
      next = new Date(advanced.getFullYear(), advanced.getMonth(), advanced.getDate() + diff);
    } else {
      next = advanced;
    }
  } else {
    // month: add every months, clamping to the last day of the target month if needed
    const targetMonth = base.getMonth() + rule.every;
    const targetYear = base.getFullYear();
    const targetDay = base.getDate();
    // new Date(year, month + 1, 0) gives the last day of the target month
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const clampedDay = Math.min(targetDay, lastDayOfTargetMonth);
    next = new Date(targetYear, targetMonth, clampedDay);
  }

  return next.getTime();
}
