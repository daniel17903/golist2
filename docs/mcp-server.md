# MCP server (AI assistant connections)

The backend serves a remote [MCP](https://modelcontextprotocol.io) server, so Claude, ChatGPT or any other
assistant that supports remote MCP servers can read and edit a user's lists. Users set it up in the app:
**Settings → AI assistants → Connect an AI assistant**.

## How it fits together

- **Connector** (`mcp_connectors`, migration `006_add_mcp_connectors.sql`): one per assistant connection. It
  belongs to the device that created it (the *owner*), has a user-given label, and gets **its own device id**.
- **URL = credential**: `https://go-list.app/api/v1/mcp/{key}`. The key is 256 random bits (base64url); only its
  SHA-256 hash is stored, so the app shows the URL once (after creating it or "New URL"). Assistants add it as a
  custom connector without authentication. The key is redacted from request logs (`lib/redact-url.ts`).
- **Access** (`ListRepository.hasListAccess`): the connector's device id may use a list when it created the list
  or redeemed one of its share tokens, **or** when the owner may use the list (created/redeemed), still shows it in
  the app (`device_visible_lists`) and the connector includes it (`include_all_lists`, or a row in
  `mcp_connector_lists`). The rule is checked on every
  request, so lists the owner adds later, a changed selection and a deleted connector apply immediately. A
  connector can only delete lists it created itself.
- **Lists the owner deleted**: deleting a list in the app is local to the device, so the backend would still count
  it as the owner's list. The app reports the ids of the lists it shows (`PUT /v1/device/lists`,
  `apps/web/src/hooks/useReportDeviceLists.ts`) after loading, on every change and after reconnecting, and the
  connector dialog reports them before saving; connectors only reach reported lists.
- The tools never redeem a share token for the connector itself, except `join_list`: `share_list` would otherwise
  give it direct access that outlives a narrowed selection. Lists the assistant creates or joins stay reachable for
  the connector until it is deleted.
- **CORS**: `/v1/mcp/*` accepts any origin (browser-based MCP clients such as the MCP Inspector); the key in the
  path is the credential and no cookies are involved. The REST API keeps its origin allowlist.
- Tool results list the items whose write lost last-write-wins against a concurrent change (`notApplied`).
- **Writes reach the apps live**: the tools write through the repository and push the stored versions to the
  WebSocket subscribers of the list (`sync/list-broadcaster.ts`, shared with the sync route), like a device's
  `item_patch` would.
- Lists the assistant creates (`create_list`) or joins (`join_list`) appear in the app only after the user opens
  the share link the tool returns (the app only shows lists stored on the device).

## Code

| What | Where |
| --- | --- |
| HTTP glue (`createMcpHandler` from `@modelcontextprotocol/server`, stateless; serves the 2026-07-28 spec and the 2025 stateless fallback) | `apps/backend/src/routes/mcp.ts` |
| Tools + server instructions | `apps/backend/src/mcp/tools.ts` |
| Connector management API (`/v1/connectors`, `X-Device-Id` = owner) | `apps/backend/src/routes/connectors.ts` |
| Key generation / hashing | `apps/backend/src/mcp/connector-key.ts` |
| App UI | `apps/web/src/components/AiConnectorsModal.tsx` (opened from `SettingsModal`) |
| Tests | `apps/backend/src/mcp.test.ts` (both repositories), `apps/web/e2e/ai-connectors.spec.ts` |

## Tools

`list_lists`, `get_list`, `add_items`, `update_item`, `complete_items`, `delete_items`, `rename_list`,
`create_list`, `share_list`, `join_list`. They mirror the app's rules: categories and icons come from the shared
item mapping (language detected from the list), an item that is already open on a shopping list is not added
twice, due dates are Europe/Berlin calendar days (`YYYY-MM-DD`, stored as Berlin midnight), and completing a
recurring todo creates the next occurrence with the same deterministic id the app uses
(`packages/shared/src/domain/recurrence.ts`).

## Configuration

- `PUBLIC_APP_URL` (backend env, default `https://go-list.app`): share links returned by the tools point here.
