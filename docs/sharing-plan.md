# Device-based list sharing plan

This document defines an implementation plan for list sharing using a dedicated backend service and Postgres.  
The API contract is maintained in `apps/api-spec/openapi.yaml` (and related files in `apps/api-spec/`).

---

## Goals

- Keep the current no-account experience (device-based identity only).
- Enable secure, link-based sharing of lists across devices.
- Preserve existing item ordering and suggestion behavior in the web app.
- Provide a production-ready backend setup that runs locally and in deployment with Docker.

## Architecture

### Services
- **API service**: Fastify + TypeScript backend in `apps/backend`.
- **Database**: Postgres for persistent shared list storage.
- **Local orchestration**: Docker Compose to run API + Postgres together.

### Identity and access
- Each client keeps a generated `deviceId` UUID.
- Share links include an unguessable token.
- Protected API calls use:
  - `X-Device-Id: <uuid>`
  - `Authorization: Bearer <shareToken>`

### Data model direction
- Store each shared list as a canonical document with metadata and items.
- Use item tombstones (`deleted: true`) instead of hard deletes.
- Keep canonical timestamps (`createdAt`, `updatedAt`) assigned by backend.
- **Do not include a `shareTokens` field in the list document.** Token management is handled by backend tables/relations.

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

### Phase 1 — Database and migrations
1. Define initial Postgres schema for:
   - shared lists
   - list items (or list document storage)
   - share tokens / token grants
   - device-list membership tracking
2. Add migration tooling and baseline migration.
3. Add seed utilities for local development.
4. Add transaction helpers for atomic list updates.

### Phase 2 — API v1 implementation
1. Implement endpoints defined by `apps/api-spec/openapi.yaml`.
2. Add middleware for:
   - device ID validation
   - bearer token auth
   - request/response logging
   - error normalization
3. Implement list lifecycle:
   - create shared list
   - fetch list state
   - update list name
   - add/update/tombstone items
4. Implement share token lifecycle:
   - generate token
   - redeem token
   - track redemptions/devices

### Phase 3 — Sync semantics and conflict safety
1. Define merge rules (last-write-wins by `updatedAt` with deterministic tie-break).
2. Guard writes with row/document locking and transactional updates.
3. Add incremental sync support (`updatedAfter`) per API spec.
4. Add idempotency behavior for retried writes from unstable mobile/PWA sessions.

### Phase 4 — Web app integration
1. Add API client in `apps/web` for sharing and sync endpoints.
2. Add UI flows:
   - Share list (create/reveal tokenized link)
   - Join list by link
3. Wire sync triggers:
   - initial load pull
   - foreground/background periodic sync
   - optimistic local updates with reconciliation
4. Preserve existing local-first behavior when offline.

### Phase 5 — Quality, observability, and hardening
1. Add integration tests with ephemeral Postgres.
2. Add structured logs + request IDs.
3. Add rate limiting strategy per `deviceId`/IP.
4. Add backup/restore runbook for Postgres data.
5. Add deployment docs for VPS/container platform.

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
Create `docker-compose.yml` at repo root (or backend root) with:
- `postgres` service
  - pinned postgres version
  - persistent named volume
  - healthcheck
- `backend` service
  - build from `apps/backend/Dockerfile`
  - depends_on postgres health
  - environment variables from `.env`
  - exposed API port (e.g., 3000)

### Local workflow
1. `docker compose up --build`
2. Run migrations automatically on backend startup or via one-off migration command.
3. Access API docs/spec from `apps/api-spec` during development.

### Production workflow
- Build immutable backend image tagged by commit SHA.
- Inject production secrets via environment variables or secret manager.
- Run Postgres as managed service when possible; keep Compose profile for self-hosted VPS.

---

## Milestones and acceptance criteria

### Milestone A: Backend foundation complete
- Backend container starts successfully.
- Postgres connectivity verified.
- Health endpoint returns 200.

### Milestone B: API contract compliance
- Implemented endpoints match `apps/api-spec/openapi.yaml`.
- Contract tests pass against running backend container.

### Milestone C: End-to-end sharing flow
- Device A can create and share a list.
- Device B can join via link and sync changes both directions.
- Deleted items remain as tombstones and sync correctly.

### Milestone D: Production readiness
- Logs, rate limiting, migrations, and backup docs are in place.
- CI validates backend lint/typecheck/test/build and web integration checks.

---

## Notes

- API details are intentionally not duplicated here; source of truth is `apps/api-spec/`.
- If API behavior changes, update the OpenAPI spec first, then implement backend and web changes.
