import { memo, useCallback } from "react";
import { parseRecurrence } from "../domain/recurrence";
import type { RecurrenceRule } from "../domain/recurrence";
import { useI18n } from "../i18n";

type RecurrenceWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type RecurrenceUnit = "day" | "week" | "month";
type RecurrenceAnchor = "from_due_date" | "from_completion";

const WEEKDAYS: RecurrenceWeekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const VALID_UNITS: readonly string[] = ["day", "week", "month"];
const VALID_ANCHORS: readonly string[] = ["from_due_date", "from_completion"];
const VALID_WEEKDAY_VALUES: readonly string[] = ["", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const isUnit = (v: string): v is RecurrenceUnit => VALID_UNITS.includes(v);
const isAnchor = (v: string): v is RecurrenceAnchor => VALID_ANCHORS.includes(v);
const isWeekdayOrEmpty = (v: string): v is RecurrenceWeekday | "" => VALID_WEEKDAY_VALUES.includes(v);

type RecurrenceInputProps = {
  value: string;
  onChange: (value: string) => void;
};

const buildJson = (
  every: number,
  unit: RecurrenceUnit,
  weekday: RecurrenceWeekday | "",
  anchor: RecurrenceAnchor,
): string => {
  const rule: RecurrenceRule = {
    every,
    unit,
    anchor,
    ...(unit === "week" && weekday !== "" ? { weekday } : {}),
  };
  return JSON.stringify(rule);
};

const DEFAULT_EVERY = 1;
const DEFAULT_UNIT: RecurrenceUnit = "week";
const DEFAULT_WEEKDAY: RecurrenceWeekday | "" = "";
const DEFAULT_ANCHOR: RecurrenceAnchor = "from_due_date";

const RecurrenceInput = memo(function RecurrenceInput({
  value,
  onChange,
}: RecurrenceInputProps) {
  const { t } = useI18n();

  const parsed = parseRecurrence(value);
  const isActive = parsed !== null;

  const every = parsed?.every ?? DEFAULT_EVERY;
  const unit = parsed?.unit ?? DEFAULT_UNIT;
  const weekday = parsed?.weekday ?? DEFAULT_WEEKDAY;
  const anchor = parsed?.anchor ?? DEFAULT_ANCHOR;

  const handleToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        onChange(buildJson(every, unit, weekday, anchor));
      } else {
        onChange("");
      }
    },
    [onChange, every, unit, weekday, anchor],
  );

  const handleEveryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(event.target.value, 10);
      const clamped = isNaN(raw) ? 1 : Math.min(99, Math.max(1, raw));
      onChange(buildJson(clamped, unit, weekday, anchor));
    },
    [onChange, unit, weekday, anchor],
  );

  const handleUnitChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const raw = event.target.value;
      if (!isUnit(raw)) { return; }
      const effectiveWeekday = raw === "week" ? weekday : "";
      onChange(buildJson(every, raw, effectiveWeekday, anchor));
    },
    [onChange, every, weekday, anchor],
  );

  const handleWeekdayChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const raw = event.target.value;
      if (!isWeekdayOrEmpty(raw)) { return; }
      onChange(buildJson(every, unit, raw, anchor));
    },
    [onChange, every, unit, anchor],
  );

  const handleAnchorChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (!isAnchor(raw)) { return; }
      onChange(buildJson(every, unit, weekday, raw));
    },
    [onChange, every, unit, weekday],
  );

  return (
    <div className="recurrence-input__controls">
      <label className="recurrence-input__toggle-label">
        <input
          type="checkbox"
          className="recurrence-input__toggle-checkbox"
          checked={isActive}
          onChange={handleToggle}
        />
        <span className="recurrence-input__toggle-track" aria-hidden="true">
          <span className="recurrence-input__toggle-knob" />
        </span>
        {t("todo.recurrence")}
      </label>

      {isActive && (
        <>
          <div className="recurrence-input__row">
            <span>{t("todo.recurrenceEvery")}</span>
            <input
              type="number"
              className="recurrence-input__number"
              min={1}
              max={99}
              step={1}
              aria-label={t("todo.recurrenceInterval")}
              value={every}
              onChange={handleEveryChange}
            />
            <select value={unit} onChange={handleUnitChange} aria-label={t("todo.recurrenceUnitLabel")}>
              <option value="day">{t("todo.recurrenceUnit.day")}</option>
              <option value="week">{t("todo.recurrenceUnit.week")}</option>
              <option value="month">{t("todo.recurrenceUnit.month")}</option>
            </select>
            {unit === "week" && (
              <select value={weekday} onChange={handleWeekdayChange} aria-label={t("todo.recurrenceWeekday")}>
                <option value="">{t("todo.recurrenceWeekdayNone")}</option>
                {WEEKDAYS.map((wd) => (
                  <option key={wd} value={wd}>
                    {t(`todo.weekday.${wd}`)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="recurrence-input__anchor">
            <label>
              <input
                type="radio"
                name="recurrence-anchor"
                value="from_due_date"
                checked={anchor === "from_due_date"}
                onChange={handleAnchorChange}
              />
              {t("todo.recurrenceAnchor.from_due_date")}
            </label>
            <label>
              <input
                type="radio"
                name="recurrence-anchor"
                value="from_completion"
                checked={anchor === "from_completion"}
                onChange={handleAnchorChange}
              />
              {t("todo.recurrenceAnchor.from_completion")}
            </label>
          </div>
        </>
      )}
    </div>
  );
});

export default RecurrenceInput;
