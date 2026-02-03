# GoList PWA (React + TypeScript) plan

## Goals
- Progressive web app (offline-first) with installable experience.
- Local-only data storage for now; can later add sync.
- Architecture that can be shared with future native apps.

## Recommended stack
- **Framework**: React + TypeScript (Vite).
- **State**: Zustand or Redux Toolkit (simple app state + persistence).
- **Local storage**: IndexedDB via Dexie (structured data + migrations).
- **PWA**: Vite PWA plugin + Workbox strategy.
- **Styling**: CSS Modules or Tailwind (pick one).

## Architecture overview
- **UI**: React components with a thin state layer.
- **Domain**: Small domain module (list, item, tags, metadata).
- **Persistence**: `storage/` module (Dexie) + migrations.
- **Sync-ready**: Keep domain model clean, use DTOs for storage.

## Data model (initial)
- **List**: `id`, `name`, `createdAt`, `updatedAt`.
- **Item**: `id`, `listId`, `name`, `quantityOrUnit?` (free-form text), `checked`, `createdAt`, `updatedAt`.
- **Metadata**: app version, last opened time.

## PWA behavior
- **Offline**: cache app shell + static assets.
- **Data**: stored in IndexedDB only.
- **Install**: include manifest, icons, and service worker.

## Roadmap
1. **MVP**: create multiple lists, add items, check/uncheck, category-based sorting (grocery order).
2. **Quality**: offline UX, optimistic updates, quick search.
3. **PWA polish**: install prompt, splash, icons.
4. **Native-ready**: keep UI components portable, consider React Native Web later.

## Native apps later
- Consider React Native with shared logic (domain + storage interfaces).
- Use an adapter for storage (IndexedDB now, SQLite later).

## Suggested repo layout
- `src/app` - routes + providers
- `src/domain` - types + business logic
- `src/storage` - Dexie setup + migrations
- `src/ui` - reusable UI components
- `src/features` - feature modules per screen

## CI/CD (GitHub Actions + Vercel)
- **Tests/validation**: run lint, typecheck, and unit tests on PRs.
- **Deploy**: build and deploy the main branch to Vercel via GitHub Actions.
- **Preview**: optional Vercel preview for PRs (if desired).

## Sorting (grocery order)
- Replicate the previous app’s hardcoded item/category list to assign categories.
- Sort items by category order to match supermarket aisle flow.
- Fall back to manual/created order for unknown items.

## Item suggestions
- While adding a new item, suggest matches based on previously added items within the current list.
- Rank suggestions by frequency and recency; include category hints if available.

## UI direction
- Match the prior app’s layout: list title, grid of item cards with icons, bottom bar with add action.
- Keep spacing, card sizes, and typography similar; colors can differ.

## Open questions
- Should we add import/export for list backups?
