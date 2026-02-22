# Multi-language implementation plan (EN default, DE + ES)

## Goal
Implement complete multi-language support for the web app with the locale priority order:

1. Explicit user choice
2. URL locale
3. Persisted local locale (cookie/localStorage)
4. `Accept-Language` (browser)
5. Geo guess (optional fallback)
6. Default locale (`en`)

Scope includes:
- Translating **all user-facing text**.
- Adapting input parsing so quantity/unit detection works for English, German, and Spanish.
- Reusing translation keys and parsing behavior from the previous app version (`daniel17903/golist`) and only adding missing keys/logic required by the current app.

## Reference baseline from previous app
Reuse these as source of truth where applicable:
- Old app repository: https://github.com/daniel17903/golist
- Language defaults/support (`en`, `de`, `es`; `en` default).
- Existing UI strings: save/cancel/edit/list/settings/language/about/version/privacy/source/offline/etc.
- Quantity parsing behavior and unit coverage currently used in the old regex/parser approach (including decimal separators and flour type exclusion `typ 630`).

## Current-state gap assessment (high level)
1. No centralized i18n layer in web app yet.
2. User-facing strings are still hardcoded in React components.
3. Quantity parser is German-centric and not locale-aware.
4. Locale detection/persistence order is not implemented.
5. No locale-focused tests for UI text resolution and detection priority.

## Implementation plan (priority-ordered)

### Phase 1 — i18n foundation + locale resolution order
1. Introduce an i18n runtime for React (e.g. `i18next` + `react-i18next`) with static JSON dictionaries.
2. Add locale constants and resolution function implementing the agreed order:
   - `userPreference` (explicit in app settings)
   - `urlLocale` (e.g. `/en`, `/de`, `/es` or query parameter fallback)
   - `storedLocale`
   - `browserLocale` (from `navigator.languages`/`Accept-Language` equivalent)
   - `geoLocale` (only if already available from an existing API/source; otherwise skip and go to default)
   - fallback `en`
3. Ensure all candidates are normalized to supported language codes (`en`, `de`, `es`) and unsupported codes degrade to `en`.
4. Persist explicit language changes and make explicit choice sticky across sessions.

### Phase 2 — migrate translations from old app first
1. Create translation namespaces/files for `en`, `de`, `es`.
2. Port all keys that already exist in old app first (same semantic keys when possible).
3. Add only missing keys required by the current React app UI (multi-list drawer labels, dialogs, sharing labels, etc.).
4. Keep `en` as canonical fallback; missing DE/ES keys should safely fallback to EN during migration.

### Phase 3 — replace hardcoded text in UI
1. Replace every hardcoded user-visible string in `apps/web/src/components`, `App.tsx`, and relevant hooks with `t(...)` lookups.
2. Include dynamic/pluralized strings where needed (e.g., shared devices count) using ICU/plural rules.
3. Keep interaction design unchanged (especially inline list rename and existing sorting/suggestion behavior).

### Phase 4 — locale-aware quantity parsing
1. Split parser into locale-aware config while retaining old tested behavior:
   - Keep the old amount-matching baseline units from prior app.
   - Add EN/ES unit aliases and plural forms missing from old logic (only where current app UX needs it).
2. Keep cross-locale numeric support (`2.5`, `2,5`) and retain flour-type exclusion behavior (`typ 630` and locale variants if needed).
3. Expose parser entrypoint as `parseItemInput(input, locale)` with default resolved locale.
4. Guarantee backward compatibility: existing German examples must continue to pass.

### Phase 5 — tests and validation
1. Add unit tests for locale resolution priority order, including tie-break and unsupported language fallback.
2. Add translation coverage checks (at least key parity against EN baseline).
3. Extend parser tests with EN/DE/ES quantity cases.
4. Run required checks before merge:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run build` (because runtime config and user-facing assets/strings are touched)

## Concrete work breakdown

### A. Locale infrastructure
- `apps/web/src/i18n/`:
  - `config.ts` (supported locales, default locale)
  - `resolveLocale.ts` (priority logic)
  - `resources/en.json`, `resources/de.json`, `resources/es.json`
  - `index.ts` (i18n initialization)
- App bootstrap update in `main.tsx`.

### B. Settings and persistence
- Extend store to persist `languagePreference`.
- Add language switch UI wiring (existing Settings surface) to update explicit preference.

### C. UI migration
- Incremental component migration with no behavior change.
- Add temporary fallback monitoring (console warning in dev for missing keys).

### D. Parser migration
- Refactor `apps/web/src/domain/inputParser.ts` into language-aware unit dictionaries + regex builder.
- Preserve existing tests and add locale matrix tests.

## Reuse-first rule for this migration
To satisfy "reuse old app first":
1. Import old-app keys and parser behavior as baseline.
2. Diff against current UI text and features.
3. Add only net-new keys and parser units required by the current app that are absent in old app.
4. Document every net-new addition in the PR notes (key name + reason).

## Risks and mitigations
- **Risk:** Missing translations block UI labels.
  - **Mitigation:** EN fallback + CI check for missing key parity.
- **Risk:** Quantity regex regressions.
  - **Mitigation:** Preserve old DE test vectors and add locale-specific snapshots.
- **Risk:** Locale flicker on first load.
  - **Mitigation:** Resolve locale before initial render and initialize i18n synchronously from cached preference.

## Acceptance criteria
- App supports `en`, `de`, `es` with `en` default.
- Effective locale follows exact priority order defined above.
- All user-facing text in current web UI is translatable.
- Quantity detection works in EN/DE/ES and keeps existing DE behavior intact.
- Only missing translation keys/logic beyond old app baseline are newly authored.
