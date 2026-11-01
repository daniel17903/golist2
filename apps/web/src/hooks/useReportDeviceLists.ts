import { useEffect, useMemo, useRef } from "react";
import type { List } from "@golist/shared/domain/types";
import { sharingApiClient } from "../sharing/apiClient";

type ReportDeviceListsOptions = {
  lists: List[];
  deviceId: string | undefined;
  isLoaded: boolean;
  backendSharingEnabled: boolean;
  backendConnection: "unknown" | "online" | "offline";
};

// Tells the backend which lists this device shows, so AI assistant
// connectors stop reaching a list once it is deleted here (deleting a list is
// local to the device). Sent after loading, whenever the set of list ids
// changes, and again after a failed attempt once the backend is reachable.
export const useReportDeviceLists = ({
  lists,
  deviceId,
  isLoaded,
  backendSharingEnabled,
  backendConnection,
}: ReportDeviceListsOptions) => {
  // Only the ids matter: renames must not trigger a report.
  const listIdsKey = useMemo(() => lists.map((list) => list.id).sort().join(","), [lists]);
  const reportedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Before loading, `lists` is empty: reporting it would hide every list.
    if (!isLoaded || !deviceId || !backendSharingEnabled || backendConnection === "offline") {return;}
    if (reportedKeyRef.current === listIdsKey) {return;}
    const timer = globalThis.setTimeout(() => {
      const listIds = listIdsKey === "" ? [] : listIdsKey.split(",");
      sharingApiClient
        .setDeviceLists({ deviceId, listIds })
        .then(() => {
          reportedKeyRef.current = listIdsKey;
        })
        .catch(() => {
          // Retried on the next list change or reconnect.
        });
    }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [listIdsKey, deviceId, isLoaded, backendSharingEnabled, backendConnection]);
};
