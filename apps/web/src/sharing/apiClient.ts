import type {
  ApiItemUpsertRequest,
  ApiListDocument,
  ApiListItem,
  ApiListUpsertRequest,
  ApiListUpsertResponse,
} from "@golist/shared/domain/types";

type BackendCallLog = {
  endpoint: string;
  message: string;
  outcome: "success" | "error" | "skipped";
};

let backendCallLogger: ((entry: BackendCallLog) => void) | null = null;

export const setBackendCallLogger = (logger: ((entry: BackendCallLog) => void) | null) => {
  backendCallLogger = logger;
};

const logBackendCall = (entry: BackendCallLog) => {
  backendCallLogger?.(entry);
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
  return 4000;
};

const apiBaseUrl = readApiBaseUrl();
const requestTimeoutMs = readRequestTimeoutMs();

const createHeaders = (deviceId: string, shareToken?: string) => {
  const headers: HeadersInit = {
    "content-type": "application/json",
    "x-device-id": deviceId,
  };

  if (shareToken) {
    headers.authorization = `Bearer ${shareToken}`;
  }

  return headers;
};

const assertOk = async (response: Response, context: string) => {
  if (response.ok) {
    return;
  }

  const message = await response.text();
  throw new Error(`${context} failed: ${response.status} ${message}`);
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
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    logBackendCall({
      endpoint: url,
      outcome: "success",
      message: `${context} succeeded with ${response.status} in ${Date.now() - startedAt}ms`,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const message = `${context} timed out after ${requestTimeoutMs}ms`;
      logBackendCall({ endpoint: url, outcome: "error", message });
      throw new Error(message);
    }

    const message = `${context} request failed in ${Date.now() - startedAt}ms`;
    logBackendCall({ endpoint: url, outcome: "error", message });
    throw error;
  } finally {
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
  const shareToken = readString(payload, "shareToken");
  if (!listId || !shareToken) {
    throw new Error("Invalid list upsert response payload");
  }
  return { listId, shareToken };
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
    body: ApiListUpsertRequest;
    shareToken?: string;
  }): Promise<ApiListUpsertResponse> {
    const response = await fetchWithTimeout(
      `${apiBaseUrl}/v1/lists`,
      {
        method: "PUT",
        headers: createHeaders(params.deviceId, params.shareToken),
        body: JSON.stringify(params.body),
      },
      "list upsert",
    );
    await assertOk(response, "list upsert");
    return parseListUpsertResponse(await response.json());
  },

  async fetchList(params: { deviceId: string; shareToken: string }): Promise<ApiListDocument> {
    const response = await fetchWithTimeout(
      `${apiBaseUrl}/v1/lists/${params.shareToken}`,
      {
        method: "GET",
        headers: createHeaders(params.deviceId, params.shareToken),
      },
      "fetch list",
    );
    await assertOk(response, "fetch list");
    return parseListDocumentResponse(await response.json());
  },

  async redeemShareToken(params: { deviceId: string; shareToken: string }): Promise<void> {
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
  },

  async upsertItem(params: {
    deviceId: string;
    shareToken: string;
    itemId: string;
    body: ApiItemUpsertRequest;
  }): Promise<void> {
    const response = await fetchWithTimeout(
      `${apiBaseUrl}/v1/lists/${params.shareToken}/items/${params.itemId}`,
      {
        method: "PUT",
        headers: createHeaders(params.deviceId, params.shareToken),
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
