import { memo } from "react";
import type { AppToast, UndoToast } from "../hooks/useToasts";
import { useI18n } from "../i18n";

type ToastStacksProps = {
  appToasts: AppToast[];
  undoToasts: UndoToast[];
  onCloseAppToast: (toastId: string) => void;
  onUndoDelete: (toastId: string, itemId: string) => void;
  onUndoRename: (toastId: string, listId: string, previousName: string) => void;
};

const ToastStacks = memo(function ToastStacks({
  appToasts,
  undoToasts,
  onCloseAppToast,
  onUndoDelete,
  onUndoRename,
}: ToastStacksProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="app-toast-stack" aria-live="polite" aria-atomic="false">
        {appToasts.map((toast) => (
          <div key={toast.id} className={`app-toast app-toast--${toast.tone}`} role="status">
            <span className="app-toast__text">{toast.message}</span>
            <button type="button" className="app-toast__close" onClick={() => onCloseAppToast(toast.id)}>
              {t("common.close")}
            </button>
          </div>
        ))}
      </div>

      <div className="undo-toast-stack" aria-live="polite" aria-atomic="false">
        {undoToasts.map((toast) => (
          <div key={toast.id} className="undo-toast" role="status">
            <span className="undo-toast__text">
              {toast.kind === "item-delete"
                ? t("toast.undoDeleted", { name: toast.item.name })
                : t("toast.undoRenamed", { name: toast.nextName })}
            </span>
            <button
              type="button"
              className="undo-toast__action"
              onClick={() =>
                toast.kind === "item-delete"
                  ? onUndoDelete(toast.id, toast.item.id)
                  : onUndoRename(toast.id, toast.listId, toast.previousName)
              }
            >
              {t("toast.undo")}
            </button>
          </div>
        ))}
      </div>
    </>
  );
});

export default ToastStacks;
