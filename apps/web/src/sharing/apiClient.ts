import { isListType } from "@golist/shared/domain/types";
import type {
  ApiListDocument,
  ApiListItem,
  ApiListUpsertRequest,
  ApiListUpsertResponse,
  ApiShareTokenCreateResponse,
  ApiShareTokenRedeemResponse,
} from "@golist/shared/domain/types";

type BackendCallLog = {
  endpoint: string;
  message: string;
  outcome: "success" | "error" | "skipped";
};

const createHeaders = (deviceId: string, options: { includeJsonContentType?: boolean } = {}) => {
  const headers: HeadersInit = {
    "x-device-id": deviceId,
  };

  if (options.includeJsonContentType) {
    headers["content-type"] = "application/json";
  }

  return headers;
};

const readString = (payload: unknown, key: string): string | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const value = Reflect.get(payload, key);
  return typeof value === "string" ? value : null;
};

const readBoolean = (payload: unknown, key: string): boolean | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const value = Reflect.get(payload, key);
  return typeof value === "boolean" ? value : null;
};

const readPositiveInteger = (payload: unknown, key: string): number | undefined => {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  const value = Reflect.get(payload, key);
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
};

const parseApiListItem = (payload: unknown): ApiListItem => {
  const id = readString(payload, "id");
  const name = readString(payload, "name");
  const category = readString(payload, "category");
  const iconName = readString(payload, "iconName");
  const createdAt = readString(payload, "createdAt");
  const updatedAt = readString(payload, "updatedAt");
  const quantityOrUnit = readString(payload, "quantityOrUnit") ?? undefined;
  const createdByDeviceId = readString(payload, "createdByDeviceId") ?? undefined;
  const deleted = readBoolean(payload, "deleted");

  if (!id || !name || !iconName || !category || !createdAt || !updatedAt || deleted === null) {
    throw new Error("Invalid item payload");
  }

  return {
    id,
    name,
    iconName,
    category,
    createdAt,
    updatedAt,
    deleted,
    quantityOrUnit,
    createdByDeviceId,
    description: readString(payload, "description") ?? undefined,
    points: readPositiveInteger(payload, "points"),
    completedAt: readString(payload, "completedAt") ?? undefined,
    dueDate: readString(payload, "dueDate") ?? undefined,
    assignedTo: readString(payload, "assignedTo") ?? undefined,
    recurrence: readString(payload, "recurrence") ?? undefined,
  };
};

const parseListUpsertResponse = (payload: unknown): ApiListUpsertResponse => {
  const listId = readString(payload, "listId");
  if (!listId) {
    throw new Error("Invalid list upsert response payload");
  }
  return { listId };
};

const parseShareTokenCreateResponse = (payload: unknown): ApiShareTokenCreateResponse => {
  const tokenId = readString(payload, "tokenId");
  const listId = readString(payload, "listId");
  const createdAt = readString(payload, "createdAt");
  const shareToken = readString(payload, "shareToken");

  if (!tokenId || !listId || !createdAt || !shareToken) {
    throw new Error("Invalid share token create response payload");
  }

  return { tokenId, listId, createdAt, shareToken };
};

const parseShareTokenRedeemResponse = (payload: unknown): ApiShareTokenRedeemResponse => {
  const listId = readString(payload, "listId");
  if (!listId) {
    throw new Error("Invalid redeem token response payload");
  }

  return { listId };
};

const parseListDocumentResponse = (payload: unknown): ApiListDocument => {
  const listId = readString(payload, "listId");
  const name = readString(payload, "name");
  const createdAt = readString(payload, "createdAt");
  const updatedAt = readString(payload, "updatedAt");
  const rawItems = typeof payload === "object" && payload !== null ? Reflect.get(payload, "items") : null;

  if (!listId || !name || !createdAt || !updatedAt || !Array.isArray(rawItems)) {
    throw new Error("Invalid list document payload");
  }

  const rawListType = typeof payload === "object" && payload !== null ? Reflect.get(payload, "listType") : undefined;

  return {
    listId,
    name,
    listType: isListType(rawListType) ? rawListType : undefined,
    createdAt,
    updatedAt,
    items: rawItems.map((item) => parseApiListItem(item)),
  };
};

/** An AI assistant connection (MCP connector) of this device. */
export type ApiConnector = {
  connectorId: string;
  label: string;
  includeAllLists: boolean;
  listIds: string[];
  createdAt: string;
  lastUsedAt?: string;
};

export type ApiConnectorInput = {
  label: string;
  includeAllLists: boolean;
  listIds: string[];
};

const parseConnector = (payload: unknown): ApiConnector => {
  const connectorId = readString(payload, "connectorId");
  const label = readString(payload, "label");
  const includeAllLists = readBoolean(payload, "includeAllLists");
  const createdAt = readString(payload, "createdAt");
  const rawListIds: unknown =
    typeof payload === "object" && payload !== null ? Reflect.get(payload, "listIds") : undefined;
  if (!connectorId || label === null || includeAllLists === null || !createdAt || !Array.isArray(rawListIds)) {
    throw new Error("Invalid connector response");
  }
  return {
    connectorId,
    label,
    includeAllLists,
    listIds: rawListIds.filter((value): value is string => typeof value === "string"),
    createdAt,
    lastUsedAt: readString(payload, "lastUsedAt") ?? undefined,
  };
};

