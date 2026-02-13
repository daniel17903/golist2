# Agent notes for GoList PWA

## Repository layout (monorepo)
- `apps/web/` contains the existing React + TypeScript + Vite PWA.
- `apps/backend/` is scaffolded as an empty backend folder (no implementation files yet).
- `packages/shared/` is scaffolded for shared domain code.
- Root `package.json` is a workspace manifest with scripts that proxy to `apps/web`.

## Project snapshot (web app)
- **Stack**: React + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vite PWA plugin.
- **Entry points**: `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`.
- **State + storage**: `apps/web/src/state/useStore.ts` (Zustand) + `apps/web/src/storage/db.ts` (Dexie).
- **Domain logic**: `apps/web/src/domain/` (types, categories, sorting).
- **UI composition**: `apps/web/src/components/` (shared UI building blocks) + `apps/web/src/hooks/` (UI state/behavior).
- **Styling**: `apps/web/src/styles.css`.

## Quickstart
- `npm install`
- `npm run dev` (runs web app dev server via workspace script, default http://localhost:5173)
- Direct web command equivalent: `npm run dev -w apps/web`

## Key behaviors
- **Multi-list** support with a list selector and inline rename.
- **Item sorting** by grocery category order, fallback to created order.
- **Item suggestions** are **list-specific**, ranked by frequency then recency.

## UX rules (high-level)
- Keep list rename inline with minimal friction (no full-screen modals).
- Preserve item ordering behavior unless the change explicitly targets sorting.
- Suggestions must remain list-scoped and prioritize frequency then recency.

## Development commands
- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## CI/CD
- GitHub Actions workflow validates `lint`, `typecheck`, `test` and `build` on PRs.
- Deploy workflow builds on `main`.

## Testing expectations
- Run `npm run lint` and `npm run typecheck` before commit when possible.
- Run `npm run test` for changes to `apps/web/src/domain/`, `apps/web/src/state/`, or `apps/web/src/storage/`.
- Run `npm run build` for changes that touch PWA assets or build config.

## PWA assets
- `apps/web/public/favicon.svg`.
- PWA manifest configured in `apps/web/vite.config.ts`.

## Storage/migrations
- Dexie schema lives in `apps/web/src/storage/db.ts`. Keep migrations backward-compatible.

## Common pitfalls
- The PWA service worker can cache aggressively; use hard refresh or clear site data
  when debugging PWA changes.

## Tooling note
- Use the Context7 MCP server for quick library/API references when needed.
