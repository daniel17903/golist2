import { describe, expect, it } from "vitest";
import type { Item } from "@golist/shared/domain/types";
import { isOpenTodo, sortTodoItems } from "./todoSort";

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
