import type {
  ApiItemUpsertRequest,
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

let backendCallLogger: ((entry: BackendCallLog) => void) | null = null;
let backendActivityListener: ((inFlightRequests: number) => void) | null = null;
let inFlightRequestCount = 0;

export const setBackendCallLogger = (logger: ((entry: BackendCallLog) => void) | null) => {
  backendCallLogger = logger;
};

export const setBackendActivityListener = (listener: ((inFlightRequests: number) => void) | null) => {
  backendActivityListener = listener;
};

const logBackendCall = (entry: BackendCallLog) => {
  backendCallLogger?.(entry);
};

const updateBackendActivity = (delta: number) => {
  inFlightRequestCount = Math.max(0, inFlightRequestCount + delta);
  backendActivityListener?.(inFlightRequestCount);
};

const readApiBaseUrl = () => {
  if (typeof __API_BASE_URL__ === "string" && __API_BASE_URL__.trim().length > 0) {
    return __API_BASE_URL__.trim();
  }

  logBackendCall({
    endpoint: "configuration",
    outcome: "skipped",
    message: "Backend API URL missing. Falling back to http://localhost:3000.",
  });
  return "http://localhost:3000";
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

const apiBaseUrl = readApiBaseUrl();
const requestTimeoutMs = readRequestTimeoutMs();

const createHeaders = (deviceId: string, options: { includeJsonContentType?: boolean } = {}) => {
  const headers: HeadersInit = {
    "x-device-id": deviceId,
  };

  if (options.includeJsonContentType) {
    headers["content-type"] = "application/json";
  }

  return headers;
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

const fetchWithTimeout = async (url: string, options: RequestInit, context: string) => {
  const startedAt = Date.now();
  updateBackendActivity(1);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const responseBody = await response.clone().text();
      logBackendCall({
        endpoint: url,
        outcome: "error",
        message: `${context} failed with ${response.status} in ${Date.now() - startedAt}ms: ${responseBody}`,
      });
      return response;
    }

    logBackendCall({
      endpoint: url,
      outcome: "success",
      message: `${context} completed with ${response.status} in ${Date.now() - startedAt}ms`,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const message = `${context} timed out after ${requestTimeoutMs}ms`;
      logBackendCall({ endpoint: url, outcome: "error", message });
      throw new Error(message);
    }

    const message = `${context} request failed in ${Date.now() - startedAt}ms: no response status/body available`;
    logBackendCall({ endpoint: url, outcome: "error", message });
    throw error;
  } finally {
    updateBackendActivity(-1);
    globalThis.clearTimeout(timeout);
  }
};

const parseApiListItem = (payload: unknown): ApiListItem => {
  const id = readString(payload, "id");
  const name = readString(payload, "name");
  const category = readString(payload, "category");
  const createdAt = readString(payload, "createdAt");
  const updatedAt = readString(payload, "updatedAt");
  const quantityOrUnit = readString(payload, "quantityOrUnit") ?? undefined;
  const deleted = readBoolean(payload, "deleted");

  if (!id || !name || !category || !createdAt || !updatedAt || deleted === null) {
    throw new Error("Invalid item payload");
  }

  return { id, name, category, createdAt, updatedAt, deleted, quantityOrUnit };
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

  return {
    listId,
    name,
    createdAt,
    updatedAt,
    items: rawItems.map((item) => parseApiListItem(item)),
  };
};

export const sharingApiClient = {
  async upsertList(params: {
    deviceId: string;
    listId: string;
    body: ApiListUpsertRequest;
  }): Promise<ApiListUpsertResponse> {
    const response = await fetchWithTimeout(
      `${apiBaseUrl}/v1/lists/${params.listId}`,
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
      `${apiBaseUrl}/v1/lists/${params.listId}`,
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
      `${apiBaseUrl}/v1/share-tokens/${params.shareToken}/redeem`,
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
      `${apiBaseUrl}/v1/lists/${params.listId}/share-tokens`,
      {
        method: "POST",
        headers: createHeaders(params.deviceId),
      },
      "share token create",
    );
    await assertOk(response, "share token create");
    return parseShareTokenCreateResponse(await response.json());
  },

  async upsertItem(params: {
    deviceId: string;
    listId: string;
    itemId: string;
    body: ApiItemUpsertRequest;
  }): Promise<void> {
    const response = await fetchWithTimeout(
      `${apiBaseUrl}/v1/lists/${params.listId}/items/${params.itemId}`,
      {
        method: "PUT",
        headers: createHeaders(params.deviceId, { includeJsonContentType: true }),
        body: JSON.stringify(params.body),
      },
      "item upsert",
    );
    await assertOk(response, "item upsert");
  },
};

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
