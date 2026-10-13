#!/usr/bin/env bash
# Starts a throwaway Postgres cluster for local/agent test runs and prints
# the PG* exports for it. Idempotent: reuses a running cluster.
#
#   eval "$(scripts/local-postgres.sh)"
#   npm run test -w apps/backend                 # runs repository tests too
#   E2E_BACKEND=postgres npm run test:e2e -w apps/web
#
# Stop it with: scripts/local-postgres.sh stop
set -euo pipefail

log() { echo "[local-postgres] $*" >&2; }

port="${GOLIST_PGPORT:-55432}"
# One cluster per port, so a changed GOLIST_PGPORT never reuses a cluster
# that listens elsewhere. As root, Postgres runs as the `postgres` user, which
# must be able to traverse every parent directory — a private $TMPDIR (mode
# 0700, as in sandboxes) would break initdb, so root always uses /tmp.
if [[ "$(id -u)" == "0" ]]; then
  default_parent=/tmp
else
  default_parent="${TMPDIR:-/tmp}"
fi
data_dir="${GOLIST_PGDATA:-$default_parent/golist-pg-$port}"

pg_ctl_path="$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl 2>/dev/null | sort -V | tail -n 1 || true)"
if [[ -z "$pg_ctl_path" ]]; then
  log "Postgres server binaries (pg_ctl, initdb) not found; install postgresql or set PGHOST/DATABASE_URL to an existing database"
  exit 1
fi
bin_dir="$(dirname "$pg_ctl_path")"

# Postgres refuses to run as root; run its commands as the postgres user then.
run_pg() {
  if [[ "$(id -u)" == "0" ]]; then
    su postgres -s /bin/bash -c "$(printf '%q ' "$@")"
  else
    "$@"
  fi
}

if [[ "${1:-}" == "stop" ]]; then
  run_pg "$bin_dir/pg_ctl" -D "$data_dir" stop -m fast >&2 || true
  exit 0
fi

if [[ ! -f "$data_dir/PG_VERSION" ]]; then
  mkdir -p "$data_dir"
  if [[ "$(id -u)" == "0" ]]; then
    chown postgres "$data_dir"
    if ! su postgres -s /bin/bash -c "test -w $(printf '%q' "$data_dir")"; then
      log "the postgres user cannot write to $data_dir (check parent directory permissions or set GOLIST_PGDATA)"
      exit 1
    fi
  fi
  log "initializing cluster in $data_dir"
  run_pg "$bin_dir/initdb" -D "$data_dir" -U golist --auth=trust >/dev/null
fi

if ! run_pg "$bin_dir/pg_ctl" -D "$data_dir" status >/dev/null 2>&1; then
  log "starting on port $port"
  run_pg "$bin_dir/pg_ctl" -D "$data_dir" -o "-p $port -k $data_dir -c listen_addresses=127.0.0.1" -l "$data_dir/server.log" -w start >&2
fi

if ! run_pg "$bin_dir/psql" -h 127.0.0.1 -p "$port" -U golist -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='golist'" | grep -q 1; then
  run_pg "$bin_dir/createdb" -h 127.0.0.1 -p "$port" -U golist golist
fi

cat <<ENV
export PGHOST=127.0.0.1
export PGPORT=$port
export PGUSER=golist
export PGPASSWORD=golist
export PGDATABASE=golist
export PGSSLMODE=disable
ENV
