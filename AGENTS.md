# Agent notes for GoList PWA

## Repository layout (monorepo)
- `apps/web/` contains the existing React + TypeScript + Vite PWA.
- `apps/backend/` contains a Fastify + TypeScript backend scaffold with env validation, a `/health` endpoint, and local Docker Compose config (`apps/backend/docker-compose.yml`).
- `packages/shared/` contains shared domain code that can be reused by web and backend (currently shared types).
- Root `package.json` is a workspace manifest; run workspace commands with `-w apps/web` or `-w apps/backend`, or use root aliases like `npm run dev:web` and `npm run dev:backend`.

## Project snapshot (web app)
- **Stack**: React + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vite PWA plugin.
- **Entry points**: `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`.
- **State + storage**: `apps/web/src/state/useStore.ts` (Zustand) + `apps/web/src/storage/db.ts` (Dexie).
- **Domain logic**: `apps/web/src/domain/` (categories, sorting) plus shared types in `packages/shared/src/domain/types.ts`.
- **UI composition**: `apps/web/src/components/` (shared UI building blocks) + `apps/web/src/hooks/` (UI state/behavior).
- **Styling**: `apps/web/src/styles.css`.

## Quickstart
- `npm install`
- `npm run dev:web` (runs web app dev server from root, default http://localhost:5173)
- Direct web command equivalent: `npm run dev -w apps/web`

## Key behaviors
- Backend sharing auth: protected sharing endpoints require an `X-Device-Id` header and a prior token redemption record for that device/token pair.
- **Multi-list** support with a list selector and inline rename.
- **Item sorting** by grocery category order, fallback to created order.
- **Item suggestions** are **list-specific**, ranked by frequency then recency.

## UX rules (high-level)
- Keep list rename inline with minimal friction (no full-screen modals).
- Preserve item ordering behavior unless the change explicitly targets sorting.
- Suggestions must remain list-scoped and prioritize frequency then recency.

## Development commands
- `npm install`
- `npm run dev:web`
- `npm run lint -w apps/web`
- `npm run typecheck -w apps/web`
- `npm run build -w apps/web`
- `npm run test -w apps/web`
- `npm run db:migrate -w apps/backend`
- `npm run db:seed -w apps/backend`

## CI/CD
- GitHub Actions `ci.yml` workflow validates `lint`, `typecheck`, `test` and `build` for the web workspace on PRs.
- GitHub Actions `backend-bootstrap.yml` runs backend `lint` + `typecheck` + `db:migrate` + `test` (against ephemeral Postgres) on PRs that touch `apps/backend/**`.
- Deploy workflow builds on `main`.

## Testing expectations
- Always run `npm run typecheck -w apps/web` for web changes and `npm run typecheck -w apps/backend` for backend changes before commit.
- Always run `npm run lint -w apps/web` for web changes and `npm run lint -w apps/backend` for backend changes before commit.
- Run `npm run test -w apps/web` for changes to `apps/web/src/domain/`, `apps/web/src/state/`, or `apps/web/src/storage/`.
- Run `npm run test -w apps/backend` for backend endpoint/config changes.
- Run `npm run db:migrate -w apps/backend` for backend schema/migration changes.
- Run `npm run build -w apps/web` for changes that touch PWA assets or build config; run `npm run build -w apps/backend` when backend runtime/build config changes.

## PWA assets
- `apps/web/public/favicon.svg`.
- PWA manifest configured in `apps/web/vite.config.ts`.

## Storage/migrations
- Dexie schema lives in `apps/web/src/storage/db.ts`. Keep migrations backward-compatible.

## Common pitfalls
- The PWA service worker can cache aggressively; use hard refresh or clear site data
  when debugging PWA changes.

- Playwright E2E in fresh containers may require both browser binaries and OS deps.
  Run `npx playwright install chromium` and `npx playwright install-deps chromium`
  before running `RUN_PLAYWRIGHT_E2E=1 npm run test -w apps/web -- src/e2e.backend-frontend.playwright.test.ts`.
  For E2E-related changes, do this setup and run the Playwright E2E command before committing.
  Do **not** treat a skipped run as sufficient validation: for E2E-related changes you must execute with `RUN_PLAYWRIGHT_E2E=1` so tests actually run.


## Documentation maintenance
- Keep `docs/sharing-plan.md` up to date when backend sharing architecture, sequencing, or CI expectations change.
- Keep this `AGENTS.md` file up to date when repo layout, commands, workflows, or testing expectations change.
- For backend-sharing related PRs, include doc updates as part of the definition of done when behavior or process changes.

## Tooling note
- Use the Context7 MCP server for quick library/API references when needed.
- When introducing new tools or dependencies, always use the latest stable version.
- Never use dependency tags like `@latest` in scripts, workflows, or install commands; always pin an explicit version.
- For backend ID creation, always generate IDs with random UUIDs (for example `crypto.randomUUID()`).
