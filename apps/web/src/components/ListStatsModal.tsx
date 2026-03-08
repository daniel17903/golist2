import { useMemo } from "react";
import { useI18n } from "../i18n";

type TopItem = {
  name: string;
  count: number;
};

type ListStatsModalProps = {
  isOpen: boolean;
  listName: string;
  totalItemsEver: number;
  openItems: number;
  completedItems: number;
  topItems: TopItem[];
  lastCompletedAt?: number;
  onClose: () => void;
};

const ListStatsModal = ({
  isOpen,
  listName,
  totalItemsEver,
  openItems,
  completedItems,
  topItems,
  lastCompletedAt,
  onClose,
}: ListStatsModalProps) => {
  const { locale, t } = useI18n();

  const completionRate = useMemo(() => {
    if (totalItemsEver === 0) {
      return 0;
    }

    return Math.round((completedItems / totalItemsEver) * 100);
  }, [completedItems, totalItemsEver]);

  const formattedLastCompleted = useMemo(() => {
    if (!lastCompletedAt) {
      return t("stats.noneYet");
    }

    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(lastCompletedAt));
  }, [lastCompletedAt, locale, t]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal__header">
          <h2>{t("stats.title")}</h2>
        </div>
        <div className="modal__body list-stats-modal__body">
          <p className="list-stats-modal__list-name">{listName}</p>
          <ul className="list-stats-modal__grid" aria-label={t("stats.summary")}>
            <li>
              <span>{t("stats.totalItemsEver")}</span>
              <strong>{totalItemsEver}</strong>
            </li>
            <li>
              <span>{t("stats.openItems")}</span>
              <strong>{openItems}</strong>
            </li>
            <li>
              <span>{t("stats.completedItems")}</span>
              <strong>{completedItems}</strong>
            </li>
            <li>
              <span>{t("stats.completionRate")}</span>
              <strong>{completionRate}%</strong>
            </li>
          </ul>

          <section>
            <h3>{t("stats.topItems")}</h3>
            {topItems.length === 0 ? (
              <p>{t("stats.noneYet")}</p>
            ) : (
              <ol className="list-stats-modal__top-items">
                {topItems.map((entry) => (
                  <li key={entry.name}>
                    <span>{entry.name}</span>
                    <strong>{t("stats.timesAdded", { count: entry.count })}</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="list-stats-modal__last-completed">
            <strong>{t("stats.lastCompleted")}</strong> {formattedLastCompleted}
          </p>
        </div>
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListStatsModal;
