import { useEffect, useRef } from "react";
import { useStore } from "../state/useStore";
import { useI18n } from "../i18n";
import { isIosBrowserTab, readDisplayEnvironment } from "../domain/iosBrowserTab";
import { extractShareToken } from "../sharing/apiClient";

// Store actions are stable references — select them once at module scope.
const { load, addList, joinSharedList, syncAllLists } = useStore.getState();

// One-time app startup work: initial load, default list creation, share-token
// redemption from the URL, and the periodic background sync.
type AppBootstrapOptions = {
  // Called when the share token from the URL cannot be redeemed.
  onShareLinkJoinFailed: () => void;
  // Called instead of joining when a share link opens in an iOS browser tab,
  // where the list would land in the browser's storage rather than in the
  // installed home-screen app.
  onIosShareLink: (shareToken: string) => void;
};

export const useAppBootstrap = ({ onShareLinkJoinFailed, onIosShareLink }: AppBootstrapOptions) => {
  const { t } = useI18n();
  const onShareLinkJoinFailedRef = useRef(onShareLinkJoinFailed);
  useEffect(() => { onShareLinkJoinFailedRef.current = onShareLinkJoinFailed; });
  const onIosShareLinkRef = useRef(onIosShareLink);
  useEffect(() => { onIosShareLinkRef.current = onIosShareLink; });
  const isLoaded = useStore((s) => s.isLoaded);
  const listCount = useStore((s) => s.lists.length);
  const backendSharingEnabled = useStore((s) => s.backendSharingEnabled);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (isLoaded && listCount === 0) {
      void addList(t("app.defaultListName"));
    }
  }, [isLoaded, listCount, t]);

  useEffect(() => {
    if (!isLoaded || !backendSharingEnabled) {
      return;
    }

    const shareTokenFromUrl = new URLSearchParams(window.location.search).get("shareToken");
    if (!shareTokenFromUrl) {
      return;
    }

    const removeShareTokenFromUrl = () => {
      const cleanedUrl = new URL(window.location.href);
      cleanedUrl.searchParams.delete("shareToken");
      window.history.replaceState({}, "", cleanedUrl.toString());
    };

    if (isIosBrowserTab(readDisplayEnvironment())) {
      // Validate up front: a mangled link must not be offered for copying.
      const shareToken = extractShareToken(shareTokenFromUrl);
      if (shareToken) {
        onIosShareLinkRef.current(shareToken);
      } else {
        onShareLinkJoinFailedRef.current();
      }
      removeShareTokenFromUrl();
      return;
    }

    void (async () => {
      try {
        await joinSharedList(shareTokenFromUrl);
      } catch {
        onShareLinkJoinFailedRef.current();
      } finally {
        removeShareTokenFromUrl();
      }
    })();
  }, [isLoaded, backendSharingEnabled]);

  useEffect(() => {
    if (!isLoaded || !backendSharingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void syncAllLists();
    }, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncAllLists();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onVisibilityChange);
    };
  }, [isLoaded, backendSharingEnabled]);
};
