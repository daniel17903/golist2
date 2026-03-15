# Language switch suggestion (frontend) — implementation plan

## Goal
On app start, suggest switching the UI language if a user recently added items that stayed in the default category but would all resolve to a non-default category in another supported language.

## Trigger conditions
Show the popup only when all of the following are true:
1. There are **at least 2** eligible items.
2. Eligible items were added in the **last 7 days**.
3. Eligible items currently have the default/fallback category (`"other"`).
4. Eligible items were **created by the current device**.
5. For one alternative locale (`en`/`de`/`es` excluding current), **all** eligible items map to a non-default category in that locale.
6. The user has not already been asked before.

---

## Step 1 — Add detection logic in a domain helper
Create a pure helper in `apps/web/src/domain/` (for example `languageSuggestion.ts`) that determines whether a suggestion should be shown.

### Inputs
- Current locale.
- Current device ID.
- Items list.
- Optional `now` override for tests.

### Filtering rules
- Keep items where:
  - `deleted === false`
  - `createdAt >= now - 7 days`
  - `category === "other"`
  - `createdByDeviceId === currentDeviceId` (or equivalent ownership field)

> Note: if `Item` currently does not store creator device metadata, add a backwards-compatible field (for example `createdByDeviceId?: string`) and populate it when creating items locally.

### Matching rules
- Require at least 2 filtered items.
- For each locale other than current:
  - Evaluate each item name via existing locale-aware category mapping.
  - Locale qualifies only if each item resolves to a category other than `"other"`.
- Choose first qualifying locale in deterministic order (supported locale order excluding current).
- Return `null` if no locale qualifies.

---

## Step 2 — Persist “already asked” state
Add a localStorage key (for example `golist.languageSuggestionHandled`) and check it before detection.

### Persistence behavior
- If key exists, never show popup again.
- Set the key when popup is dismissed.
- Also set the key when user accepts and switches language.

Optional payload structure:
- `suggestedLocale`
- `handledAt`
- `action` (`"accepted" | "dismissed"`)

---

## Step 3 — Build a language suggestion popup
Add a modal component in `apps/web/src/components/` (for example `LanguageSuggestionModal.tsx`) using existing modal patterns.

### UI actions
- Primary: switch to suggested language.
- Secondary: keep current language / dismiss.

### Behavior
- Accept action:
  - call existing language setter
  - persist handled state
  - close modal
- Dismiss action:
  - persist handled state
  - close modal

---

## Step 4 — Run detection on app start
In app startup flow (likely `App.tsx` or `useAppState.ts`):
- Wait for store load completion.
- Ensure check runs once per session startup.
- Skip if already handled.
- Run detector and open popup if locale suggestion is returned.

---

## Step 5 — i18n copy
Add translation keys in all supported locales:
- `languageSuggestion.title`
- `languageSuggestion.body`
- `languageSuggestion.switch`
- `languageSuggestion.dismiss`

Optional key for locale display interpolation if needed.

---

## Step 6 — Data model/storage updates (if needed for device ownership filter)
Because step 1 requires filtering items created by the current device, implement one of:

1. **Preferred:** Add `createdByDeviceId` to item model and store it on item creation.
2. Keep migration/backward compatibility by allowing existing rows with missing value.
3. Detection helper should ignore items with unknown creator.

This ensures shared/synced items created on other devices do not trigger the suggestion.

---

## Step 7 — Tests
### Domain tests
- <2 eligible items -> no suggestion
- items outside 7 days ignored
- non-`other` category ignored
- item from different device ignored
- all eligible items matching one locale -> suggestion
- mixed locale/non-match -> no suggestion

### UI/startup tests
- popup appears when detector returns locale and not handled
- popup does not appear when handled
- accept switches locale and persists handled
- dismiss persists handled without switching

---

## Rollout/QA checklist
- Validate with realistic sample data in EN app where recent DE/ES item names are uncategorized in EN.
- Confirm popup appears only once per user/device (according to persisted key).
- Confirm no popup when only one eligible item exists.
- Confirm no popup when eligible items include names not resolvable in a single target locale.
