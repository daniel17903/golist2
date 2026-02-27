# Device-based list sharing plan

This document defines an implementation plan for list sharing using a dedicated backend service and Postgres.  
The API contract is maintained in `apps/api-spec/openapi.yaml` (and related files in `apps/api-spec/`).

---

## Goals

- Keep the current no-account experience (device-based identity only).
- Enable secure, link-based sharing of lists across devices.
- Preserve existing item ordering and suggestion behavior in the web app.
- Provide a production-ready backend setup that runs locally and in deployment with Docker.
- Keep this plan and `AGENTS.md` aligned with implementation as the project evolves.

## Architecture

### Services
- **API service**: Fastify + TypeScript backend in `apps/backend`.
- **Database**: Postgres for persistent shared list storage.
- **Local orchestration**: Docker Compose to run API + Postgres together.

### Identity and access
- Each client keeps a generated `deviceId` UUID for auditing and server-side token redemption tracking.
- Share links use random UUID share tokens (token IDs).
- Protected list/item API calls use only `X-Device-Id`; server-side access control is based on list ownership or redeemed-token access records.
- If device identity is needed for an endpoint, require `X-Device-Id` header and do not accept `deviceId` in query parameters.

### Data model direction
- Store each shared list as a canonical document with metadata and items.
- Field naming is aligned across API/backend/frontend: `listId`, `quantityOrUnit`, `category`, `deleted`, `createdAt`, and `updatedAt` are the canonical item/list field names; Postgres uses snake_case column equivalents (`list_id`, `quantity_or_unit`, `created_at`, `updated_at`).
- Use item tombstones (`deleted: true`) instead of hard deletes.
- Keep canonical timestamps with backend-assigned `createdAt`; persist client-provided `updatedAt` for item updates to support deterministic sync ordering.
- **Do not include a `shareTokens` field in the list document.** Token management is handled by backend tables/relations.
- API responses should not expose device IDs (including creator device IDs and redemption device lists).

---

## Backend implementation plan (refined)

### Phase 0 — Scaffolding and DX
1. Create backend project structure in `apps/backend`:
   - Fastify server bootstrap
   - TypeScript build config
   - environment config + validation
   - health endpoint (`/health`)
2. Add lint/typecheck/test scripts for backend workspace.
3. Add Dockerfile for backend (multi-stage, production target).
4. **GitHub Actions update**: create a backend bootstrap workflow job that runs backend lint + typecheck on PRs touching `apps/backend/**`.

### Phase 1 — Database and migrations ✅ Implemented
1. Initial Postgres schema is implemented in `apps/backend/src/db/migrations/001_init.sql` with tables for:
   - `shared_lists`
   - `list_items` (tombstone-friendly via `deleted` + `deleted_at`)
   - `share_tokens`
   - `migration_history`
2. Migration tooling is implemented with `apps/backend/src/db/migrate.ts` and exposed via `npm run db:migrate -w apps/backend`.
3. Seed utilities are implemented with `apps/backend/src/db/seed.ts` and exposed via `npm run db:seed -w apps/backend`.
4. Transaction helpers are implemented in `apps/backend/src/db/client.ts` via `withTransaction(...)` for atomic writes.
5. **GitHub Actions update**: `.github/workflows/backend-bootstrap.yml` now runs `db:migrate` against an ephemeral Postgres service.

### Phase 2 — API v1 implementation ✅ Implemented
1. API v1 endpoints from `apps/api-spec/openapi.yaml` are implemented in `apps/backend/src/server.ts`.
2. Middleware/hook behavior is implemented for:
   - bearer token auth
   - request/response logging
   - error normalization
3. Implement list lifecycle:
   - create/update shared list via `PUT /v1/lists/{listId}` (client-generated list IDs)
   - fetch list state via list id
   - add/update/tombstone items
4. Implement share token lifecycle:
   - create lists without auto-generating share tokens
   - generate token only from explicit `POST /v1/lists/{listId}/share-tokens` calls (for creator or redeemed devices with list access)
   - redeem token
   - track redemptions/devices
5. **GitHub Actions update**: backend bootstrap workflow now runs backend tests (including API contract baseline tests in `apps/backend/src/server.contract.test.ts`).

### Phase 3 — Sync semantics and conflict safety ✅ Implemented
1. Merge rules are implemented as deterministic last-write-wins in `apps/backend/src/routes/lists.ts`:
   - writes with newer `updatedAt` win
   - equal `updatedAt` conflicts are resolved by a stable tie-break value derived from item content
2. Write paths are guarded with transactional row locking (`SELECT ... FOR UPDATE`) before mutating list/item state.
3. Incremental sync support is implemented via `GET /v1/lists/{listId}/items?updatedAfter=...` with deterministic ordering by `updated_at` then `id`.
4. Creation is idempotent with client-generated IDs: lists use `PUT /v1/lists/{listId}` and items use `PUT /v1/lists/{listId}/items/{itemId}`.
5. Existing-list `PUT /v1/lists/{listId}` updates are access-controlled: only devices with list access (list creator or devices that redeemed the share token) may update an existing list.
6. Protected list routes enforce creator-or-redeemed access using `X-Device-Id`: calls are allowed for the list creator or for devices that redeemed at least one valid token for that list.
7. Backend data access follows a repository pattern: routes/auth logic call repository interfaces, and SQL access is centralized inside `apps/backend/src/repositories/postgres-list-repository.ts`.

