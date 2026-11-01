import { describe, expect, it } from "vitest";
import type { Item } from "@golist/shared/domain/types";
import { calculateTodoStats } from "./todoStats";

const dayMs = 24 * 60 * 60 * 1000;

const baseNow = new Date("2026-03-26T12:00:00.000Z").getTime(); // Thursday
const thisWeekMonday = new Date("2026-03-23T00:00:00.000Z").getTime();

const item = (overrides: Partial<Item>): Item => ({
  id: crypto.randomUUID(),
  listId: "list-1",
  name: "x",
  iconName: "default",
  category: "other",
  deleted: false,
  points: 1,
  createdAt: baseNow,
  updatedAt: baseNow,
  ...overrides,
});

describe("calculateTodoStats", () => {
  it("groups assignedTo case-insensitively and buckets completed points by week", () => {
    const stats = calculateTodoStats(
      [
        item({ assignedTo: "Alex", points: 3, completedAt: thisWeekMonday + dayMs }),
        item({ assignedTo: "alex", points: 2, completedAt: thisWeekMonday - dayMs }),
        item({ assignedTo: "ALEX", points: 5, completedAt: thisWeekMonday + (20 * dayMs) }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      personLabel: "Alex",
      completedThisWeek: 3,
      completedLastWeek: 2,
      completedOverall: 10,
    });
  });

  it("uses Unassigned bucket and planned points for this/next week", () => {
    const stats = calculateTodoStats(
      [
        item({ dueDate: thisWeekMonday + (2 * dayMs), points: 4 }),
        item({ dueDate: thisWeekMonday + (8 * dayMs), points: 2 }),
        item({ dueDate: thisWeekMonday + (8 * dayMs), points: -2 }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      personLabel: "Unassigned",
      plannedThisWeek: 4,
      plannedNextWeek: 3,
    });
  });

  it("counts planned points for last week", () => {
    const stats = calculateTodoStats(
      [
        item({ dueDate: thisWeekMonday - (2 * dayMs), points: 3 }),
        item({ dueDate: thisWeekMonday - (6 * dayMs), points: 2 }),
        item({ dueDate: thisWeekMonday + (2 * dayMs), points: 5 }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      personLabel: "Unassigned",
      plannedLastWeek: 5,
      plannedThisWeek: 5,
      plannedNextWeek: 0,
    });
  });

  it("ignores soft-deleted items", () => {
    const stats = calculateTodoStats(
      [
        item({ assignedTo: "Alex", points: 3, completedAt: thisWeekMonday + dayMs, deleted: true }),
        item({ assignedTo: "Alex", points: 2, completedAt: thisWeekMonday + dayMs }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      personLabel: "Alex",
      completedThisWeek: 2,
      completedOverall: 2,
    });
  });

  it("counts single predicted occurrence from weekly recurring task due before next week", () => {
    // Task due last Monday (March 16), recurs weekly -> should have 1 occurrence in next week (March 30)
    const lastWeekDueDate = thisWeekMonday - (7 * dayMs); // March 16
    const recurrence = JSON.stringify({ every: 1, unit: "week", anchor: "from_due_date" });

    const stats = calculateTodoStats(
      [
        item({ dueDate: lastWeekDueDate, points: 5, recurrence }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    // The task itself is not in this week or next week (it's last week),
    // but 1 predicted occurrence should be in next week (March 30)
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 0,
      plannedNextWeek: 5,
    });
  });

  it("counts multiple predicted occurrences from daily recurring task", () => {
    // Task due this week Monday (March 23), recurs daily
    // Next week is March 30 - April 5, so daily occurrences would be:
    // March 30, 31, April 1, 2, 3, 4, 5 = 7 occurrences
    const recurrence = JSON.stringify({ every: 1, unit: "day", anchor: "from_due_date" });

    const stats = calculateTodoStats(
      [
        item({ dueDate: thisWeekMonday, points: 2, recurrence }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    // The task itself is in this week (2 points), plus 7 daily occurrences in next week (14 points)
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 2,
      plannedNextWeek: 14,
    });
  });

  it("handles from_completion anchor by assuming completion at dueDate", () => {
    // Task due this week (Monday), recurs daily from completion -> should have 7 occurrences in next week
    const recurrence = JSON.stringify({ every: 1, unit: "day", anchor: "from_completion" });

    const stats = calculateTodoStats(
      [
        item({ dueDate: thisWeekMonday, points: 3, recurrence }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    // Same result as from_due_date since we assume completion at dueDate
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 3,
      plannedNextWeek: 21,
    });
  });

  it("handles weekly recurrence with single occurrence in next week", () => {
    // Task due last Monday, recurs weekly -> should have 1 occurrence in next week
    const lastWeekDueDate = thisWeekMonday - (7 * dayMs);
    const recurrence = JSON.stringify({ every: 1, unit: "week", anchor: "from_due_date" });

    const stats = calculateTodoStats(
      [
        item({ dueDate: lastWeekDueDate, points: 10, recurrence }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 0,
      plannedNextWeek: 10,
    });
  });

  it("handles monthly recurrence with occurrence in next week", () => {
    // Task due March 1 (before this week), recurs monthly
    // Next occurrence: April 1, which is in next week (March 30 - April 5)
    const marchFirst = new Date("2026-03-01T00:00:00.000Z").getTime();
    const recurrence = JSON.stringify({ every: 1, unit: "month", anchor: "from_due_date" });

    const stats = calculateTodoStats(
      [
        item({ dueDate: marchFirst, points: 8, recurrence }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    // April 1 is in next week (March 30 - April 5)
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 0,
      plannedNextWeek: 8,
    });
  });

  it("ignores invalid recurrence JSON", () => {
    const stats = calculateTodoStats(
      [
        item({ dueDate: thisWeekMonday, points: 5, recurrence: "invalid json" }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    // Only counts the task itself in this week, no predicted occurrences
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 5,
      plannedNextWeek: 0,
    });
  });

  it("ignores null recurrence", () => {
    const stats = calculateTodoStats(
      [
        item({ dueDate: thisWeekMonday, points: 5, recurrence: undefined }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 5,
      plannedNextWeek: 0,
    });
  });

  it("does not count recurring predictions for tasks already due in next week", () => {
    // Task due in next week should not have additional predicted occurrences counted
    const nextWeekDueDate = thisWeekMonday + (8 * dayMs); // Tuesday of next week
    const recurrence = JSON.stringify({ every: 1, unit: "day", anchor: "from_due_date" });

    const stats = calculateTodoStats(
      [
        item({ dueDate: nextWeekDueDate, points: 4, recurrence }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    // Only the task itself counts, no predicted occurrences since dueDate >= startNextWeek
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 0,
      plannedNextWeek: 4,
    });
  });

  it("does not count recurring predictions for completed tasks", () => {
    // Completed recurring task should not contribute to planned stats
    const recurrence = JSON.stringify({ every: 1, unit: "day", anchor: "from_due_date" });

    const stats = calculateTodoStats(
      [
        item({ dueDate: thisWeekMonday, points: 5, recurrence, completedAt: thisWeekMonday + dayMs }),
      ],
      "list-1",
      baseNow,
    );

    expect(stats).toHaveLength(1);
    // Task was due this week Monday, so it should count as planned this week
    // But recurring predictions should not be counted for completed tasks
    expect(stats[0]).toMatchObject({
      plannedThisWeek: 5,
      plannedNextWeek: 0,
      completedThisWeek: 5,
    });
  });
});
