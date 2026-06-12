import { useCallback, useEffect, useRef } from "react";
import type { List } from "@golist/shared/domain/types";
import { useStore } from "../state/useStore";
import { useI18n } from "../i18n";

// Store actions are stable references — select them once at module scope.
const { ensureShareToken } = useStore.getState();

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
};

type ShareListOptions = {
  activeList: List | null;
  pushAppToast: (message: string, tone: "success" | "error") => void;
};

// Shares the active list: system share sheet when available, clipboard
// fallback otherwise, with a toast describing the outcome.
export const useShareList = ({ activeList, pushAppToast }: ShareListOptions) => {
  const { t } = useI18n();

  const activeListRef = useRef(activeList);
  useEffect(() => { activeListRef.current = activeList; });

  const buildShareLink = useCallback(async (): Promise<string> => {
    const list = activeListRef.current;
    if (!list) {
      throw new Error(t("sync.noActiveList"));
    }
    const token = await ensureShareToken(list.id);
    return `${window.location.origin}/?shareToken=${token}`;
  }, [t]);

  const shareWithSystemSheet = useCallback(async (shareLink: string): Promise<boolean> => {
    if (typeof navigator.share !== "function") {
      return false;
    }

    const sharePayload: ShareData = {
      title: activeListRef.current?.name ?? "GoList",
      text: t("share.text"),
      url: shareLink,
    };

    if (typeof navigator.canShare === "function" && !navigator.canShare(sharePayload)) {
      return false;
    }

    await navigator.share(sharePayload);
    return true;
  }, [t]);

  const handleShareList = useCallback(() => {
    void (async () => {
      try {
        const shareLink = await buildShareLink();
        try {
          const shared = await shareWithSystemSheet(shareLink);
          if (shared) {
            pushAppToast(t("toast.shareSuccess"), "success");
            return;
          }
        } catch (error) {
          if (isAbortError(error)) {
            return;
          }
        }

        await navigator.clipboard.writeText(shareLink);
        pushAppToast(t("toast.shareCopied"), "success");
      } catch {
        pushAppToast(t("toast.shareUnavailable"), "error");
      }
    })();
  }, [buildShareLink, shareWithSystemSheet, pushAppToast, t]);

  return { handleShareList };
};
