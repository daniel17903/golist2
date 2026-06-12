import { useEffect } from "react";
import { useStore } from "../state/useStore";
import { useI18n } from "../i18n";

// Store actions are stable references — select them once at module scope.
const { load, addList, joinSharedList, syncAllLists } = useStore.getState();

// One-time app startup work: initial load, default list creation, share-token
// redemption from the URL, and the periodic background sync.
export const useAppBootstrap = () => {
  const { t } = useI18n();
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

    void (async () => {
      try {
        await joinSharedList(shareTokenFromUrl);
      } finally {
        const cleanedUrl = new URL(window.location.href);
        cleanedUrl.searchParams.delete("shareToken");
        window.history.replaceState({}, "", cleanedUrl.toString());
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
