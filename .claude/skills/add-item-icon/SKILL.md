---
name: add-item-icon
description: Add or change a GoList item icon and wire it to item names. Use whenever someone asks for a new item icon (e.g. "add a fennel icon", "we need an icon for pretzels"), wants an existing icon redrawn, or wants item names (in German, English or Spanish) to show a different icon or land in a different grocery category — anything touching apps/web/public/icons/ or packages/shared/src/domain/item-category-mapping.ts.
---

# Add an item icon

An item icon only shows up when two things exist: the SVG in
`apps/web/public/icons/<name>.svg`, and an entry in
`packages/shared/src/domain/item-category-mapping.ts` that maps item names to
it in **every** language. Missing either one means the icon never appears.

Real examples: PR #326 (fennel — new icon + mapping), PR #328 (pretzel and
others — names mapped to two icons, so the dedicated icon never showed).

## 1. Clarify before drawing

Ask the user when any of these is unclear rather than guessing:
- which `category` the item belongs to (ids are in `categoryOrderById` at the
  top of the mapping file: `fruitsVegetables`, `bread`, `milkCheese`,
  `meatFish`, `cereals`, `spicesCanned`, `sweetsSnacks`, `beverages`,
  `household`, `convenienceProductFrozen`, `other`);
- which item names (de/en/es, singular/plural, common spellings such as
  `ae` for `ä`) should map to the icon.

The category decides where the item sorts in the list, so a wrong guess is a
user-visible bug.

## 2. Author the SVG

Copy the header of an existing icon (e.g. `apps/web/public/icons/fennel.svg`)
so the file matches the set exactly:

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Adobe Illustrator 24.2.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" id="Ebene_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 width="512px" height="512px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve">
<style type="text/css">
	.st0{fill:none;stroke:#000000;stroke-width:30;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;}
	.st1{fill:none;stroke:#000000;stroke-width:18;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;}
</style>
<g>
	<path class="st0" d="..."/>
</g>
</svg>
```

- 512×512, black hand-drawn **line art** (outlines, not filled silhouettes).
- Draw with stroked `<path class="st0">` (30px). The stock icons use filled
  double-contour paths, but stroked paths look the same and are far easier to
  hand-author.
- Use the thinner `.st1` (18px) only for fine detail (fronds, seeds, text-like
  marks) so it doesn't read as chunky. Drop `.st1` if unused.
- Keep a ~30px margin inside the viewBox so round caps aren't clipped.
- Short `<!-- part -->` comments per shape group help the next edit.
- File name: lowercase snake_case English (`dish_soap.svg`); this base name is
  the `assetFileName`.

**Do not judge the drawing yourself.** There is no SVG renderer in the
container (`rsvg-convert`, `inkscape`, `sharp`, `cairosvg` are absent), and you
must not start a browser or take screenshots to check it. Finish the SVG, then
ask the user to look at it and confirm it reads correctly; only they decide
visual correctness. Mention in the PR that the icon is waiting on (or got)
their visual confirmation.

## 3. Wire up the mapping

The file has one `CategoryEntry[]` per language: `categoryEntriesDe`,
`categoryEntriesEn`, `categoryEntriesEs`. Add one entry to **each**:

```ts
{
  "assetFileName": "fennel",          // same in all three
  "matchingNames": [
    "fenchel",                        // translated per language
  ],
  "category": "fruitsVegetables",     // same in all three
},
```

How names resolve (read `scanForCategoryEntry` if you need details): names are
normalized (lowercase, punctuation → spaces), an exact match wins, otherwise
every entry name that is a **substring** of the item name matches; names at
the end of the item name win, then the longest. Consequences:

- **No name may appear in two entries.** If `"brezel"` is already under
  `bread`, adding it under `pretzel` leaves the new icon dead (PR #328). Search
  the file for each name first and *move* it to the new entry instead of
  duplicating it. Do this in all three languages.
- Short names match inside longer ones (`"ei"` matches `"eis"`). Prefer full
  words; check what existing items a short name would now capture.
- If a word means two things (es `soda`), keep the common meaning and make the
  other a longer phrase (`"baking soda"`, `"bicarbonato"`).

## 4. Verify

```bash
npx vitest run apps/web/src/domain/iconAssets.test.ts   # SVG exists + no name→icon/category collisions
npm run typecheck -w apps/web                           # packages/shared has no own typecheck
npm run lint -w apps/web
```

`npm run verify:changed` runs all of the above (and more, since
`packages/shared` changed). If the collision test fails, it prints the name,
language and the competing icons/categories — fix the mapping, never the test.

## 5. PR

Summarize: icon file, names per language, category, any names moved away from
another entry, and that the user has confirmed (or still needs to confirm) the
drawing.
