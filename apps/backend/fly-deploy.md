# Fly.io deployment (backend + postgres)

Fly.io does not run a full Docker Compose stack from a single `fly.toml`.
Instead, deploy each service as its own Fly app:

- `apps/backend/fly.postgres.toml` for Postgres
- `apps/backend/fly.toml` for the backend API

## 1) Create and deploy Postgres app

```bash
cd apps/backend
fly apps create golist-postgres
fly volumes create pg_data --size 10 --region iad --app golist-postgres
fly deploy -c fly.postgres.toml
```

Then set a DB password secret on the Postgres app:

```bash
fly secrets set POSTGRES_PASSWORD='<strong-password>' --app golist-postgres
```

## 2) Configure and deploy backend app

```bash
cd apps/backend
fly apps create golist-backend
fly secrets set DATABASE_URL='postgres://golist:<strong-password>@golist-postgres.internal:5432/golist' --app golist-backend
fly deploy -c fly.toml
```

This mirrors the two-container `docker-compose.yml` setup, but as two Fly apps connected over Fly private networking.
