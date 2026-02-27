import { useI18n } from "../i18n";

type BottomBarProps = {
  onOpenDrawer: () => void;
  onAddItem: () => void;
  onShareList: () => void;
  canShareList: boolean;
  backendConnection: "unknown" | "online" | "offline";
  isBackendBusy: boolean;
};

const BottomBar = ({ onOpenDrawer, onAddItem, onShareList, canShareList, backendConnection, isBackendBusy }: BottomBarProps) => {
  const { t } = useI18n();

  return (
    <footer className="bottom-bar">
      <button
        className="bottom-icon"
        type="button"
        aria-label={t("bottom.openListMenu")}
        onClick={onOpenDrawer}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
            fill="currentColor"
          />
        </svg>
      </button>
      <button className="fab" type="button" onClick={onAddItem} aria-label={t("bottom.addItem")}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
        </svg>
      </button>
      <div className="bottom-bar__actions-right">
        <span className="header-status bottom-bar__status" role="status" aria-live="polite">
          {isBackendBusy ? (
            <span
              className="connection-spinner"
              aria-label={t("header.backendSyncing")}
              title={t("header.backendSyncing")}
            />
          ) : (
            <span
              className={`connection-icon connection-icon--${backendConnection}`}
              aria-label={t("header.backendStatus", { status: backendConnection })}
              title={t("header.backendStatus", { status: backendConnection })}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M19 18H6a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 17.06 9a3.75 3.75 0 0 1 1.94 7z"
                  fill="currentColor"
                />
              </svg>
            </span>
          )}
        </span>
        {canShareList ? (
          <button className="bottom-icon" type="button" aria-label={t("bottom.shareList")} onClick={onShareList}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7 0-.24-.03-.47-.09-.7l7.02-4.11c.54.5 1.25.81 2.07.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.03.47.09.7L8.91 9.81C8.37 9.31 7.66 9 6.84 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.82 0 1.53-.31 2.07-.81l7.12 4.19c-.05.2-.08.41-.08.62 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"
                fill="currentColor"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </footer>
  );
};

export default BottomBar;
