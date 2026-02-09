# Agent notes for GoList PWA

## Project snapshot
- **Stack**: React + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vite PWA plugin.
- **Entry points**: `index.html`, `src/main.tsx`, `src/App.tsx`.
- **State + storage**: `src/state/useStore.ts` (Zustand) + `src/storage/db.ts` (Dexie).
- **Domain logic**: `src/domain/` (types, categories, sorting).
- **UI composition**: `src/components/` (shared UI building blocks) + `src/hooks/` (UI state/behavior).
- **Styling**: `src/styles.css`.

## Quickstart
- `npm install`
- `npm run dev` (Vite dev server, default http://localhost:5173)

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
- Run `npm run test` for changes to `src/domain/`, `src/state/`, or `src/storage/`.
- Run `npm run build` for any changes that touch PWA assets or build config.

## PWA assets
- `public/favicon.svg`.
- PWA manifest configured in `vite.config.ts`.

## Storage/migrations
- Dexie schema lives in `src/storage/db.ts`. Keep migrations backward-compatible.

## Common pitfalls
- The PWA service worker can cache aggressively; use hard refresh or clear site data
  when debugging PWA changes.
