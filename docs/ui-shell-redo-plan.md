# UI shell redo plan (post-revert, implementation requirements)

## Why this exists
The prior UI-shell refresh attempt was reverted. This document captures the **full expected behavior and constraints** for a future implementation so the work can be redone cleanly without repeating regressions.

## Non-negotiable constraints
- Keep **item grid/card behavior unchanged** (`ItemGrid`, `ItemCard`, sort semantics).
- Keep list rename **inline in header** (no blocking modal flow).
- Do not use blocking `window.alert` for normal success/error feedback.
- Preserve list-specific suggestions ranking (frequency, then recency).
- Preserve drawer drag/gesture open-close behavior.
- Avoid text overflow at all shell breakpoints (especially smartphone widths).
- Keep keyboard accessibility and visible focus styles.

## Target UX requirements

### 1) Header redesign (glass card style)
Implement a compact rounded “glass card” header similar to the provided reference:
- Rounded translucent shell, subtle border/highlight, backdrop blur.
- Title row with inline rename trigger.
- Secondary metadata row.
- Must **not** consume excessive vertical space on mobile; prioritize compact density.

### 2) Header metadata/status behavior
- Show open item count in header metadata row.
- Backend status indicator should be **icon-based** (cloud/server icon), not text badge.
- During active backend HTTP calls, replace status icon with a small loading animation/spinner.
- Keep status semantics accessible via `aria-label`/tooltip text.

### 3) Rename flow
- Inline edit mode in header with input + save/cancel controls.
- Keyboard support:
  - `Enter` saves.
  - `Escape` cancels.
- Reuse existing persistence/validation behavior.

### 4) Feedback system modernization
- Replace share success/failure alerts with non-blocking toast notifications.
- Keep undo-delete toast behavior working and non-overlapping with new toasts.
- Keep toast timing predictable.

### 5) Drawer enhancements
- Show lightweight per-list metadata (open items + last updated).
- Add safer delete interaction (two-step confirmation).
- Keep selection/create/delete core behavior unchanged.

### 6) Mobile/responsive + overflow hardening
- Ensure no clipping/overflow for long list names, metadata, or actions.
- Ensure controls remain tappable and legible on ~390px wide viewport.
- Respect safe area insets around bottom UI.

## E2E + validation requirements (must pass before commit)

### Required checks
- `npm run typecheck -w apps/web`
- `npm run lint -w apps/web`
- `npm run test`
- `npm run build -w apps/web`

### Playwright E2E requirement
For any shell/backend-interaction changes, run:
- `npx playwright install chromium`
- `npx playwright install-deps chromium`
- `RUN_PLAYWRIGHT_E2E=1 npm run test -w apps/web -- src/e2e.backend-frontend.playwright.test.ts`

E2E must pass, including default-list initialization and share flow scenarios.

### E2E stability note
When asserting request ordering in E2E, avoid brittle assumptions that a `GET` has already occurred at assertion time. Assertions should enforce required invariants while tolerating asynchronous timing.

## Suggested implementation sequence
1. Header API + inline rename wiring.
2. Icon-based status + active-request spinner plumbing.
3. Share toasts + undo-toast coexistence.
4. Drawer metadata + safe delete.
5. CSS polish + responsive/overflow pass.
6. Full validation + smartphone screenshot.

## Expected files likely touched
- `apps/web/src/App.tsx`
- `apps/web/src/components/AppHeader.tsx`
- `apps/web/src/components/ListsDrawer.tsx`
- `apps/web/src/hooks/useAppState.ts`
- `apps/web/src/sharing/apiClient.ts`
- `apps/web/src/state/useStore.ts`
- `apps/web/src/styles.css`
- `apps/web/src/e2e.backend-frontend.playwright.test.ts` (if needed for robust assertions)

