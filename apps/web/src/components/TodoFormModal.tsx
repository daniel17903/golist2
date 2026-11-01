import { memo, useCallback, type ChangeEvent, type FormEvent } from "react";
import Modal from "./Modal";
import RecurrenceInput from "./RecurrenceInput";
import type { TodoFormValues } from "../hooks/useTodoDialog";
import { useI18n } from "../i18n";

type TodoFormModalProps = {
  isOpen: boolean;
  mode: "add" | "edit";
  values: TodoFormValues;
  knownAssignees: string[];
  onChange: (changes: Partial<TodoFormValues>) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
};

// Add and edit dialog for todos (ported from DoList's AddTodoDialog and
// EditTodoModal, which had the same fields).
const TodoFormModal = memo(function TodoFormModal({
  isOpen,
  mode,
  values,
  knownAssignees,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: TodoFormModalProps) {
  const { t } = useI18n();

  const handleDueDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const dueDate = event.target.value;
    // Recurrence needs a due date to anchor on.
    onChange(dueDate ? { dueDate } : { dueDate, recurrence: "" });
  }, [onChange]);

  const handleRecurrenceChange = useCallback((recurrence: string) => {
    onChange({ recurrence });
  }, [onChange]);

  if (!isOpen) { return null; }

  const isSaveDisabled = !values.title.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaveDisabled) { return; }
    onSave();
  };

  return (
    <Modal
      title={mode === "add" ? t("todo.addTitle") : t("todo.editTitle")}
      onClose={onCancel}
      onSubmit={handleSubmit}
      actions={
        <>
          {mode === "edit" ? (
            <button type="button" className="text-button text-button--danger" onClick={onDelete}>
              {t("todo.delete")}
            </button>
          ) : (
            <button type="button" className="text-button" onClick={onCancel}>
              {t("common.cancel")}
            </button>
          )}
          <button type="submit" className="text-button" disabled={isSaveDisabled}>
            {mode === "add" ? t("todo.add") : t("common.save")}
          </button>
        </>
      }
    >
      <div className="modal__field">
        <label htmlFor="todo-title">{t("todo.title")}</label>
        <input
          id="todo-title"
          value={values.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder={t("todo.titlePlaceholder")}
          autoFocus
          maxLength={200}
        />
      </div>
      <div className="modal__field">
        <label htmlFor="todo-due-date">{t("todo.dueDate")}</label>
        <input id="todo-due-date" type="date" value={values.dueDate} onChange={handleDueDateChange} />
      </div>
      {values.dueDate ? (
        <div className="modal__field modal__field--recurrence">
          <RecurrenceInput value={values.recurrence} onChange={handleRecurrenceChange} />
        </div>
      ) : null}
      <div className="modal__field">
        <label htmlFor="todo-assigned-to">{t("todo.assignedTo")}</label>
        <input
          id="todo-assigned-to"
          value={values.assignedTo}
          onChange={(event) => onChange({ assignedTo: event.target.value })}
          placeholder={t("todo.assignedToPlaceholder")}
          maxLength={80}
        />
        {knownAssignees.length > 0 ? (
          <div className="assignee-suggestions" aria-label={t("todo.recentAssignees")}>
            {knownAssignees.map((name) => (
              <button
                key={name}
                type="button"
                className={`assignee-suggestions__option${
                  values.assignedTo.trim().toLowerCase() === name.toLowerCase()
                    ? " assignee-suggestions__option--active"
                    : ""
                }`}
                onClick={() => onChange({ assignedTo: name })}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="modal__field">
        <label htmlFor="todo-description">{t("todo.description")}</label>
        <textarea
          id="todo-description"
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder={t("todo.descriptionPlaceholder")}
          rows={3}
        />
      </div>
      <div className="modal__field">
        <label htmlFor="todo-points">{t("todo.points")}</label>
        <input
          id="todo-points"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={values.points}
          onChange={(event) => onChange({ points: event.target.value })}
          placeholder={t("todo.pointsPlaceholder")}
        />
      </div>
    </Modal>
  );
});

export default TodoFormModal;
