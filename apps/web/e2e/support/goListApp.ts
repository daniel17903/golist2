import { expect, type Locator, type Page, type WebSocket, type WebSocketRoute } from "@playwright/test";
import { backendUrl } from "./backendApi";

type ObservedSocket = {
  url: string;
  sent: string[];
  received: string[];
  closed: boolean;
};

export type InitOptions = {
  // The language-switch suggestion pops up as soon as two unrecognised items
  // exist, which would block unrelated tests. Tests that cover the
  // suggestion itself opt out of the suppression.
  suppressLanguageSuggestion?: boolean;
};

const decodeFrame = (payload: string | Buffer) =>
  typeof payload === "string" ? payload : payload.toString("utf8");

// Page object for one GoList "device" (a browser context with its own
// IndexedDB, localStorage and device id).
export class GoListApp {
  // Only the app's sync sockets (/v1/ws), not Vite's HMR socket.
  readonly sockets: ObservedSocket[] = [];
  readonly pageErrors: Error[] = [];
  // Browser console output, attached to failing tests.
  readonly consoleMessages: string[] = [];
  private backendReachable = true;
  // Added to every REST call and every WebSocket frame (both directions).
  private backendLatencyMs = 0;
  private readonly openRoutes = new Set<WebSocketRoute>();

  constructor(readonly page: Page) {
    page.on("websocket", (socket: WebSocket) => {
      if (!socket.url().includes("/v1/ws")) {
        return;
      }
      const observed: ObservedSocket = { url: socket.url(), sent: [], received: [], closed: false };
      this.sockets.push(observed);
      socket.on("framesent", (frame) => observed.sent.push(decodeFrame(frame.payload)));
      socket.on("framereceived", (frame) => observed.received.push(decodeFrame(frame.payload)));
      socket.on("close", () => {
        observed.closed = true;
      });
    });
    page.on("pageerror", (error) => this.pageErrors.push(error));
    page.on("console", (message) => {
      this.consoleMessages.push(`[${new Date().toISOString()}] ${message.type()}: ${message.text()}`);
    });
  }

  static async install(page: Page, options: InitOptions = {}) {
    const app = new GoListApp(page);
    await app.installBackendSwitch();
    await page.addInitScript(
      ({ suppressLanguageSuggestion }) => {
        // Record every clipboard write so share-link tests can read it back
        // without depending on real clipboard permissions.
        const copied: string[] = [];
        Reflect.set(window, "__golistCopied", copied);
        Object.defineProperty(window.navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              copied.push(text);
            },
            readText: async () => copied[copied.length - 1] ?? "",
          },
        });
        // Force the clipboard fallback instead of the OS share sheet.
        Object.defineProperty(window.navigator, "share", { configurable: true, value: undefined });

