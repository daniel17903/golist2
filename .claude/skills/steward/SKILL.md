---
name: steward
description: Repo-specific conventions for driving a GoList pull request to green and merge-ready — CI failures, review comments (including the automatic Copilot reviewer), merge conflicts with main, lockfile conflicts, and what to run before each push. Use whenever you own or babysit a PR in daniel17903/golist2, get a CI/review/merge-conflict event for one, or are about to push follow-up commits to a PR branch.
---

# Stewarding a GoList PR

The goal is a PR that is green, conflict-free and has every review thread
answered — with each push validated locally first, because a red push costs a
CI cycle (~10–15 min for E2E) and the reviewer's attention.

## What CI runs (on every PR to `main`)

| Workflow / job | Runs |
| --- | --- |
| `ci.yml` → `validate` | web lint, typecheck, test (unit + sync sim), build; backend lint, typecheck, test (repository tests skip without DB) |
| `ci.yml` → `web-e2e-playwright` (matrix `memory`, `postgres`) | `npm run test:e2e -w apps/web` against the in-memory and the Postgres backend |
| `backend-bootstrap.yml` (only when `apps/backend/**` changes) | backend lint, typecheck, `db:migrate`, test against Postgres |

Local equivalents: `npm run verify` (validate minus build), `npm run
verify:full` (adds builds + E2E), `npm run verify:changed` (only what your
diff needs). For Postgres: `eval "$(scripts/local-postgres.sh)"`, then
`E2E_BACKEND=postgres npm run test:e2e -w apps/web`.

## Before every push

1. `npm run verify:changed` — must be clean. It mirrors the AGENTS.md matrix
   and adds E2E when components, hooks, store, sync, storage or e2e files
   changed.
2. For a CI fix: reproduce the failing check locally first, then show the same
   check passing.
3. Re-read the diff for things CI would reject (lint rules such as
   `react-hooks/refs`, a forgotten `.only`, stray scratch specs — those belong
   in the gitignored `e2e/scratch/`).

## Diagnosing red CI

- `validate` failures reproduce with the matching `npm run … -w apps/…`.
- E2E failures: download the `e2e-<backend>-artifacts` artifact (memory or
  postgres). It holds `apps/web/test-results/` (traces, screenshots,
  per-device `device-*-websocket-frames.txt` and `device-*-console.txt`,
  `backend-log.jsonl` for the test), `playwright-report/`, and the full
  backend log in `.e2e-logs/backend.log`. Reproduce locally with
  `npm run test:e2e -w apps/web -- e2e/<spec>.ts -g "<test name>"`.
- Red only on `postgres`? Suspect the Postgres repository; run it locally with
  `scripts/local-postgres.sh`.
- Sync-flavored failures: use the `fix-sync-bug` skill (reproduce in the sim
  first). "Flaky" is not a root cause — tests fail on any uncaught page error
  and most "flakes" so far were real races.
- Never skip, `.fixme`, or loosen a test to get green.

## Merge conflicts / keeping up with main

- On a shared or already-reviewed branch, **merge** `origin/main` into it; do
  not rebase or force-push (it invalidates reviewers' checkouts and comment
  anchors). PRs are squash-merged, so merge commits don't pollute `main`.
  ```bash
  git fetch origin main && git merge origin/main
  ```
- `package-lock.json` conflicts: never hand-edit. Take `main`'s version and
  regenerate:
  ```bash
  git checkout --theirs package-lock.json   # during the merge: main's side
  npm install                               # re-applies this branch's package.json changes
  git add package-lock.json
  ```
  Check that `git diff origin/main -- package-lock.json` only contains changes
  your `package.json` edits explain.
- `AGENTS.md` / docs conflicts are common because several agents edit them in
  parallel — keep both sides' content, then re-read the section for
  duplicates.
- After resolving: `npm run verify:changed`, then push.

## Review comments

- An automatic **Copilot reviewer** (`copilot-pull-request-reviewer[bot]`)
  reviews every PR and re-reviews after pushes; its summary lists open
  findings with a severity. Other agents may review too. Expect these
  comments.
- Treat each finding as a claim to verify, not an order: trace the concrete
  path (input → wrong behavior) in the code. Fix it when real; when it's
  wrong or not worth the code, say why with specifics. Don't blindly apply
  suggested patches — they are often subtly wrong for this codebase (e.g.
  suggestions that subscribe to the whole store or add inline callbacks
  violate the `react-performance` rules).
- **Reply on every review thread** (fixed in `<commit>` / why not), then
  resolve the threads you addressed. Leave a thread open only when the
  decision belongs to the maintainer (design questions, security trade-offs),
  and say so.
- Small asks (nits, renames, an extra test) → just do them. Large asks
  (multi-file refactors, API/schema changes) → propose in the thread first.
- Batch fixes for a review into one validated push rather than one push per
  comment.

## Definition of done

CI green on the latest head (both E2E backends), no conflict with `main`,
every review thread replied to and resolved (or explicitly left to the
maintainer), docs updated where AGENTS.md "Documentation maintenance" requires
it. Don't merge the PR yourself — the maintainer or the assigned reviewer merges
(squash).
