# Plan: Re-adding PNG PWA icons later

## Goal
Reintroduce PNG icons (192/512 + maskable variants) without blocking Codex Web uploads.

## Constraints
- Codex Web cannot push PNG files directly to GitHub.
- Manifest and build should remain stable until PNG assets can be added out-of-band.

## Plan
1. **Prepare PNG assets outside Codex Web**
   - Generate `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`.
   - Source from the upstream GoList repo or export from design tools.

2. **Add PNG files to `public/icons/` via a local Git client**
   - Place files at:
     - `public/icons/icon-192.png`
     - `public/icons/icon-512.png`
     - `public/icons/icon-maskable-192.png`
     - `public/icons/icon-maskable-512.png`
   - Commit them using a local environment that supports binary uploads.

3. **Update the manifest in `vite.config.ts`**
   - Add PNG entries under `manifest.icons` for the four files.
   - Update `includeAssets` to include `icons/*.{svg,png}`.

4. **Verify locally**
   - Run `npm run build -w apps/web` and confirm `manifest.webmanifest` includes PNG icons.
   - Install the PWA on a test device to confirm correct icon usage.

5. **Optional follow-up**
   - Add screenshots to the manifest if desired.
   - Update documentation to note PNG icons are supported.
