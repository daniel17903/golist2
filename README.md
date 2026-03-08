# GoList

GoList is a TypeScript monorepo for building and running a grocery-list PWA with optional backend sharing and real-time sync. The web app in [`apps/web`](./apps/web) is offline-first, storing list data locally in IndexedDB. The backend in [`apps/backend`](./apps/backend) provides list APIs, token-based sharing, and WebSocket sync. Shared contracts and sync utilities live in [`packages/shared`](./packages/shared).

Core stack: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Dexie](https://dexie.org/), [Zustand](https://zustand-demo.pmnd.rs/), [Fastify](https://fastify.dev/), [Zod](https://zod.dev/), [pg](https://node-postgres.com/), and [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa). The UI uses the `Inter` font family in [`apps/web/src/styles.css`](./apps/web/src/styles.css) ([Inter project](https://rsms.me/inter/), [Google Fonts](https://fonts.google.com/specimen/Inter)).

## Interesting implementation techniques

- **Offline-first persistence with IndexedDB** via [Dexie](https://dexie.org/) on top of [IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API), with schema/version handling in [`apps/web/src/storage/db.ts`](./apps/web/src/storage/db.ts).
- **Backend requests with hard timeouts** using [`AbortController`](https://developer.mozilla.org/docs/Web/API/AbortController) in [`apps/web/src/sharing/apiClient.ts`](./apps/web/src/sharing/apiClient.ts).
- **Real-time list reconciliation** over [WebSocket](https://developer.mozilla.org/docs/Web/API/WebSocket) using digest/hash-based sync in [`apps/web/src/sharing/socketSync.ts`](./apps/web/src/sharing/socketSync.ts) and [`apps/backend/src/routes/sync-websocket.ts`](./apps/backend/src/routes/sync-websocket.ts).
- **Installable PWA packaging** with [Web App Manifest](https://developer.mozilla.org/docs/Web/Manifest) and Workbox runtime caching configured in [`apps/web/vite.config.ts`](./apps/web/vite.config.ts).

## Project structure

```text
.
├── AGENTS.md
├── apps
│   ├── api-spec
│   ├── backend
│   │   ├── api
│   │   └── src
│   │       ├── config
│   │       ├── db
│   │       │   └── migrations
│   │       ├── plugins
│   │       ├── repositories
│   │       ├── routes
│   │       └── test
│   ├── openclaw
│   └── web
│       ├── public
│       │   └── icons
│       └── src
│           ├── components
│           ├── domain
│           ├── hooks
│           ├── i18n
│           ├── sharing
│           ├── state
│           └── storage
├── docs
├── package.json
├── packages
│   └── shared
│       └── src
│           └── domain
└── tsconfig.base.json
```

- [`apps/web/public/icons`](./apps/web/public/icons): grocery/item icon assets for the PWA UI.
- [`apps/web/src/sharing`](./apps/web/src/sharing): backend API client and WebSocket sync client.
- [`apps/backend/src/routes`](./apps/backend/src/routes): HTTP and WebSocket endpoints.
- [`apps/backend/src/db/migrations`](./apps/backend/src/db/migrations): SQL schema migrations.
- [`packages/shared/src/domain`](./packages/shared/src/domain): shared domain types, mappings, and sync helpers.
