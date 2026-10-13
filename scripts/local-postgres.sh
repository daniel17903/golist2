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

data_dir="${GOLIST_PGDATA:-${TMPDIR:-/tmp}/golist-pg}"
port="${GOLIST_PGPORT:-55432}"
bin_dir="$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | sort -V | tail -n 1)")"
log() { echo "[local-postgres] $*" >&2; }

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
  [[ "$(id -u)" == "0" ]] && chown postgres "$data_dir"
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
