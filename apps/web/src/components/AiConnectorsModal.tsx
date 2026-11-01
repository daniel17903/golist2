import { memo, useCallback, useEffect, useState, type FormEvent } from "react";
import Modal from "./Modal";
import { useI18n } from "../i18n";
import { sharingApiClient, type ApiConnector } from "../sharing/apiClient";
import { useStore } from "../state/useStore";

type AiConnectorsModalProps = {
  isOpen: boolean;
  deviceId: string | undefined;
  onClose: () => void;
};

type View =
  | { kind: "overview" }
  | { kind: "form"; connector?: ApiConnector }
  // The key is only returned once, so its URL is shown right after creating
  // or regenerating it.
  | { kind: "url"; url: string; label: string };

const formatDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

const AiConnectorsModal = memo(function AiConnectorsModal({ isOpen, deviceId, onClose }: AiConnectorsModalProps) {
  const { t, locale } = useI18n();
  const lists = useStore((state) => state.lists);
  const [connectors, setConnectors] = useState<ApiConnector[] | null>(null);
  const [view, setView] = useState<View>({ kind: "overview" });
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [includeAllLists, setIncludeAllLists] = useState(true);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!deviceId) {return;}
    try {
      setConnectors(await sharingApiClient.listConnectors({ deviceId }));
      setError(null);
    } catch {
      setError(t("aiConnectors.loadFailed"));
    }
  }, [deviceId, t]);

  useEffect(() => {
    if (isOpen) {
      void reload();
    }
  }, [isOpen, reload]);

  if (!isOpen) {return null;}

  const run = async (work: () => Promise<void>) => {
    if (!deviceId || isBusy) {return;}
    setIsBusy(true);
    setError(null);
    try {
      await work();
    } catch {
      setError(t("aiConnectors.saveFailed"));
    } finally {
      setIsBusy(false);
    }
  };

  // Reloads too: "last used" and the list counts change while the URL view
  // or the form is open (the assistant may already be using the URL).
  const backToOverview = () => {
    setView({ kind: "overview" });
    void reload();
  };

  const openForm = (connector?: ApiConnector) => {
    setLabel(connector?.label ?? "Claude");
    setIncludeAllLists(connector?.includeAllLists ?? true);
    setSelectedListIds(connector?.listIds ?? []);
    setError(null);
    setView({ kind: "form", connector });
  };

  const showUrl = (key: string, connectorLabel: string) => {
    setIsCopied(false);
    setView({ kind: "url", url: sharingApiClient.buildConnectorUrl(key), label: connectorLabel });
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (view.kind !== "form" || !deviceId) {return;}
    const input = {
      label: label.trim(),
      includeAllLists,
      listIds: includeAllLists ? [] : selectedListIds,
    };
    const editing = view.connector;
    void run(async () => {
      if (editing) {
        await sharingApiClient.updateConnector({ deviceId, connectorId: editing.connectorId, input });
        setView({ kind: "overview" });
        await reload();
        return;
      } else {
        const created = await sharingApiClient.createConnector({ deviceId, input });
        showUrl(created.key, created.connector.label);
      }
    });
  };

  const handleRegenerate = (connector: ApiConnector) => {
    void run(async () => {
      const key = await sharingApiClient.regenerateConnectorKey({ deviceId: deviceId!, connectorId: connector.connectorId });
      showUrl(key, connector.label);
    });
  };

  const handleDelete = (connector: ApiConnector) => {
    if (confirmDeleteId !== connector.connectorId) {
      setConfirmDeleteId(connector.connectorId);
      return;
    }
    setConfirmDeleteId(null);
    void run(async () => {
      await sharingApiClient.deleteConnector({ deviceId: deviceId!, connectorId: connector.connectorId });
      await reload();
    });
  };

  const handleCopy = (url: string) => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(url);
        setIsCopied(true);
      } catch {
        setIsCopied(false);
      }
    })();
  };

  const listsLabel = (connector: ApiConnector) =>
    connector.includeAllLists
      ? t("aiConnectors.allLists")
      : t("aiConnectors.someLists", { count: String(connector.listIds.length) });

  const errorMessage = error ? (
    <p className="ai-connectors__error" role="alert">
      {error}
    </p>
  ) : null;

  if (view.kind === "url") {
    return (
      <Modal
        title={t("aiConnectors.urlTitle", { label: view.label })}
        onClose={onClose}
        actions={
          <button type="button" className="text-button" onClick={backToOverview}>
            {t("aiConnectors.done")}
          </button>
        }
      >
        <div className="modal__field">
          <label htmlFor="ai-connector-url">{t("aiConnectors.url")}</label>
          <input id="ai-connector-url" value={view.url} readOnly onFocus={(event) => event.currentTarget.select()} />
        </div>
        <button type="button" className="text-button ai-connectors__copy" onClick={() => handleCopy(view.url)}>
          {isCopied ? t("aiConnectors.copied") : t("aiConnectors.copy")}
        </button>
        <p className="ai-connectors__hint">{t("aiConnectors.howTo")}</p>
        <p className="ai-connectors__hint">{t("aiConnectors.secretHint")}</p>
      </Modal>
    );
  }

  if (view.kind === "form") {
    const isSaveDisabled = isBusy || label.trim().length === 0 || (!includeAllLists && selectedListIds.length === 0);
    return (
      <Modal
        title={view.connector ? t("aiConnectors.editTitle") : t("aiConnectors.addTitle")}
        onClose={onClose}
        onSubmit={handleSave}
        actions={
          <>
            <button type="button" className="text-button" onClick={backToOverview}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="text-button" disabled={isSaveDisabled}>
              {view.connector ? t("common.save") : t("aiConnectors.create")}
            </button>
          </>
        }
      >
        <div className="modal__field">
          <label htmlFor="ai-connector-label">{t("aiConnectors.label")}</label>
          <input
            id="ai-connector-label"
            value={label}
            maxLength={60}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("aiConnectors.labelPlaceholder")}
          />
        </div>
        <fieldset className="ai-connectors__scope">
          <legend>{t("aiConnectors.access")}</legend>
          <label className="ai-connectors__option">
            <input type="radio" checked={includeAllLists} onChange={() => setIncludeAllLists(true)} />
            {t("aiConnectors.accessAll")}
          </label>
          <label className="ai-connectors__option">
            <input type="radio" checked={!includeAllLists} onChange={() => setIncludeAllLists(false)} />
            {t("aiConnectors.accessSelected")}
          </label>
          {!includeAllLists ? (
            <div className="ai-connectors__lists">
              {lists.map((list) => (
                <label key={list.id} className="ai-connectors__option">
                  <input
                    type="checkbox"
                    checked={selectedListIds.includes(list.id)}
                    onChange={(event) =>
                      setSelectedListIds((current) =>
                        event.target.checked ? [...current, list.id] : current.filter((id) => id !== list.id),
                      )
                    }
                  />
                  {list.name}
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
        {errorMessage}
      </Modal>
    );
  }

  return (
    <Modal
      title={t("aiConnectors.title")}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="text-button" onClick={onClose}>
            {t("common.close")}
          </button>
          <button type="button" className="text-button" onClick={() => openForm()} disabled={!deviceId}>
            {t("aiConnectors.add")}
          </button>
        </>
      }
    >
      <p className="ai-connectors__hint">{t("aiConnectors.intro")}</p>
      {connectors === null && !error ? <p className="ai-connectors__hint">{t("aiConnectors.loading")}</p> : null}
      {connectors?.length === 0 ? <p className="ai-connectors__hint">{t("aiConnectors.empty")}</p> : null}
      <ul className="ai-connectors__list">
        {connectors?.map((connector) => (
          <li key={connector.connectorId} className="ai-connectors__item" data-testid="ai-connector">
            <div className="ai-connectors__item-text">
              <strong>{connector.label}</strong>
              <span>
                {listsLabel(connector)} ·{" "}
                {connector.lastUsedAt
                  ? t("aiConnectors.lastUsed", { date: formatDate(connector.lastUsedAt, locale) })
                  : t("aiConnectors.neverUsed")}
              </span>
            </div>
            <div className="ai-connectors__item-actions">
              <button type="button" className="text-button" onClick={() => openForm(connector)} disabled={isBusy}>
                {t("aiConnectors.edit")}
              </button>
              <button type="button" className="text-button" onClick={() => handleRegenerate(connector)} disabled={isBusy}>
                {t("aiConnectors.newUrl")}
              </button>
              <button
                type="button"
                className="text-button text-button--danger"
                onClick={() => handleDelete(connector)}
                disabled={isBusy}
              >
                {confirmDeleteId === connector.connectorId ? t("aiConnectors.confirmRemove") : t("aiConnectors.remove")}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {errorMessage}
    </Modal>
  );
});

export default AiConnectorsModal;
