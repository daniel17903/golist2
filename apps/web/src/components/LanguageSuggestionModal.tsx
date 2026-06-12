import { memo } from "react";
import Modal from "./Modal";
import type { Locale } from "../i18n/config";
import { useI18n } from "../i18n";

type LanguageSuggestionModalProps = {
  isOpen: boolean;
  suggestedLocale: Locale;
  onAccept: () => void;
  onDismiss: () => void;
};

const LanguageSuggestionModal = memo(function LanguageSuggestionModal({
  isOpen,
  suggestedLocale,
  onAccept,
  onDismiss,
}: LanguageSuggestionModalProps) {
  const { t } = useI18n();

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      title={t("languageSuggestion.title")}
      onClose={onDismiss}
      actions={
        <>
          <button type="button" className="text-button" onClick={onDismiss}>
            {t("languageSuggestion.dismiss")}
          </button>
          <button type="button" className="text-button" onClick={onAccept}>
            {t("languageSuggestion.switch")}
          </button>
        </>
      }
    >
      <p>{t("languageSuggestion.body", { language: t(`language.${suggestedLocale}`) })}</p>
    </Modal>
  );
});

export default LanguageSuggestionModal;
