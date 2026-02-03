# Agent notes for GoList PWA

## Project snapshot
- **Stack**: React + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vite PWA plugin.
- **Entry points**: `index.html`, `src/main.tsx`, `src/App.tsx`.
- **State + storage**: `src/state/useStore.ts` (Zustand) + `src/storage/db.ts` (Dexie).
- **Domain logic**: `src/domain/` (types, categories, sorting).
- **Styling**: `src/styles.css`.

## Key behaviors
- **Multi-list** support with a list selector and inline rename.
- **Item sorting** by grocery category order, fallback to created order.
- **Item suggestions** are **list-specific**, ranked by frequency then recency.

## Development commands
- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

> Note: In this environment, `npm install` may fail with a registry 403. If so, rely on CI once registry access is configured.

## CI/CD
- GitHub Actions workflow validates `lint`, `typecheck`, and `build` on PRs.
- Deploy workflow builds and deploys to Vercel on `main`.

## PWA assets
- `public/favicon.svg`.
- PWA manifest configured in `vite.config.ts`.
