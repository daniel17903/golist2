# Agent notes for GoList PWA

## Repository layout (monorepo)
- `apps/web/` contains the existing React + TypeScript + Vite PWA.
- `apps/backend/` contains a Fastify + TypeScript backend scaffold with env validation and a `/health` endpoint.
- `packages/shared/` contains shared domain code that can be reused by web and backend (currently shared types).
- Root `package.json` is a workspace manifest with scripts that proxy to `apps/web`; backend scripts run from `apps/backend` or via `-w apps/backend`.

## Project snapshot (web app)
- **Stack**: React + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vite PWA plugin.
- **Entry points**: `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`.
- **State + storage**: `apps/web/src/state/useStore.ts` (Zustand) + `apps/web/src/storage/db.ts` (Dexie).
- **Domain logic**: `apps/web/src/domain/` (categories, sorting) plus shared types in `packages/shared/src/domain/types.ts`.
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
- GitHub Actions `ci.yml` workflow validates `lint`, `typecheck`, `test` and `build` for the web workspace on PRs.
- GitHub Actions `backend-bootstrap.yml` runs backend `lint` + `typecheck` on PRs that touch `apps/backend/**`.
- Deploy workflow builds on `main`.

## Testing expectations
- Run `npm run lint` and `npm run typecheck` before commit when possible (`-w apps/web` or `-w apps/backend` as appropriate).
- Run `npm run test` for changes to `apps/web/src/domain/`, `apps/web/src/state/`, or `apps/web/src/storage/`.
- Run `npm run test -w apps/backend` for backend endpoint/config changes.
- Run `npm run build` for changes that touch PWA assets or build config; run `npm run build -w apps/backend` when backend runtime/build config changes.

## PWA assets
- `apps/web/public/favicon.svg`.
- PWA manifest configured in `apps/web/vite.config.ts`.

## Storage/migrations
- Dexie schema lives in `apps/web/src/storage/db.ts`. Keep migrations backward-compatible.

## Common pitfalls
- The PWA service worker can cache aggressively; use hard refresh or clear site data
  when debugging PWA changes.


## Documentation maintenance
- Keep `docs/sharing-plan.md` up to date when backend sharing architecture, sequencing, or CI expectations change.
- Keep this `AGENTS.md` file up to date when repo layout, commands, workflows, or testing expectations change.
- For backend-sharing related PRs, include doc updates as part of the definition of done when behavior or process changes.

## Tooling note
- Use the Context7 MCP server for quick library/API references when needed.
- When introducing new tools or dependencies, always use the latest stable version.
- Never use dependency tags like `@latest` in scripts, workflows, or install commands; always pin an explicit version.
