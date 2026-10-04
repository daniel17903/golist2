import { request, type APIRequestContext } from "@playwright/test";

export const backendUrl = `http://127.0.0.1:${process.env.E2E_BACKEND_PORT ?? 3100}`;

export type RemoteItem = {
  id: string;
  name: string;
  quantityOrUnit?: string;
  category: string;
  iconName: string;
  deleted: boolean;
  updatedAt: string;
};

export type RemoteList = {
  listId: string;
  name: string;
  items: RemoteItem[];
};

// Thin REST client used to assert what actually reached the backend, acting
// on behalf of a given device id.
export class BackendApi {
  private constructor(private readonly context: APIRequestContext) {}

  static async create() {
    const context = await request.newContext({
      baseURL: backendUrl,
      extraHTTPHeaders: { Origin: "http://127.0.0.1" },
    });
    return new BackendApi(context);
  }

  async dispose() {
    await this.context.dispose();
  }

  async getList(deviceId: string, listId: string): Promise<{ status: number; body: RemoteList | null }> {
    const response = await this.context.get(`/v1/lists/${listId}`, { headers: { "x-device-id": deviceId } });
    if (!response.ok()) {
      return { status: response.status(), body: null };
    }
    return { status: response.status(), body: await response.json() };
  }

  async putItem(
    deviceId: string,
    listId: string,
    itemId: string,
    body: { name: string; quantityOrUnit?: string; deleted: boolean; updatedAt: string },
  ) {
    const response = await this.context.put(`/v1/lists/${listId}/items/${itemId}`, {
      headers: { "x-device-id": deviceId },
      data: body,
    });
    return response.status();
  }
}
