import { memo, useEffect } from "react";
import { useStore } from "../state/useStore";
import { useI18n } from "../i18n";

const { clearSyncNotice } = useStore.getState();

const BackendLogPanel = memo(function BackendLogPanel() {
  const { t } = useI18n();
  const backendLogs = useStore((s) => s.backendLogs);
  const syncNotice = useStore((s) => s.syncNotice);

  useEffect(() => {
    if (!syncNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      clearSyncNotice();
    }, 6000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [syncNotice]);

  return (
    <>
      {syncNotice ? (
        <div className="sync-toast" role="status" aria-live="polite">
          <span>{syncNotice.message}</span>
          <button type="button" className="sync-toast__close" onClick={clearSyncNotice}>
            {t("common.close")}
          </button>
        </div>
      ) : null}

      <div className="backend-log-panel" aria-live="polite">
        <p className="backend-log-panel__title">{t("debug.backendLogs")}</p>
        <ul className="backend-log-panel__list">
          {backendLogs.length === 0 ? (
            <li className="backend-log-panel__entry backend-log-panel__entry--skipped">
              {t("debug.noBackendLogs")}
            </li>
          ) : (
            backendLogs.slice().reverse().map((entry) => (
              <li
                key={entry.id}
                className={`backend-log-panel__entry backend-log-panel__entry--${entry.outcome}`}
              >
                {entry.message}
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
});

export default BackendLogPanel;
