import { memo } from "react";
import Modal from "./Modal";
import { useI18n } from "../i18n";

type InviteLandingModalProps = {
  isOpen: boolean;
  isCopied: boolean;
  onCopy: () => void;
  onJoinHere: () => void;
  onClose: () => void;
};

const InviteLandingModal = memo(function InviteLandingModal({
  isOpen,
  isCopied,
  onCopy,
  onJoinHere,
  onClose,
}: InviteLandingModalProps) {
  const { t } = useI18n();

  if (!isOpen) {return null;}

  return (
    <Modal
      title={t("modal.joinList")}
      onClose={onClose}
      bodyClassName="invite-landing"
      actions={
        <>
          <button type="button" className="text-button" onClick={onJoinHere}>
            {t("inviteLanding.joinHere")}
          </button>
          <button type="button" className="primary-button" onClick={onCopy}>
            {isCopied ? t("inviteLanding.copied") : t("inviteLanding.copy")}
          </button>
        </>
      }
    >
      <p>{t("inviteLanding.body")}</p>
      <ol className="invite-landing__steps">
        <li>{t("inviteLanding.stepCopy", { copy: t("inviteLanding.copy") })}</li>
        <li>{t("inviteLanding.stepOpen")}</li>
        <li>{t("inviteLanding.stepPaste", { joinList: t("drawer.joinList"), paste: t("joinList.paste") })}</li>
      </ol>
      <p className="invite-landing__note">{t("inviteLanding.notInstalled")}</p>
    </Modal>
  );
});

export default InviteLandingModal;
