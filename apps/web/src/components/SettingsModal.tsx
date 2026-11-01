import { memo } from "react";
import Modal from "./Modal";
import { supportedLocales, type Locale } from "../i18n/config";
import { useI18n } from "../i18n";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  // Unset when the app runs without a backend (no AI assistant connections).
  onOpenAiConnectors?: () => void;
};

const toLocale = (value: string): Locale | undefined =>
  supportedLocales.find((locale) => locale === value);

const SettingsModal = memo(function SettingsModal({ isOpen, onClose, onOpenAiConnectors }: SettingsModalProps) {
  const { locale, t, setLanguagePreference } = useI18n();

  if (!isOpen) {return null;}

  return (
    <Modal
      title={t("settings.title")}
      onClose={onClose}
      actions={
        <button type="button" className="text-button" onClick={onClose}>
          {t("common.close")}
        </button>
      }
    >
      <div className="modal__field">
        <label htmlFor="language-select">{t("settings.language")}</label>
        <select
          className="settings-language-select"
          id="language-select"
          value={locale}
          onChange={(event) => {
            const nextLocale = toLocale(event.target.value);
            if (nextLocale) {
              setLanguagePreference(nextLocale);
            }
          }}
        >
          {supportedLocales.map((entry) => (
            <option key={entry} value={entry}>
              {t(`language.${entry}`)}
            </option>
          ))}
        </select>
      </div>
      {onOpenAiConnectors ? (
        <div className="modal__field">
          <span className="ai-connectors__heading">{t("aiConnectors.title")}</span>
          <p className="ai-connectors__hint">{t("aiConnectors.settingsHint")}</p>
          <button type="button" className="text-button settings-ai-connectors" onClick={onOpenAiConnectors}>
            {t("aiConnectors.manage")}
          </button>
        </div>
      ) : null}
    </Modal>
  );
});

export default SettingsModal;
