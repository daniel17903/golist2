import { memo } from "react";
import Modal from "./Modal";
import { UNASSIGNED_KEY, type PersonListStats } from "../domain/todoStats";
import { useI18n } from "../i18n";

// Inline SVG icons for stats rows
const LastWeekIcon = () => (
  <svg className="stats-row__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
);

const ThisWeekIcon = () => (
  <svg className="stats-row__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
  </svg>
);

const NextWeekIcon = () => (
  <svg className="stats-row__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
  </svg>
);

const OverallIcon = () => (
  <svg className="stats-row__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

const getProgressPercent = (completed: number, planned: number): number =>
  planned === 0 ? 0 : Math.min(100, (completed / planned) * 100);

const renderProgressValue = (completed: number, planned: number): string =>
  planned === 0 ? String(completed) : `${completed} / ${planned}`;

type TodoStatsModalProps = {
  isOpen: boolean;
  rows: PersonListStats[];
  onClose: () => void;
};

// Per-person points stats of a todo list (ported from DoList's ListStatsModal).
const TodoStatsModal = memo(function TodoStatsModal({ isOpen, rows, onClose }: TodoStatsModalProps) {
  const { t } = useI18n();

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      title={t("todo.stats.title")}
      onClose={onClose}
      actions={
        <button type="button" className="text-button" onClick={onClose}>
          {t("common.close")}
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="stats-empty">{t("todo.stats.empty")}</p>
      ) : (
        <div className="stats-cards">
          {rows.map((row) => (
            <div key={row.personKey} className="stats-card">
              <div className="stats-card__header">
                {row.personKey === UNASSIGNED_KEY ? t("todo.stats.unassigned") : row.personLabel}
              </div>

              <div className="stats-rows">
                {/* Last week - with progress bar */}
                <div className="stats-row stats-row--last-week">
                  <span className="stats-row__label">
                    <LastWeekIcon />
                    {t("todo.stats.lastWeek")}
                  </span>
                  {row.plannedLastWeek > 0 && (
                    <div className="stats-row__bar-wrap">
                      <div
                        className="stats-row__bar stats-row__bar--last-week"
                        style={{
                          width: `${getProgressPercent(row.completedLastWeek, row.plannedLastWeek)}%`,
                        }}
                      />
                    </div>
                  )}
                  <span className="stats-row__value stats-row__value--progress">
                    {renderProgressValue(row.completedLastWeek, row.plannedLastWeek)}
                  </span>
                </div>

                {/* This week - with progress bar */}
                <div className="stats-row stats-row--this-week">
                  <span className="stats-row__label">
                    <ThisWeekIcon />
                    {t("todo.stats.thisWeek")}
                  </span>
                  {row.plannedThisWeek > 0 && (
                    <div className="stats-row__bar-wrap">
                      <div
                        className="stats-row__bar stats-row__bar--this-week"
                        style={{
                          width: `${getProgressPercent(row.completedThisWeek, row.plannedThisWeek)}%`,
                        }}
                      />
                    </div>
                  )}
                  <span className="stats-row__value stats-row__value--progress">
                    {renderProgressValue(row.completedThisWeek, row.plannedThisWeek)}
                  </span>
                </div>

                {/* Next week - just count */}
                <div className="stats-row stats-row--next-week">
                  <span className="stats-row__label">
                    <NextWeekIcon />
                    {t("todo.stats.plannedNextWeek")}
                  </span>
                  <span className="stats-row__value stats-row__value--next-week">
                    {row.plannedNextWeek}
                  </span>
                </div>

                {/* Overall - just count */}
                <div className="stats-row stats-row--overall">
                  <span className="stats-row__label">
                    <OverallIcon />
                    {t("todo.stats.completedOverall")}
                  </span>
                  <span className="stats-row__value stats-row__value--overall">
                    {row.completedOverall}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
});

export default TodoStatsModal;
