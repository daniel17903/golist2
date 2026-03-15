import type { Locale } from "../i18n/config";
import { useI18n } from "../i18n";

type LanguageSuggestionModalProps = {
  isOpen: boolean;
  suggestedLocale: Locale;
  onAccept: () => void;
  onDismiss: () => void;
};

const LanguageSuggestionModal = ({
  isOpen,
  suggestedLocale,
  onAccept,
  onDismiss,
}: LanguageSuggestionModalProps) => {
  const { t } = useI18n();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onDismiss}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal__header">
          <h2>{t("languageSuggestion.title")}</h2>
        </div>
        <div className="modal__body">
          <p>{t("languageSuggestion.body", { language: t(`language.${suggestedLocale}`) })}</p>
        </div>
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onDismiss}>
            {t("languageSuggestion.dismiss")}
          </button>
          <button type="button" className="text-button" onClick={onAccept}>
            {t("languageSuggestion.switch")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageSuggestionModal;
