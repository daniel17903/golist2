import { describe, expect, it } from "vitest";

const baseUrl = process.env.GOLIST_INTEGRATION_BASE_URL;

const maybeIt = baseUrl ? it : it.skip;

const readString = (payload: unknown, key: string): string | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const value = Reflect.get(payload, key);
  return typeof value === "string" ? value : null;
};

describe("sharing API integration", () => {
  maybeIt("creates, redeems, and reads a shared list across devices", async () => {
    const ownerDeviceId = crypto.randomUUID();
    const guestDeviceId = crypto.randomUUID();
    const listId = crypto.randomUUID();

    const createResponse = await fetch(`${baseUrl}/v1/lists`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-device-id": ownerDeviceId,
      },
      body: JSON.stringify({ listId, name: "Integration List" }),
    });

    expect(createResponse.status).toBe(201);
    const createdPayload = await createResponse.json();
    const createdShareToken = readString(createdPayload, "shareToken");
    const createdListId = readString(createdPayload, "listId");

    expect(createdListId).toBe(listId);
    expect(createdShareToken).toBeTruthy();
    if (!createdShareToken) {
      throw new Error("Missing share token");
    }

    const redeemResponse = await fetch(`${baseUrl}/v1/share-tokens/${createdShareToken}/redeem`, {
      method: "POST",
      headers: {
        "x-device-id": guestDeviceId,
      },
    });

    expect(redeemResponse.status).toBe(204);

    const listResponse = await fetch(`${baseUrl}/v1/lists/${createdShareToken}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createdShareToken}`,
        "x-device-id": guestDeviceId,
      },
    });

    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    const fetchedListId = readString(listPayload, "listId");
    const fetchedName = readString(listPayload, "name");

    expect(fetchedListId).toBe(listId);
    expect(fetchedName).toBe("Integration List");
  });
});
