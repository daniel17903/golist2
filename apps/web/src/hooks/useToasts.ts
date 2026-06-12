import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@golist/shared/domain/types";

export type UndoDeleteToast = {
  id: string;
  kind: "item-delete";
  item: Item;
};

export type UndoRenameToast = {
  id: string;
  kind: "list-rename";
  listId: string;
  previousName: string;
  nextName: string;
};

export type UndoToast = UndoDeleteToast | UndoRenameToast;

export type AppToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

const MAX_UNDO_TOASTS = 3;
const UNDO_TOAST_TIMEOUT_MS = 5000;
const APP_TOAST_TIMEOUT_MS = 4500;

export const useToasts = () => {
  const undoTimeoutsRef = useRef<Map<string, number>>(new Map());
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const [appToasts, setAppToasts] = useState<AppToast[]>([]);

  const clearUndoTimeout = useCallback((toastId: string) => {
    const timeout = undoTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      undoTimeoutsRef.current.delete(toastId);
    }
  }, []);

  const clearAppToastTimeout = useCallback((toastId: string) => {
    const timeout = toastTimeoutsRef.current.get(toastId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      toastTimeoutsRef.current.delete(toastId);
    }
  }, []);

  const removeUndoToast = useCallback((toastId: string) => {
    clearUndoTimeout(toastId);
    setUndoToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, [clearUndoTimeout]);

  const removeAppToast = useCallback((toastId: string) => {
    clearAppToastTimeout(toastId);
    setAppToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, [clearAppToastTimeout]);

  const enqueueUndoToast = useCallback((nextToast: UndoToast, options?: { replaceRenameForListId?: string }) => {
    setUndoToasts((current) => {
      const nextQueue = options?.replaceRenameForListId
        ? current.filter((toast) => {
            const shouldRemove = toast.kind === "list-rename" && toast.listId === options.replaceRenameForListId;
            if (shouldRemove) {
              clearUndoTimeout(toast.id);
            }
            return !shouldRemove;
          })
        : current;
      const queueWithNext = [...nextQueue, nextToast];

      if (queueWithNext.length <= MAX_UNDO_TOASTS) {
        return queueWithNext;
      }

      const overflow = queueWithNext.length - MAX_UNDO_TOASTS;
      const removedToasts = queueWithNext.slice(0, overflow);
      removedToasts.forEach((toast) => clearUndoTimeout(toast.id));
      return queueWithNext.slice(overflow);
    });
  }, [clearUndoTimeout]);

  const pushAppToast = useCallback((message: string, tone: "success" | "error") => {
    const toastId = crypto.randomUUID();
    setAppToasts((current) => [...current, { id: toastId, message, tone }]);
    const timeout = window.setTimeout(() => {
      removeAppToast(toastId);
    }, APP_TOAST_TIMEOUT_MS);
    toastTimeoutsRef.current.set(toastId, timeout);
  }, [removeAppToast]);

  const showUndoDelete = useCallback((item: Item) => {
    const toastId = crypto.randomUUID();
    enqueueUndoToast({ id: toastId, kind: "item-delete", item });
    const timeout = window.setTimeout(() => {
      removeUndoToast(toastId);
    }, UNDO_TOAST_TIMEOUT_MS);
    undoTimeoutsRef.current.set(toastId, timeout);
  }, [enqueueUndoToast, removeUndoToast]);

  const showUndoRename = useCallback((listId: string, previousName: string, nextName: string) => {
    const toastId = crypto.randomUUID();
    enqueueUndoToast(
      { id: toastId, kind: "list-rename", listId, previousName, nextName },
      { replaceRenameForListId: listId },
    );
    const timeout = window.setTimeout(() => {
      removeUndoToast(toastId);
    }, UNDO_TOAST_TIMEOUT_MS);
    undoTimeoutsRef.current.set(toastId, timeout);
  }, [enqueueUndoToast, removeUndoToast]);

  useEffect(
    () => () => {
      undoTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      undoTimeoutsRef.current.clear();
      toastTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      toastTimeoutsRef.current.clear();
    },
    [],
  );

  return {
    undoToasts,
    appToasts,
    pushAppToast,
    showUndoDelete,
    showUndoRename,
    removeUndoToast,
    removeAppToast,
  };
};
