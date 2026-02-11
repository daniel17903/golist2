# Suggested repo structure (simplified)

Since you want to keep things lightweight for now, use a small monorepo layout with just:
- `apps/web` for the existing PWA
- `apps/backend` for the new backend
- `packages/shared` only for shared domain types (no API contract layer yet)

```txt
golist/
  apps/
    web/                     # existing React + Vite PWA app
      src/
      public/
      package.json
      vite.config.ts
    backend/                 # initial backend service (single module)
      src/
        index.ts             # app/server entry point
        routes.ts            # basic route wiring
        db.ts                # database client + helpers
      package.json
      tsconfig.json
  packages/
    shared/                  # optional shared types/utilities only
      src/
        domain/
          list.ts
          item.ts
      package.json
  .github/
    workflows/
      ci.yml
  package.json               # workspace scripts
  tsconfig.base.json
```

## Why this is enough right now

- No `infra/` folder yet: add it later when Docker/Terraform/etc. is actually needed.
- No API contracts package yet: keep backend DTOs local until multiple clients or versioning pressure appears.
- No multiple backend modules yet: start with one service and split by feature only when complexity grows.

## Suggested next step

Move the current app into `apps/web` first with minimal/no code changes, then scaffold `apps/backend` and wire a basic health check endpoint.
