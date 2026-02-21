# UI shell refresh redo plan (for future agent)

## Context
The previous UI shell refresh PR was reverted to restore the latest stable behavior. This plan describes how to re-implement the desired improvements cleanly on top of the current `work` branch state.

## Goals
- Improve shell UX and visual polish while keeping interactions simple and intuitive.
- Keep the **item cards and item grid behavior unchanged**.
- Preserve existing list, sorting, and suggestion semantics.
- Re-implement incrementally with reviewable commits.

## Required constraints
- Do not modify item-grid/card layout behavior (`ItemGrid`, `ItemCard`, sorting logic).
- Keep list rename inline and low-friction.
- Avoid blocking browser alerts for routine feedback.
- Preserve accessibility (focus-visible, keyboard close behavior, color contrast, tap targets).
- Re-check all unresolved inline review comments from the reverted PR before coding.

## Suggested implementation phases

### Phase 1 — Header and rename flow
1. Update `AppHeader` API to support inline editing mode:
   - display mode: list name + edit trigger + readable backend status.
   - edit mode: name input + save/cancel controls.
2. Wire from `App.tsx` using existing rename state from `useAppState` (`editingTitle`, `newListName`, `handleRenameList`).
3. Keep rename behavior backward-compatible (same persistence call and validation).

**Acceptance checks**
- Rename can be started, saved, and cancelled without modal interruption.
- Existing rename persistence still updates active list name.

### Phase 2 — Feedback system modernization
1. Replace share `window.alert` success/failure with non-blocking toasts in `App.tsx`.
2. Reuse existing undo-toast placement logic so overlays do not conflict.
3. Keep message tone explicit (success/error) and auto-dismiss timing predictable.

**Acceptance checks**
- Share success and error states show app toasts.
- Undo toast still works after item delete/toggle flow.

### Phase 3 — Drawer metadata and safer destructive action
1. Extend `ListsDrawer` props to accept items needed for lightweight metadata.
2. Show per-list summary row details (e.g., open items and recent update timestamp).
3. Add a safer delete interaction (two-step confirm or equivalent).
4. Keep gesture open/close behavior unchanged.

**Acceptance checks**
- Active list selection, creation, and deletion still function.
- Drawer drag gestures work in both directions.

### Phase 4 — Style polish (shell only)
1. Introduce minimal design tokens in `styles.css` for shell surfaces and text hierarchy.
2. Polish header, bottom bar, drawer, dialogs, and toasts only.
3. Add consistent focus-visible and pressed states for interactive controls.
4. Ensure PWA-safe spacing around bottom bar (`safe-area-inset-bottom`).

**Acceptance checks**
- Item grid and cards visually/behaviorally unchanged.
- Shell components have coherent spacing and contrast.

## File scope likely to change
- `apps/web/src/App.tsx`
- `apps/web/src/components/AppHeader.tsx`
- `apps/web/src/components/BottomBar.tsx`
- `apps/web/src/components/ListsDrawer.tsx`
- `apps/web/src/styles.css`

## Validation checklist (required before merge)
- `npm run typecheck -w apps/web`
- `npm run lint -w apps/web`
- `npm run build -w apps/web` (record any environment-specific failure clearly)
- Manual smoke checks:
  - rename inline flow
  - share feedback toasts
  - drawer open/close/select/create/delete
  - undo toast
  - keyboard and focus-visible behavior

## Commit strategy for future agent
- Commit A: header + inline rename wiring.
- Commit B: toast feedback modernization.
- Commit C: drawer metadata + delete safety.
- Commit D: CSS polish and accessibility pass.
- Final: run validation and attach screenshot of updated shell.
