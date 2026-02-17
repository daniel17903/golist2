import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("sharingApiClient", () => {
  it("uses configured API base URL when provided", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ listId: crypto.randomUUID(), shareToken: crypto.randomUUID() }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;

    const { sharingApiClient } = await import("./apiClient");

    await sharingApiClient.upsertList({
      deviceId: crypto.randomUUID(),
      body: { listId: crypto.randomUUID(), name: "My List" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/lists", expect.any(Object));
  });

  it("aborts slow requests using configured timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_API_TIMEOUT_MS", "5");

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
        shareToken: crypto.randomUUID(),
      }),
    ).rejects.toThrow("timed out");

    await vi.advanceTimersByTimeAsync(10);
    await pendingExpectation;
  });
});
