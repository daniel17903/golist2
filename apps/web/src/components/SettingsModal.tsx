import { supportedLocales, type Locale } from "../i18n/config";
import { useI18n } from "../i18n";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const toLocale = (value: string): Locale | undefined =>
  supportedLocales.find((locale) => locale === value);

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { locale, t, setLanguagePreference } = useI18n();

  if (!isOpen) {return null;}

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal__header">
          <h2>{t("settings.title")}</h2>
        </div>
        <div className="modal__body">
          <div className="modal__field">
            <label htmlFor="language-select">{t("settings.language")}</label>
            <select
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
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
