# GoList v0.1.0

GoList is a TypeScript monorepo for a grocery-list Progressive Web App (PWA) with optional real-time backend sync. The web app in [`apps/web`](./apps/web) works offline first, stores data locally in IndexedDB, and can connect to the backend in [`apps/backend`](./apps/backend) for sharing and websocket-based synchronization. Shared domain contracts live in [`packages/shared`](./packages/shared).

## What this release includes

- Offline-first list and item management in the web app via Dexie + Zustand, implemented in [`apps/web/src/storage/db.ts`](./apps/web/src/storage/db.ts) and [`apps/web/src/state/useStore.ts`](./apps/web/src/state/useStore.ts).
- Backend list APIs, share token flow, and websocket sync routes in [`apps/backend/src/routes`](./apps/backend/src/routes).
- Typed cross-workspace domain models and sync hashing helpers in [`packages/shared/src/domain`](./packages/shared/src/domain).
- PWA packaging (manifest + runtime image caching) configured in [`apps/web/vite.config.ts`](./apps/web/vite.config.ts) and static assets under [`apps/web/public`](./apps/web/public).

## Interesting implementation techniques

- **Offline-first data model with IndexedDB** using [Dexie](https://dexie.org/) on top of [IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API), including schema versioning in [`apps/web/src/storage/db.ts`](./apps/web/src/storage/db.ts).
- **External store subscriptions in React** using [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) for i18n updates in [`apps/web/src/i18n/index.ts`](./apps/web/src/i18n/index.ts).
- **Abortable network requests** with [`AbortController`](https://developer.mozilla.org/docs/Web/API/AbortController) and timeout handling in [`apps/web/src/sharing/apiClient.ts`](./apps/web/src/sharing/apiClient.ts).
- **Real-time diff sync over WebSocket** using [WebSocket](https://developer.mozilla.org/docs/Web/API/WebSocket), list digests, and item hashes in [`apps/web/src/sharing/socketSync.ts`](./apps/web/src/sharing/socketSync.ts) and [`apps/backend/src/routes/sync-websocket.ts`](./apps/backend/src/routes/sync-websocket.ts).
- **UUID-based identity generation** via [`crypto.randomUUID()`](https://developer.mozilla.org/docs/Web/API/Crypto/randomUUID) in both client and server flows (for example [`apps/web/src/App.tsx`](./apps/web/src/App.tsx), [`apps/backend/src/auth.ts`](./apps/backend/src/auth.ts)).
- **Strict runtime validation for inbound payloads** using [Zod](https://zod.dev/) schemas in backend route/auth logic (for example [`apps/backend/src/routes/lists.ts`](./apps/backend/src/routes/lists.ts), [`apps/backend/src/auth.ts`](./apps/backend/src/auth.ts), [`apps/backend/src/config/env.ts`](./apps/backend/src/config/env.ts)).
- **Installable PWA packaging** with [vite-plugin-pwa](https://vite-pwa-org.netlify.app/), [Web App Manifest](https://developer.mozilla.org/docs/Web/Manifest), and Workbox image runtime cache rules in [`apps/web/vite.config.ts`](./apps/web/vite.config.ts).
- **Touch-centric viewport handling** using CSS [`svh` units](https://developer.mozilla.org/docs/Web/CSS/length#small_viewport_units), [`-webkit-overflow-scrolling`](https://developer.mozilla.org/docs/Web/CSS/-webkit-overflow-scrolling), and keyboard inset hooks in [`apps/web/src/styles.css`](./apps/web/src/styles.css) and [`apps/web/src/hooks`](./apps/web/src/hooks).

## Non-obvious libraries and technologies worth noticing

- [Dexie](https://dexie.org/) for ergonomic IndexedDB access and migration support.
- [Zustand](https://zustand-demo.pmnd.rs/) for low-boilerplate state management in [`apps/web/src/state`](./apps/web/src/state).
- [Vite PWA Plugin](https://github.com/vite-pwa/vite-plugin-pwa) + [Workbox](https://developer.chrome.com/docs/workbox) for service worker generation and runtime caching.
- [Fastify](https://fastify.dev/) with plugin-style composition in [`apps/backend/src/server.ts`](./apps/backend/src/server.ts).
- [@fastify/websocket](https://github.com/fastify/fastify-websocket) for typed WebSocket route integration.
- [pg](https://node-postgres.com/) with SQL migrations in [`apps/backend/src/db/migrations`](./apps/backend/src/db/migrations).
- [Vitest](https://vitest.dev/) for both frontend and backend test suites.
- [Playwright](https://playwright.dev/) for E2E coverage in the web workspace.

### Font

- Primary UI font family is `Inter` in [`apps/web/src/styles.css`](./apps/web/src/styles.css).
  - Inter project: [https://rsms.me/inter/](https://rsms.me/inter/)
  - Also available on Google Fonts: [https://fonts.google.com/specimen/Inter](https://fonts.google.com/specimen/Inter)

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

- [`apps/web/public/icons`](./apps/web/public/icons): icon pack used for item/category visuals in the PWA.
- [`apps/web/src/sharing`](./apps/web/src/sharing): backend API client and WebSocket sync client.
- [`apps/backend/src/routes`](./apps/backend/src/routes): HTTP + WebSocket endpoints.
- [`apps/backend/src/db/migrations`](./apps/backend/src/db/migrations): SQL schema evolution scripts.
- [`packages/shared/src/domain`](./packages/shared/src/domain): shared contracts, mappings, and sync utilities consumed by both apps.
