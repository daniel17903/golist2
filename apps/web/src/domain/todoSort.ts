import type { Item } from "@golist/shared/domain/types";

/** Todo-list order (ported from DoList): todos with a due date first, earliest first; then creation order. */
export const sortTodoItems = (items: readonly Item[]): Item[] =>
  [...items].sort((a, b) => {
    const aHasDue = a.dueDate !== undefined;
    const bHasDue = b.dueDate !== undefined;
    if (aHasDue !== bHasDue) {
      return aHasDue ? -1 : 1;
    }
    if (aHasDue && bHasDue && a.dueDate !== b.dueDate) {
      return a.dueDate! - b.dueDate!;
    }
    return a.createdAt - b.createdAt;
  });

/** Todos shown in a todo list: neither deleted nor completed. */
export const isOpenTodo = (item: Item): boolean => !item.deleted && item.completedAt === undefined;

/** The most recently used assignees of a list (case-insensitively unique), newest first. */
export const recentAssignees = (items: readonly Item[], listId: string | undefined, limit = 3): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  const byRecentUpdate = items.filter((item) => item.listId === listId).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const item of byRecentUpdate) {
    const name = item.assignedTo?.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      result.push(name);
      if (result.length === limit) {
        break;
      }
    }
  }
  return result;
};
