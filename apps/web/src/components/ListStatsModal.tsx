import { useMemo } from "react";
import { useI18n } from "../i18n";

type TopItem = {
  name: string;
  count: number;
  averageFrequencyMs?: number;
};

type ListStatsModalProps = {
  isOpen: boolean;
  listName: string;
  totalItemsEver: number;
  openItems: number;
  topItems: TopItem[];
  lastBoughtAt?: number;
  onClose: () => void;
};

const ListStatsModal = ({
  isOpen,
  listName,
  totalItemsEver,
  openItems,
  topItems,
  lastBoughtAt,
  onClose,
}: ListStatsModalProps) => {
  const { locale, t } = useI18n();

  const formattedLastBought = useMemo(() => {
    if (!lastBoughtAt) {
      return t("stats.noneYet");
    }

    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(lastBoughtAt));
  }, [lastBoughtAt, locale, t]);

  const formatAverageFrequency = (value: number) => {
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (value >= day) {
      return t("stats.avgEveryDays", { count: Math.round(value / day) });
    }

    if (value >= hour) {
      return t("stats.avgEveryHours", { count: Math.round(value / hour) });
    }

    return t("stats.avgEveryMinutes", { count: Math.max(1, Math.round(value / minute)) });
  };

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
          </ul>

          <section>
            <h3>{t("stats.topItems")}</h3>
            {topItems.length === 0 ? (
              <p>{t("stats.noneYet")}</p>
            ) : (
              <ol className="list-stats-modal__top-items">
                {topItems.map((entry) => (
                  <li key={entry.name}>
                    <span>
                      {entry.name}
                      {entry.averageFrequencyMs ? (
                        <small className="list-stats-modal__avg-frequency">
                          {formatAverageFrequency(entry.averageFrequencyMs)}
                        </small>
                      ) : null}
                    </span>
                    <strong>{t("stats.timesAdded", { count: entry.count })}</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="list-stats-modal__last-bought">
            <strong>{t("stats.lastBought")}</strong> {formattedLastBought}
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
