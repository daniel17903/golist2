# Fly.io deployment (backend + postgres)

Fly.io does not run a full Docker Compose stack from a single `fly.toml`.
Instead, deploy each service as its own Fly app:

- `apps/backend/fly.postgres.toml` for Postgres
- `apps/backend/fly.toml` for the backend API

## If you create the app in the Fly dashboard

The dashboard can create the Fly app record, but for this monorepo you should still deploy with `flyctl`
using the backend config in `apps/backend`. That guarantees Fly uses `apps/backend/Dockerfile`.

```bash
# from repo root
fly deploy -c apps/backend/fly.toml --app golist-backend
```

(Equivalent if you prefer backend dir: `cd apps/backend && fly deploy -c fly.toml --app golist-backend`.)

## 1) Create and deploy Postgres app

```bash
cd apps/backend
fly apps create golist-postgres
fly volumes create pg_data --size 10 --region iad --app golist-postgres
fly secrets set POSTGRES_PASSWORD='<strong-password>' --app golist-postgres
fly deploy -c fly.postgres.toml
```

## 2) Configure and deploy backend app

The backend uses a Fly release command (configured in `fly.toml`) to run migrations on deploy.
Set the database URL as a secret so it is available to both release command and app machines.

```bash
cd apps/backend
fly apps create golist-backend
fly secrets set DATABASE_URL='postgres://golist:<strong-password>@golist-postgres.internal:5432/golist' --app golist-backend
fly deploy -c fly.toml
```

## Notes

- `fly.toml` includes:
  - `http_service` with `internal_port = 3000` and `/health` checks
  - `release_command` for DB migrations
  - an explicit `vm` size block (`shared-cpu-1x`, `256MB`) compatible with Fly Machines
- This mirrors the two-container `docker-compose.yml` setup as two Fly apps connected over Fly private networking.
