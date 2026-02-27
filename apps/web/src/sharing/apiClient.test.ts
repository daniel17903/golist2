import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("sharingApiClient", () => {
  it("uses configured API base URL when provided", async () => {
    vi.stubGlobal("__API_BASE_URL__", "https://api.example.test");
    vi.stubGlobal("__API_TIMEOUT_MS__", "4000");

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ listId: crypto.randomUUID() }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;

    const { sharingApiClient } = await import("./apiClient");

    const listId = crypto.randomUUID();
    await sharingApiClient.upsertList({
      deviceId: crypto.randomUUID(),
      listId,
      body: { name: "My List" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`https://api.example.test/v1/lists/${listId}`, expect.any(Object));
  });

  it("throws when backend API URL is not configured", async () => {
    vi.stubGlobal("__API_BASE_URL__", "");
    vi.stubGlobal("__API_TIMEOUT_MS__", "4000");

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const { sharingApiClient, isBackendSharingEnabled } = await import("./apiClient");

    expect(isBackendSharingEnabled).toBe(false);
    await expect(
      sharingApiClient.fetchList({
        deviceId: crypto.randomUUID(),
        listId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Backend API URL is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });



  it("logs failed responses with status code and body", async () => {
    vi.stubGlobal("__API_BASE_URL__", "http://localhost:3000");
    vi.stubGlobal("__API_TIMEOUT_MS__", "4000");

    const fetchMock = vi.fn(async () =>
      new Response('{"error":"forbidden"}', {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;

    const { setBackendCallLogger, sharingApiClient } = await import("./apiClient");
    const logger = vi.fn();
    setBackendCallLogger(logger);

    await expect(
      sharingApiClient.fetchList({
        deviceId: crypto.randomUUID(),
        listId: crypto.randomUUID(),
      }),
    ).rejects.toThrow('fetch list failed: 403 {"error":"forbidden"}');

    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "error",
        message: expect.stringContaining('fetch list failed with 403'),
      }),
    );
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "error",
        message: 'fetch list failed: 403 {"error":"forbidden"}',
      }),
    );
  });

  it("aborts slow requests using configured timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("__API_BASE_URL__", "http://localhost:3000");
    vi.stubGlobal("__API_TIMEOUT_MS__", "5");

    globalThis.fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const { sharingApiClient } = await import("./apiClient");

    const pendingExpectation = expect(
      sharingApiClient.fetchList({
        deviceId: crypto.randomUUID(),
        listId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("timed out");

    await vi.advanceTimersByTimeAsync(10);
    await pendingExpectation;
  });
});
