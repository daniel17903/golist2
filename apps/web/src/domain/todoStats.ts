import type { Item } from "@golist/shared/domain/types";
import { computeNextDueDate, parseRecurrence } from "./recurrence";

export type PersonListStats = {
  personKey: string;
  personLabel: string;
  completedLastWeek: number;
  completedThisWeek: number;
  completedOverall: number;
  plannedLastWeek: number;
  plannedThisWeek: number;
  plannedNextWeek: number;
};

export const UNASSIGNED_KEY = "__unassigned__";

const normalizePerson = (assignedTo?: string): { key: string; label: string } => {
  const trimmed = assignedTo?.trim();
  if (!trimmed) {
    return { key: UNASSIGNED_KEY, label: "Unassigned" };
  }
  return { key: trimmed.toLocaleLowerCase(), label: trimmed };
};

const startOfWeekMonday = (value: Date): Date => {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return start;
};

const addDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const inRange = (value: number, startInclusive: number, endExclusive: number): boolean =>
  value >= startInclusive && value < endExclusive;

const MAX_RECURRENCE_ITERATIONS = 100;

const countPredictedOccurrencesInRange = (
  recurrenceJson: string,
  currentDueDateMs: number,
  rangeStartMs: number,
  rangeEndMs: number,
): number => {
  const rule = parseRecurrence(recurrenceJson);
  if (!rule) {
    return 0;
  }

  // For from_completion anchored tasks, assume completion happens at dueDate
  const completionDateMs = currentDueDateMs;

  let count = 0;
  let nextDueDateMs = computeNextDueDate(recurrenceJson, currentDueDateMs, completionDateMs);
  let iterations = 0;

  while (nextDueDateMs !== null && iterations < MAX_RECURRENCE_ITERATIONS) {
    if (nextDueDateMs >= rangeEndMs) {
      // Future occurrences are beyond our range, stop
      break;
    }
    if (inRange(nextDueDateMs, rangeStartMs, rangeEndMs)) {
      count++;
    }
    // Compute next occurrence from this one
    nextDueDateMs = computeNextDueDate(recurrenceJson, nextDueDateMs, nextDueDateMs);
    iterations++;
  }

  return count;
};

/** Per-person points stats of a todo list (ported from DoList). */
export const calculateTodoStats = (items: readonly Item[], listId: string, now = Date.now()): PersonListStats[] => {
  const startThisWeek = startOfWeekMonday(new Date(now)).getTime();
  const startNextWeek = addDays(new Date(startThisWeek), 7).getTime();
  const startLastWeek = addDays(new Date(startThisWeek), -7).getTime();
  const startFollowingWeek = addDays(new Date(startThisWeek), 14).getTime();

  const byPerson = new Map<string, PersonListStats>();

  for (const item of items) {
    if (item.listId !== listId) {
      continue;
    }
    if (item.deleted === true) {
      continue;
    }

    const person = normalizePerson(item.assignedTo);
    const existing = byPerson.get(person.key) ?? {
      personKey: person.key,
      personLabel: person.label,
      completedLastWeek: 0,
      completedThisWeek: 0,
      completedOverall: 0,
      plannedLastWeek: 0,
      plannedThisWeek: 0,
      plannedNextWeek: 0,
    };

    const points = item.points !== undefined && item.points > 0 ? item.points : 1;

    if (item.completedAt !== undefined) {
      existing.completedOverall += points;
      if (inRange(item.completedAt, startThisWeek, startNextWeek)) {
        existing.completedThisWeek += points;
      }
      if (inRange(item.completedAt, startLastWeek, startThisWeek)) {
        existing.completedLastWeek += points;
      }
    }
    if (item.dueDate !== undefined) {
      if (inRange(item.dueDate, startLastWeek, startThisWeek)) {
        existing.plannedLastWeek += points;
      }
      if (inRange(item.dueDate, startThisWeek, startNextWeek)) {
        existing.plannedThisWeek += points;
      }
      if (inRange(item.dueDate, startNextWeek, startFollowingWeek)) {
        existing.plannedNextWeek += points;
      }
      // Also count predicted occurrences from recurring tasks due before next week
      // But only for non-completed tasks (completed tasks don't generate predictions)
      if (item.recurrence && item.completedAt === undefined && item.dueDate < startNextWeek) {
        const predictedCount = countPredictedOccurrencesInRange(
          item.recurrence,
          item.dueDate,
          startNextWeek,
          startFollowingWeek,
        );
        existing.plannedNextWeek += points * predictedCount;
      }
    }

    byPerson.set(person.key, existing);
  }

  return Array.from(byPerson.values()).sort((left, right) => {
    if (left.personKey === UNASSIGNED_KEY) {
      return 1;
    }
    if (right.personKey === UNASSIGNED_KEY) {
      return -1;
    }
    return left.personLabel.localeCompare(right.personLabel);
  });
};
