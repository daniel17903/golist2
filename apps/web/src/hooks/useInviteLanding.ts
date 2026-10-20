import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../state/useStore";
import { buildShareLink } from "../sharing/apiClient";
import type { PopupId } from "./usePopupStack";

// Store actions are stable references — select them once at module scope.
const { joinSharedList } = useStore.getState();

type InviteLandingOptions = {
  openPopup: (id: PopupId) => void;
  closePopup: (id: PopupId) => void;
  onCopyFailed: () => void;
  onJoinFailed: () => void;
};

// Share links opened in an iOS browser tab: instead of joining in the
// browser (whose storage the home-screen app does not see), offer to copy
// the invite so it can be pasted into the installed app — or join here.
export const useInviteLanding = ({ openPopup, closePopup, onCopyFailed, onJoinFailed }: InviteLandingOptions) => {
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isInviteCopied, setIsInviteCopied] = useState(false);
  const inviteTokenRef = useRef(inviteToken);
  useEffect(() => { inviteTokenRef.current = inviteToken; });

  const showInviteLanding = useCallback((shareToken: string) => {
    setInviteToken(shareToken);
    setIsInviteCopied(false);
    openPopup("invite-landing");
  }, [openPopup]);

  const closeInviteLanding = useCallback(() => {
    closePopup("invite-landing");
  }, [closePopup]);

  const copyInvite = useCallback(() => {
    const token = inviteTokenRef.current;
    if (!token) {
      return;
    }
    void (async () => {
      try {
        await navigator.clipboard.writeText(buildShareLink(token));
        setIsInviteCopied(true);
      } catch {
        onCopyFailed();
      }
    })();
  }, [onCopyFailed]);

  const joinInBrowser = useCallback(() => {
    const token = inviteTokenRef.current;
    closePopup("invite-landing");
    if (!token) {
      return;
    }
    void (async () => {
      try {
        await joinSharedList(token);
      } catch {
        onJoinFailed();
      }
    })();
  }, [closePopup, onJoinFailed]);

  return { inviteToken, isInviteCopied, showInviteLanding, closeInviteLanding, copyInvite, joinInBrowser };
};
