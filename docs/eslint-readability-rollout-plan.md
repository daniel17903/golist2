# ESLint Readability Rules Rollout Plan (Redo on Latest `main`)

This plan is for a future agent to re-apply stricter ESLint readability rules **after syncing with the latest remote `main`**, while avoiding the broad churn from prior attempts.

## Goal

Re-introduce stricter linting in small, reviewable steps:

1. Keep required trailing commas on multiline constructs.
2. Add readability rules (`curly`, `eqeqeq`, `no-nested-ternary`, `object-shorthand`, `prefer-template`).
3. Add a rule to disallow `as` type assertions in TypeScript.

## Preconditions

1. Ensure remotes are configured.
2. Update local `main` and branch from it.
3. Run workspace install if needed.

Suggested commands:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b chore/eslint-readability-rules
npm install
```

## Recommended Phased Approach

### Phase 1: Config-only + trailing commas

- Update:
  - `apps/web/eslint.config.js`
  - `apps/backend/eslint.config.js`
- Add only:
  - `comma-dangle: ["error", "always-multiline"]`

Then run focused autofix:

```bash
npm run lint -w apps/web -- --fix
npm run lint -w apps/backend -- --fix
```

Commit as a standalone PR if diff size is large.

### Phase 2: Readability rules (without assertion ban yet)

Add:

- `curly: ["error", "all"]`
- `eqeqeq: ["error", "always"]`
- `no-nested-ternary: "warn"`
- `object-shorthand: ["error", "always"]`
- `prefer-template: "warn"`

Run lint + autofix where safe; manually review functional code paths after brace insertion.

### Phase 3: Disallow `as` assertions

Add TypeScript rule:

- `@typescript-eslint/consistent-type-assertions: ["error", { assertionStyle: "never" }]`

Notes:

- In flat config, make sure `@typescript-eslint/eslint-plugin` is registered where this rule is used.
- Expect test-only refactors where assertion-based mocking is common.
- Prefer runtime shape checks / helper functions instead of `as unknown as ...`.

## Validation Checklist

Run at least:

```bash
npm run lint
npm run lint -w apps/backend
npm run typecheck
npm run typecheck -w apps/backend
npm run test
```

If backend typecheck fails due to environment/module resolution issues, document exactly why in PR notes.

## PR Hygiene Guidance

- Keep each phase in a separate commit.
- Include before/after lint counts for each phase.
- If touching many files, mention that changes are mechanical (`eslint --fix`) vs manual edits.
- Avoid unrelated formatting/style changes outside enabled rules.
