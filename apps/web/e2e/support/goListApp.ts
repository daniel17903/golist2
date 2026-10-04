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
  private backendReachable = true;
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

  async createList(name: string) {
    await this.openDrawer();
    await this.drawer.getByRole("button", { name: "Create new list" }).click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create new list" })).toBeVisible();
    await dialog.getByRole("textbox", { name: "Name" }).fill(name);
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

  async longPress(name: string) {
    const card = this.itemCard(name);
    await card.hover();
    await this.page.mouse.down();
    await this.page.waitForTimeout(800);
    await this.page.mouse.up();
  }

  undoToast(text: string | RegExp): Locator {
    return this.page.locator(".undo-toast", { hasText: text });
  }
}

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