        if (suppressLanguageSuggestion && !localStorage.getItem("golist.languageSuggestionHandled")) {
          localStorage.setItem(
            "golist.languageSuggestionHandled",
            JSON.stringify({ suggestedLocale: "en", handledAt: Date.now(), action: "dismissed" }),
          );
        }
      },
      {
        suppressLanguageSuggestion: options.suppressLanguageSuggestion ?? true,
      },
    );
    return app;
  }

  // Every backend call (REST + WebSocket) is routed through Playwright so a
  // test can cut this device off from the backend and restore it later —
  // without touching the other devices or the backend itself.
  private async installBackendSwitch() {
    await this.page.route(`${backendUrl}/**`, async (route) => {
      await this.latency();
      if (this.backendReachable) {
        await route.fallback();
      } else {
        await route.abort("internetdisconnected");
      }
    });
    await this.page.routeWebSocket(/\/v1\/ws/, (ws) => {
      if (!this.backendReachable) {
        void ws.close({ code: 4000, reason: "backend unreachable" });
        return;
      }
      const server = ws.connectToServer();
      this.openRoutes.add(ws);
      // Forward frames explicitly (in order, per direction) so a test can
      // slow this device's connection down with setBackendLatency().
      let toServer = Promise.resolve();
      let toPage = Promise.resolve();
      ws.onMessage((message) => {
        toServer = toServer.then(() => this.latency()).then(() => server.send(message)).catch(() => undefined);
      });
      server.onMessage((message) => {
        toPage = toPage.then(() => this.latency()).then(() => ws.send(message)).catch(() => undefined);
      });
      // Registering onClose disables Playwright's automatic close forwarding,
      // so forward closes in both directions explicitly.
      ws.onClose((code, reason) => {
        this.openRoutes.delete(ws);
        void server.close({ code, reason });
      });
      server.onClose((code, reason) => {
        this.openRoutes.delete(ws);
        void ws.close({ code, reason });
      });
    });
  }

  private async latency() {
    if (this.backendLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.backendLatencyMs));
    }
  }

  // Simulates a slow network for this device only (REST and WebSocket).
  setBackendLatency(ms: number) {
    this.backendLatencyMs = ms;
  }

  async disconnectBackend() {
    this.backendReachable = false;
    await Promise.all([...this.openRoutes].map((ws) => ws.close({ code: 1001 })));
    this.openRoutes.clear();
    await expect(this.page.getByRole("button", { name: "Backend status: offline" })).toBeVisible();
  }

  async reconnectBackend() {
    this.backendReachable = true;
    // Same signal the browser sends when connectivity returns; the sync
    // manager reconnects immediately instead of waiting for its backoff.
    await this.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(this.page.getByRole("button", { name: "Backend status: offline" })).toBeHidden();
  }

  // ---------- navigation / readiness ----------

  async goto(path = "/") {
    await this.page.goto(path);
    await expect(this.listTitle).not.toHaveText("");
  }

  async reload() {
    await this.page.reload();
    await expect(this.listTitle).not.toHaveText("");
  }

  async deviceId(): Promise<string> {
    const id = await this.page.evaluate(() => localStorage.getItem("golist.deviceId"));
    if (!id) {
      throw new Error("device id not yet created");
    }
    return id;
  }

  async activeListId(): Promise<string> {
    await expect
      .poll(() => this.page.evaluate(() => localStorage.getItem("golist.selectedListId")))
      .not.toBeNull();
    const id = await this.page.evaluate(() => localStorage.getItem("golist.selectedListId"));
    return id!;
  }

  private subscribedListIds(): string[] {
    const ids: string[] = [];
    for (const socket of this.sockets) {
      if (socket.closed) {
        continue;
      }
      for (const frame of socket.received) {
        const parsed: unknown = JSON.parse(frame);
        if (typeof parsed === "object" && parsed !== null && Reflect.get(parsed, "type") === "subscribed") {
          ids.push(String(Reflect.get(parsed, "listId")));
        }
      }
    }
    return ids;
  }

  // Resolves once an open WebSocket has completed hello + subscribe for the
  // currently active list.
  async waitForRealtimeSync(listId?: string) {
    const target = listId ?? (await this.activeListId());
    await expect
      .poll(() => this.subscribedListIds().includes(target), {
        timeout: 15_000,
        message: `expected websocket subscription for list ${target}`,
      })
      .toBe(true);
  }

  framesSent(type: string): unknown[] {
    return this.sockets
      .flatMap((socket) => socket.sent)
      .map((frame): unknown => JSON.parse(frame))
      .filter((frame) => typeof frame === "object" && frame !== null && Reflect.get(frame, "type") === type);
  }

  describeSockets(): string {
    return this.sockets
      .map((socket, index) =>
        [
          `#${index} ${socket.url}${socket.closed ? " (closed)" : ""}`,
          ...socket.sent.map((frame) => `  -> ${frame}`),
          ...socket.received.map((frame) => `  <- ${frame}`),
        ].join("\n"),
      )
      .join("\n");
  }

  async copiedTexts(): Promise<string[]> {
    return this.page.evaluate(() => {
      const copied: unknown = Reflect.get(window, "__golistCopied");
      return Array.isArray(copied) ? copied.map(String) : [];
    });
  }

  // ---------- header / list ----------

  get listTitle(): Locator {
    return this.page.getByRole("button", { name: "Edit list name" });
  }

  async renameActiveList(name: string) {
    await this.listTitle.click();
    const input = this.page.getByRole("textbox", { name: "List name" });
    await input.fill(name);
    await input.press("Enter");
    await expect(this.listTitle).toHaveText(name);
  }

  // ---------- drawer ----------

  get drawer(): Locator {
    return this.page.locator("aside.drawer");
  }

  async openDrawer() {
    await this.page.getByRole("button", { name: "Open list menu" }).click();
    await expect(this.page.locator(".drawer.drawer--open")).toBeVisible();
  }

  drawerListNames(): Locator {
    return this.drawer.locator(".drawer__item-label");
  }

  async createList(name: string, options: { listType?: "shopping" | "todo" } = {}) {
    await this.openDrawer();
    await this.drawer.getByRole("button", { name: "Create new list" }).click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create new list" })).toBeVisible();
    await dialog.getByRole("textbox", { name: "Name" }).fill(name);
    if (options.listType === "todo") {
      await dialog.getByRole("radio", { name: "Todo list" }).click();
    }
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(this.listTitle).toHaveText(name);
  }

  async selectList(name: string) {
    await this.openDrawer();
    await this.drawer.locator(".drawer__item-button", { hasText: name }).click();
    await expect(this.listTitle).toHaveText(name);
  }

  async joinList(tokenOrLink: string) {
    await this.openDrawer();
    await this.drawer.getByRole("button", { name: "Join list" }).click();
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Share token or link" }).fill(tokenOrLink);
    await dialog.getByRole("button", { name: "Join" }).click();
  }

  // ---------- items ----------

  get itemCards(): Locator {
    return this.page.locator("main.list-grid .item-card");
  }

  itemCard(name: string): Locator {
    return this.page.locator("main.list-grid .item-card").filter({
      has: this.page.locator(".item-name", { hasText: new RegExp(`^${escapeRegExp(name)}$`) }),
    });
  }

  async itemNames(): Promise<string[]> {
    return this.page.locator("main.list-grid .item-card .item-name").allTextContents();
  }

  get addItemInput(): Locator {
    return this.page.getByRole("textbox", { name: "Item name" });
  }

  async openAddDialog() {
    await this.page.getByRole("button", { name: "Add item" }).click();
    await expect(this.addItemInput).toBeVisible();
  }

  async addItem(rawInput: string) {
    await this.openAddDialog();
    await this.addItemInput.fill(rawInput);
    await this.addItemInput.press("Enter");
    await expect(this.addItemInput).toBeHidden();
  }

  // Short press = check the item off (it animates out, then disappears).
  async checkOff(name: string) {
    const card = this.itemCard(name);
    await card.click();
    await expect(card).toHaveCount(0);
  }

  // Long-press editor: change name and/or quantity of an item.
  async editItem(name: string, changes: { name?: string; quantity?: string }) {
    await this.longPress(name);
    const dialog = this.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit item" })).toBeVisible();
    if (changes.name !== undefined) {
      await dialog.getByLabel("Name").fill(changes.name);
    }
    if (changes.quantity !== undefined) {
      await dialog.getByLabel("Quantity").fill(changes.quantity);
    }
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
  }

  async longPress(name: string) {
    const card = this.itemCard(name);
    await card.hover();
    await this.page.mouse.down();
    await this.page.waitForTimeout(800);
    await this.page.mouse.up();
  }

  // Switches the active list's type from the header's inline edit mode.
  async setActiveListType(listType: "shopping" | "todo") {
    await this.listTitle.click();
    const option = this.page.getByRole("radio", { name: listType === "todo" ? "Todo list" : "Shopping list" });
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true");
    await this.page.getByRole("textbox", { name: "List name" }).press("Escape");
    await expect(this.listTitle).toBeVisible();
  }

  // ---------- todos (todo-type lists) ----------

  get todoRows(): Locator {
    return this.page.locator("main.todo-list .todo-item");
  }

  todoRow(title: string): Locator {
    return this.todoRows.filter({
      has: this.page.locator(".todo-item__title", { hasText: new RegExp(`^${escapeRegExp(title)}$`) }),
    });
  }

  async todoTitles(): Promise<string[]> {
    return this.page.locator("main.todo-list .todo-item__title").allTextContents();
  }

  private async fillTodoForm(fields: TodoFields) {
    const dialog = this.page.getByRole("dialog");
    if (fields.title !== undefined) {
      await dialog.getByLabel("Title").fill(fields.title);
    }
    if (fields.dueDate !== undefined) {
      await dialog.getByLabel("Due date").fill(fields.dueDate);
    }
    if (fields.repeatEveryWeek) {
      await dialog.getByText("Repeat").click();
    }
    if (fields.assignedTo !== undefined) {
      await dialog.getByLabel("Assigned to").fill(fields.assignedTo);
    }
    if (fields.description !== undefined) {
      await dialog.getByLabel("Description").fill(fields.description);
    }
    if (fields.points !== undefined) {
      await dialog.getByLabel("Points").fill(String(fields.points));
    }
  }

  async addTodo(fields: TodoFields & { title: string }) {
    await this.page.getByRole("button", { name: "Add item" }).click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add todo" })).toBeVisible();
    await this.fillTodoForm(fields);
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(this.todoRow(fields.title)).toHaveCount(1);
  }

  async openTodo(title: string) {
    const row = this.todoRow(title);
    await row.hover();
    await this.page.mouse.down();
    await this.page.waitForTimeout(800);
    await this.page.mouse.up();
    await expect(this.page.getByRole("dialog").getByRole("heading", { name: "Edit todo" })).toBeVisible();
  }

  async editTodo(title: string, changes: TodoFields) {
    await this.openTodo(title);
    const dialog = this.page.getByRole("dialog");
    await this.fillTodoForm(changes);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
  }

  // Short press = complete the todo (it slides out, then disappears).
  async completeTodo(title: string) {
    const row = this.todoRow(title);
    await row.click();
    await expect(row).toHaveCount(0);
  }

  undoToast(text: string | RegExp): Locator {
    return this.page.locator(".undo-toast", { hasText: text });
  }
}

export type TodoFields = {
  title?: string;
  /** `yyyy-mm-dd` */
  dueDate?: string;
  /** Turns on the default recurrence (every week, from the due date). */
  repeatEveryWeek?: boolean;
  assignedTo?: string;
  description?: string;
  points?: number;
};

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
