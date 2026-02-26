import { useI18n } from "../i18n";

type LegalModalType = "imprint" | "privacy";

type LegalModalProps = {
  isOpen: boolean;
  type: LegalModalType;
  onClose: () => void;
};

const LegalModal = ({ isOpen, type, onClose }: LegalModalProps) => {
  const { t } = useI18n();

  if (!isOpen) {return null;}

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {type === "imprint" ? (
          <>
            <div className="modal__header">
              <h2>{t("legal.imprintTitle")}</h2>
            </div>
            <div className="modal__body legal-modal__body">
              <p>{t("legal.imprintIntro")}</p>
              <p>{t("legal.placeholderCompany")}</p>
              <p>{t("legal.placeholderAddress")}</p>
              <p>{t("legal.placeholderContact")}</p>
              <p className="legal-modal__note">{t("legal.templateNote")}</p>
            </div>
          </>
        ) : (
          <>
            <div className="modal__header">
              <h2>{t("legal.privacyTitle")}</h2>
            </div>
            <div className="modal__body legal-modal__body">
              <p>{t("legal.privacyIntro")}</p>
              <h3>{t("legal.sectionControllerTitle")}</h3>
              <p>{t("legal.sectionControllerCopy")}</p>
              <h3>{t("legal.sectionDataTitle")}</h3>
              <p>{t("legal.sectionDataCopy")}</p>
              <h3>{t("legal.sectionRightsTitle")}</h3>
              <p>{t("legal.sectionRightsCopy")}</p>
              <p className="legal-modal__note">{t("legal.templateNote")}</p>
            </div>
          </>
        )}
        <div className="modal__actions">
          <button type="button" className="text-button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