const parseConnectorKey = (payload: unknown): string => {
  const key = readString(payload, "key");
  if (!key) {
    throw new Error("Invalid connector key response");
  }
  return key;
};

type SharingApiConfig = {
  baseUrl: string | null;
  timeoutMs: number;
  // Resolved per call by default so tests can swap `globalThis.fetch`.
  fetch?: typeof fetch;
  now?: () => number;
};

// One client per backend "device". The app uses the module-level default
// instance below; the sync simulation (apps/web/sim) creates one per virtual
// device with its own fetch so devices can go offline independently.
export const createSharingApiClient = (config: SharingApiConfig) => {
  let backendCallLogger: ((entry: BackendCallLog) => void) | null = null;
  let activeBackendRequestLogger: ((count: number) => void) | null = null;
  let activeBackendRequestCount = 0;
  const fetchImpl: typeof fetch = config.fetch ?? ((input, init) => fetch(input, init));
  const now = config.now ?? (() => Date.now());
  const timeoutMs = config.timeoutMs;
  const apiBaseUrl = config.baseUrl;

  const setBackendCallLogger = (logger: ((entry: BackendCallLog) => void) | null) => {
    backendCallLogger = logger;
  };

  const setActiveBackendRequestLogger = (logger: ((count: number) => void) | null) => {
    activeBackendRequestLogger = logger;
    activeBackendRequestLogger?.(activeBackendRequestCount);
  };

  const logBackendCall = (entry: BackendCallLog) => {
    backendCallLogger?.(entry);
  };

  const requireApiBaseUrl = () => {
    if (apiBaseUrl) {
      return apiBaseUrl;
    }

    throw new Error("Backend API URL is not configured");
  };

  const assertOk = async (response: Response, context: string) => {
    if (response.ok) {
      return;
    }

    const body = await response.text();
    const message = `${context} failed: ${response.status} ${body}`;
    logBackendCall({
      endpoint: response.url || context,
      outcome: "error",
      message,
    });
    throw new Error(message);
  };

  const fetchWithTimeout = async (url: string, options: RequestInit, context: string) => {
    const startedAt = now();
    activeBackendRequestCount += 1;
    activeBackendRequestLogger?.(activeBackendRequestCount);
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const responseBody = await response.clone().text();
        logBackendCall({
          endpoint: url,
          outcome: "error",
          message: `${context} failed with ${response.status} in ${now() - startedAt}ms: ${responseBody}`,
        });
        return response;
      }

      logBackendCall({
        endpoint: url,
        outcome: "success",
        message: `${context} completed with ${response.status} in ${now() - startedAt}ms`,
      });
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        const message = `${context} timed out after ${timeoutMs}ms`;
        logBackendCall({ endpoint: url, outcome: "error", message });
        throw new Error(message, { cause: error });
      }

      const message = `${context} request failed in ${now() - startedAt}ms: no response status/body available`;
      logBackendCall({ endpoint: url, outcome: "error", message });
      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
      activeBackendRequestCount = Math.max(0, activeBackendRequestCount - 1);
      activeBackendRequestLogger?.(activeBackendRequestCount);
    }
  };

  const client = {
    async upsertList(params: {
      deviceId: string;
      listId: string;
      body: ApiListUpsertRequest;
    }): Promise<ApiListUpsertResponse> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/lists/${params.listId}`,
        {
          method: "PUT",
          headers: createHeaders(params.deviceId, { includeJsonContentType: true }),
          body: JSON.stringify(params.body),
        },
        "list upsert",
      );
      await assertOk(response, "list upsert");
      return parseListUpsertResponse(await response.json());
    },

    async fetchList(params: { deviceId: string; listId: string }): Promise<ApiListDocument> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/lists/${params.listId}`,
        {
          method: "GET",
          headers: createHeaders(params.deviceId),
        },
        "fetch list",
      );
      await assertOk(response, "fetch list");
      return parseListDocumentResponse(await response.json());
    },


    async redeemShareToken(params: { deviceId: string; shareToken: string }): Promise<ApiShareTokenRedeemResponse> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/share-tokens/${params.shareToken}/redeem`,
        {
          method: "POST",
          headers: {
            "x-device-id": params.deviceId,
          },
        },
        "redeem token",
      );
      await assertOk(response, "redeem token");
      return parseShareTokenRedeemResponse(await response.json());
    },


    async createShareToken(params: {
      deviceId: string;
      listId: string;
    }): Promise<ApiShareTokenCreateResponse> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/lists/${params.listId}/share-tokens`,
        {
          method: "POST",
          headers: createHeaders(params.deviceId),
        },
        "share token create",
      );
      await assertOk(response, "share token create");
      return parseShareTokenCreateResponse(await response.json());
    },

    /**
     * Reports the lists this device shows. AI assistant connectors only reach
     * lists their owner device still shows (deleting a list is local-only).
     */
    async setDeviceLists(params: { deviceId: string; listIds: string[] }): Promise<void> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/device/lists`,
        {
          method: "PUT",
          headers: createHeaders(params.deviceId, { includeJsonContentType: true }),
          body: JSON.stringify({ listIds: params.listIds }),
        },
        "report device lists",
      );
      await assertOk(response, "report device lists");
    },

    async listConnectors(params: { deviceId: string }): Promise<ApiConnector[]> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/connectors`,
        { method: "GET", headers: createHeaders(params.deviceId) },
        "list connectors",
      );
      await assertOk(response, "list connectors");
      const payload: unknown = await response.json();
      const connectors: unknown =
        typeof payload === "object" && payload !== null ? Reflect.get(payload, "connectors") : undefined;
      if (!Array.isArray(connectors)) {
        throw new Error("Invalid connector list response");
      }
      return connectors.map(parseConnector);
    },

    async createConnector(params: {
      deviceId: string;
      input: ApiConnectorInput;
    }): Promise<{ connector: ApiConnector; key: string }> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/connectors`,
        {
          method: "POST",
          headers: createHeaders(params.deviceId, { includeJsonContentType: true }),
          body: JSON.stringify(params.input),
        },
        "create connector",
      );
      await assertOk(response, "create connector");
      const payload: unknown = await response.json();
      const connector: unknown =
        typeof payload === "object" && payload !== null ? Reflect.get(payload, "connector") : undefined;
      return { connector: parseConnector(connector), key: parseConnectorKey(payload) };
    },

    async updateConnector(params: {
      deviceId: string;
      connectorId: string;
      input: ApiConnectorInput;
    }): Promise<ApiConnector> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/connectors/${params.connectorId}`,
        {
          method: "PUT",
          headers: createHeaders(params.deviceId, { includeJsonContentType: true }),
          body: JSON.stringify(params.input),
        },
        "update connector",
      );
      await assertOk(response, "update connector");
      return parseConnector(await response.json());
    },

    async regenerateConnectorKey(params: { deviceId: string; connectorId: string }): Promise<string> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/connectors/${params.connectorId}/key`,
        { method: "POST", headers: createHeaders(params.deviceId) },
        "regenerate connector key",
      );
      await assertOk(response, "regenerate connector key");
      return parseConnectorKey(await response.json());
    },

    async deleteConnector(params: { deviceId: string; connectorId: string }): Promise<void> {
      const response = await fetchWithTimeout(
        `${requireApiBaseUrl()}/v1/connectors/${params.connectorId}`,
        { method: "DELETE", headers: createHeaders(params.deviceId) },
        "delete connector",
      );
      await assertOk(response, "delete connector");
    },

    /** The URL an AI assistant connects to (the key is its only credential). */
    buildConnectorUrl(key: string): string {
      return new URL(`${requireApiBaseUrl()}/v1/mcp/${key}`, globalThis.location?.origin).toString();
    },
  };

  return {
    client,
    isBackendSharingEnabled: apiBaseUrl !== null,
    setBackendCallLogger,
    setActiveBackendRequestLogger,
  };
};

export type SharingApiClient = ReturnType<typeof createSharingApiClient>["client"];

const readApiBaseUrl = (): string | null => {
  if (typeof __API_BASE_URL__ === "string" && __API_BASE_URL__.trim().length > 0) {
    return __API_BASE_URL__.trim();
  }
  return null;
};

const readRequestTimeoutMs = () => {
  if (typeof __API_TIMEOUT_MS__ === "string") {
    const parsed = Number.parseInt(__API_TIMEOUT_MS__, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 15000;
};

const defaultApi = createSharingApiClient({ baseUrl: readApiBaseUrl(), timeoutMs: readRequestTimeoutMs() });

export const sharingApiClient = defaultApi.client;
export const isBackendSharingEnabled = defaultApi.isBackendSharingEnabled;
export const setBackendCallLogger = defaultApi.setBackendCallLogger;
export const setActiveBackendRequestLogger = defaultApi.setActiveBackendRequestLogger;

export const buildShareLink = (shareToken: string): string =>
  `${window.location.origin}/?shareToken=${shareToken}`;

export const extractShareToken = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const uuidMatcher = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

  const directMatch = trimmed.match(uuidMatcher)?.[0];
  if (directMatch) {
    return directMatch;
  }

  try {
    const asUrl = new URL(trimmed);
    const queryToken = asUrl.searchParams.get("shareToken") ?? asUrl.searchParams.get("token");
    if (queryToken?.match(uuidMatcher)) {
      return queryToken;
    }
    const pathToken = asUrl.pathname.match(uuidMatcher)?.[0];
    return pathToken ?? null;
  } catch {
    return null;
  }
};
