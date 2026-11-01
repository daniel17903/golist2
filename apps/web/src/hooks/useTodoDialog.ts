import { useCallback, useEffect, useRef, useState } from "react";
import { maxTodoPoints, type Item } from "@golist/shared/domain/types";
import { dateInputToMillis, millisToDateInput } from "../domain/dueDate";
import { useStore, type TodoInput } from "../state/useStore";
import type { PopupId } from "./usePopupStack";

// Store actions are stable references — select them once at module scope.
const { addTodo, updateTodo } = useStore.getState();

/** DOM id of the todo dialog's title input (focused synchronously when the add dialog opens). */
export const TODO_TITLE_INPUT_ID = "todo-title";

/** Raw form state of the todo dialog (inputs hold strings). */
export type TodoFormValues = {
  title: string;
  dueDate: string;
  assignedTo: string;
  description: string;
  points: string;
  recurrence: string;
};

const emptyValues: TodoFormValues = {
  title: "",
  dueDate: "",
  assignedTo: "",
  description: "",
  points: "",
  recurrence: "",
};

const toTodoInput = (values: TodoFormValues): TodoInput => {
  const points = Number.parseInt(values.points, 10);
  return {
    title: values.title.trim(),
    description: values.description,
    points: Number.isInteger(points) && points > 0 ? Math.min(points, maxTodoPoints) : undefined,
    dueDate: dateInputToMillis(values.dueDate),
    assignedTo: values.assignedTo,
    recurrence: values.recurrence,
  };
};

const toFormValues = (item: Item): TodoFormValues => ({
  title: item.name,
  dueDate: millisToDateInput(item.dueDate),
  assignedTo: item.assignedTo ?? "",
  description: item.description ?? "",
  points: item.points !== undefined ? String(item.points) : "",
  recurrence: item.recurrence ?? "",
});

type TodoDialogOptions = {
  activeListId: string | undefined;
  items: Item[];
  openPopup: (id: PopupId) => void;
  closePopup: (id: PopupId) => void;
  /** Deletes the edited todo (with the usual undo toast). */
  onDelete: (itemId: string) => void;
};

/** Form state for adding (`add-todo` popup) and editing (`edit-todo` popup) todos. */
export const useTodoDialog = ({ activeListId, items, openPopup, closePopup, onDelete }: TodoDialogOptions) => {
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [values, setValues] = useState<TodoFormValues>(emptyValues);

  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; });

  const onDeleteRef = useRef(onDelete);
  useEffect(() => { onDeleteRef.current = onDelete; });

  const changeValues = useCallback((changes: Partial<TodoFormValues>) => {
    setValues((current) => ({ ...current, ...changes }));
  }, []);

  const openAddTodo = useCallback(() => {
    setMode("add");
    setEditingItemId(null);
    setValues(emptyValues);
    openPopup("add-todo");
  }, [openPopup]);

  const openEditTodo = useCallback((itemId: string) => {
    const item = itemsRef.current.find((entry) => entry.id === itemId);
    if (!item) { return; }
    setMode("edit");
    setEditingItemId(itemId);
    setValues(toFormValues(item));
    openPopup("edit-todo");
  }, [openPopup]);

  const closeTodoDialog = useCallback(() => {
    setEditingItemId(null);
    closePopup("add-todo");
    closePopup("edit-todo");
  }, [closePopup]);

  const saveTodo = useCallback(async () => {
    const input = toTodoInput(values);
    if (!input.title) { return; }
    if (mode === "add") {
      if (!activeListId) { return; }
      await addTodo(activeListId, input);
    } else if (editingItemId) {
      await updateTodo(editingItemId, input);
    }
    closeTodoDialog();
  }, [values, mode, activeListId, editingItemId, closeTodoDialog]);

  const deleteTodo = useCallback(() => {
    if (!editingItemId) { return; }
    onDeleteRef.current(editingItemId);
    closeTodoDialog();
  }, [editingItemId, closeTodoDialog]);

  return {
    todoDialogMode: mode,
    todoFormValues: values,
    changeTodoFormValues: changeValues,
    openAddTodo,
    openEditTodo,
    closeTodoDialog,
    saveTodo,
    deleteTodo,
  };
};
