import { describe, expect, it } from "vitest";
import type { Item } from "@golist/shared/domain/types";
import { dateInputToMillis, isOpenTodo, millisToDateInput, recentAssignees, sortTodoItems } from "./todoSort";

const todo = (id: string, overrides: Partial<Item> = {}): Item => ({
  id,
  listId: "list-1",
  name: id,
  iconName: "default",
  category: "other",
  deleted: false,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe("sortTodoItems", () => {
  it("puts todos with a due date first, earliest first, then the rest in creation order", () => {
    const sorted = sortTodoItems([
      todo("no-due-late", { createdAt: 20 }),
      todo("due-later", { dueDate: 2_000, createdAt: 1 }),
      todo("no-due-early", { createdAt: 10 }),
      todo("due-sooner", { dueDate: 1_000, createdAt: 2 }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["due-sooner", "due-later", "no-due-early", "no-due-late"]);
  });

  it("orders todos with the same due date by creation", () => {
    const sorted = sortTodoItems([todo("b", { dueDate: 5, createdAt: 2 }), todo("a", { dueDate: 5, createdAt: 1 })]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("isOpenTodo", () => {
  it("hides deleted and completed todos", () => {
    expect(isOpenTodo(todo("open"))).toBe(true);
    expect(isOpenTodo(todo("done", { completedAt: 1 }))).toBe(false);
    expect(isOpenTodo(todo("gone", { deleted: true }))).toBe(false);
  });
});

describe("recentAssignees", () => {
  it("returns up to three distinct assignees of the list, most recently updated first", () => {
    const assignees = recentAssignees(
      [
        todo("a", { assignedTo: "Alex", updatedAt: 1 }),
        todo("b", { assignedTo: "sam", updatedAt: 5 }),
        todo("c", { assignedTo: "ALEX", updatedAt: 4 }),
        todo("d", { assignedTo: "Kim", updatedAt: 3 }),
        todo("e", { assignedTo: "Lee", updatedAt: 2 }),
        todo("f", { assignedTo: "Other list", updatedAt: 9, listId: "list-2" }),
      ],
      "list-1",
    );
    expect(assignees).toEqual(["sam", "ALEX", "Kim"]);
  });
});

describe("date input conversion", () => {
  it("round-trips local dates", () => {
    const millis = dateInputToMillis("2026-03-07");
    expect(millis).toBe(new Date(2026, 2, 7).getTime());
    expect(millisToDateInput(millis)).toBe("2026-03-07");
    expect(dateInputToMillis("")).toBeUndefined();
    expect(millisToDateInput(undefined)).toBe("");
  });
});
