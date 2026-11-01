import { expect, test } from "./fixtures";

const field = (value: unknown, key: string | number): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

// Calls a tool on the MCP endpoint the way a 2025-era assistant does: one
// stateless JSON-RPC POST (the response is JSON or a one-event SSE stream).
// Returns the HTTP status and the JSON the tool returned as text.
const callTool = async (url: string, name: string, args: Record<string, unknown> = {}) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await response.text();
  const message = text.startsWith("{") ? text : (/^data: (.*)$/m.exec(text)?.[1] ?? "null");
  const toolText = field(field(field(field(JSON.parse(message), "result"), "content"), 0), "text");
  const result: unknown = typeof toolText === "string" ? JSON.parse(toolText) : null;
  return { status: response.status, result };
};

const listsOf = (result: unknown): Array<{ listId: string; name: string }> => {
  const lists = field(result, "lists");
  return (Array.isArray(lists) ? lists : []).map((list: unknown) => ({
    listId: String(field(list, "listId")),
    name: String(field(list, "name")),
  }));
};

test.describe("AI assistant connections", () => {
  test("creates a connector URL that an assistant uses to edit the lists live", async ({ app }) => {
    await app.waitForRealtimeSync();
    const listName = (await app.listTitle.textContent())?.trim() ?? "";

    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Settings" }).click();
    await app.page.getByRole("button", { name: "Connect an AI assistant" }).click();
    await expect(app.page.getByRole("heading", { name: "AI assistants" })).toBeVisible();
    await expect(app.page.getByText("No assistants connected yet.")).toBeVisible();

    await app.page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(app.page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Claude");
    await app.page.getByRole("button", { name: "Create URL" }).click();

    const urlInput = app.page.getByLabel("Connector URL");
    await expect(urlInput).toHaveValue(/\/v1\/mcp\/[A-Za-z0-9_-]{43}$/);
    const url = await urlInput.inputValue();
    await app.page.getByRole("button", { name: "Copy URL" }).click();
    await expect(app.page.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await app.copiedTexts()).toContain(url);

    // The assistant sees the device's list and adds an item; the open app
    // shows it without a reload.
    const listed = await callTool(url, "list_lists");
    expect(listed.status).toBe(200);
    const lists = listsOf(listed.result);
    const list = lists.find((entry) => entry.name === listName);
    expect(list?.listId).toBe(await app.activeListId());
    expect((await callTool(url, "add_items", { listId: list!.listId, items: [{ name: "Bananas" }] })).status).toBe(200);
    await expect(app.itemCard("Bananas")).toBeVisible();

    await app.page.getByRole("button", { name: "Done" }).click();
    const connector = app.page.getByTestId("ai-connector");
    await expect(connector).toContainText("Claude");
    await expect(connector).toContainText("All lists");
    await expect(connector).toContainText("last used");

    await connector.getByRole("button", { name: "Remove" }).click();
    await connector.getByRole("button", { name: "Tap again to remove" }).click();
    await expect(app.page.getByText("No assistants connected yet.")).toBeVisible();
    expect((await callTool(url, "list_lists")).status).toBe(404);
  });

  test("limits a connector to the picked lists", async ({ app }) => {
    await app.waitForRealtimeSync();
    const firstListId = await app.activeListId();
    await app.createList("Hardware store");
    await app.waitForRealtimeSync();

    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Settings" }).click();
    await app.page.getByRole("button", { name: "Connect an AI assistant" }).click();
    await app.page.getByRole("button", { name: "Add", exact: true }).click();
    await app.page.getByRole("textbox", { name: "Name", exact: true }).fill("ChatGPT");
    await app.page.getByRole("radio", { name: "Only these lists:" }).check();
    await app.page.getByRole("checkbox", { name: "Hardware store" }).check();
    await app.page.getByRole("button", { name: "Create URL" }).click();
    const url = await app.page.getByLabel("Connector URL").inputValue();

    const listed = await callTool(url, "list_lists");
    const lists = listsOf(listed.result);
    expect(lists.map((entry) => entry.name)).toEqual(["Hardware store"]);
    expect(lists.map((entry) => entry.listId)).not.toContain(firstListId);

    await app.page.getByRole("button", { name: "Done" }).click();
    await expect(app.page.getByTestId("ai-connector")).toContainText("1 list(s)");
  });

  test("an assistant no longer reaches a list deleted in the app", async ({ app }) => {
    await app.waitForRealtimeSync();
    await app.createList("Old list");
    await app.waitForRealtimeSync();

    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Settings" }).click();
    await app.page.getByRole("button", { name: "Connect an AI assistant" }).click();
    await app.page.getByRole("button", { name: "Add", exact: true }).click();
    await app.page.getByRole("button", { name: "Create URL" }).click();
    const url = await app.page.getByLabel("Connector URL").inputValue();
    const listNames = async () => listsOf((await callTool(url, "list_lists")).result).map((entry) => entry.name);
    expect(await listNames()).toContain("Old list");

    // Reload to close the dialogs; the device keeps its lists.
    await app.goto();
    await app.openDrawer();
    await app.drawer.getByRole("button", { name: "Delete: Old list" }).click();
    await app.drawer.getByRole("button", { name: "Confirm delete: Old list" }).click();

    await expect.poll(listNames).not.toContain("Old list");
    expect(await listNames()).toContain("Shopping list");
  });
});