### Phase 4 — Web app integration ✅ Implemented
1. Sharing API client is implemented in `apps/web/src/sharing/apiClient.ts` for list upsert, explicit share-token creation, token redemption, list fetch, item upsert, and token extraction from links.
2. UI flows are implemented in `apps/web`:
   - share active list (calls share-token creation route on button click and reveals tokenized link)
   - join list by share link/token via header action
3. Sync triggers are wired in web state/hooks using a single long-lived WebSocket connection to `/v1/ws` (protocol reference: `docs/websocket-sync-protocol.md`):
   - app-load socket bootstrap after device metadata is available
   - active-list scoped subscribe/unsubscribe (only one list synced at a time)
   - digest/hash reconciliation (`list_digest` + `hash_diff`) before targeted `item_patch` exchange
   - optimistic local updates queued and flushed through websocket `item_patch` messages
4. Frontend keeps bounded reconnect logic (exponential backoff + jitter, max retries) and re-runs digest/hash reconciliation after reconnect.
5. Frontend does not persist share tokens to local storage/IndexedDB; share tokens are kept in-memory only for the active session.
6. Local-first behavior is preserved when offline by keeping local mutations authoritative and treating sync errors as non-fatal.
   - Frontend sync flow details are documented in `docs/frontend-sharing-sync.md`.
7. **GitHub Actions update**: web CI continues to validate web lint/typecheck/test/build, while backend integration behavior remains covered by backend test suites/workflows.

### Phase 5 — Quality, observability, and hardening
1. Add integration tests with ephemeral Postgres.
2. Add structured logs + request IDs.
3. Add rate limiting strategy per `deviceId`/IP.
4. Add backup/restore runbook for Postgres data.
5. Add deployment docs for VPS/container platform.
6. **GitHub Actions update**: add release-gate workflow requiring backend test/build, contract tests, and smoke tests before deploy.

### Phase 6 — Documentation governance (ongoing)
1. Keep `docs/sharing-plan.md` current whenever implementation sequencing or architecture decisions change.
2. Keep `AGENTS.md` current whenever workflows, commands, repository structure, or testing expectations change.
3. Treat documentation updates as part of the definition of done for backend-sharing related PRs.
4. **GitHub Actions update**: add a docs guard job that fails if backend-sharing PRs do not update docs when required (using path + label or PR checklist validation).

---

## Docker and Docker Compose plan

### Backend Dockerfile
- Use Node LTS base image.
- Multi-stage build:
  - install deps
  - build TypeScript
  - copy minimal runtime artifacts
- Run as non-root user in production image.

### Compose setup (local)
`apps/backend/docker-compose.yml` is implemented with:
- `postgres` service
  - pinned image `postgres:17.6-alpine3.22`
  - persistent named volume `golist-postgres-data`
  - healthcheck using `pg_isready`
- `backend` service
  - build from `apps/backend/Dockerfile`
  - depends_on postgres health
  - explicit environment variables including `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, and optional `PGSSLMODE` (with optional `NEON_`-prefixed fallbacks)
  - exposed API port `3000`

### Local workflow
1. `docker compose -f apps/backend/docker-compose.yml up --build`
2. Run migrations automatically on backend startup or via one-off migration command.
3. Access API docs/spec from `apps/api-spec` during development.

### Production workflow
- Build immutable backend image tagged by commit SHA.
- Inject production secrets via environment variables or secret manager.
- Run Postgres as managed service when possible; keep Compose profile for self-hosted VPS.
- For Vercel deployments of `apps/backend`, route all paths through `apps/backend/api/index.ts` (rewrite `/(.*)` -> `/api/index`) so Fastify handles requests instead of static/redirect responses.
- In Vercel backend project settings, keep the root at `apps/backend` and output directory aligned to `dist` (not `apps/backend/dist`) so the Node entrypoint can be discovered after TypeScript build.

---

## Milestones and acceptance criteria

### Milestone A: Backend foundation complete
- Backend container starts successfully.
- Postgres connectivity verified.
- Health endpoint returns 200.
- CI runs backend lint/typecheck on relevant PRs.

### Milestone B: API contract compliance
- Implemented endpoints match `apps/api-spec/openapi.yaml`.
- Contract tests pass against running backend container.
- CI enforces contract tests for API changes.

### Milestone C: End-to-end sharing flow
- Device A can create and share a list.
- Device B can join via link and sync changes both directions.
- Deleted items remain as tombstones and sync correctly.
- CI runs integration tests for cross-device sync scenarios.

### Milestone D: Production readiness
- Logs, rate limiting, migrations, and backup docs are in place.
- CI validates backend lint/typecheck/test/build and web integration checks.
- Docs governance checks ensure `docs/sharing-plan.md` and `AGENTS.md` stay current.

---

## Notes

- API details are intentionally not duplicated here; source of truth is `apps/api-spec/`.
- If API behavior changes, update the OpenAPI spec first, then implement backend and web changes.
- If implementation process or repository workflow changes, update both this document and `AGENTS.md` in the same PR where feasible.
