# Icon library generator

Dev-only tooling that produces `../lib/icons/library.js` — the
predefined 1-bit icon library offered by the tool's icon picker. **Not
part of the site build**: the generated module is committed and loaded
lazily by the browser. You only run this when the glyph set changes.

## What it generates

`generate-icons.mjs` rasterizes every glyph defined in `icons.svg.mjs`
at **16, 32 and 64 px** and packs each through the *same* 1-bit pipeline
the tool uses for uploaded images (`../lib/xbm.js`:
`imageDataToBits → packXbm → bytesToB64`). Library icons are therefore
byte-identical in format to user uploads and flow through the existing
icon export path (C `icons.h`, scene embedding, PNG/JS bundle) with no
special-casing.

The **8 px** tier is the exception: rasterizing a 24×24 SVG down to 8×8
yields an illegible blob, so those bitmaps are **hand-drawn** in
`icons-8px.mjs` (one 8×8 grid per icon). `generate-icons.mjs` uses that art
for size 8 instead of rasterizing; the standalone `build-8px.mjs` applies it
on its own (see below).

Output shape (`lib/icons/library.js`):

```js
export default {
  categories: [
    { id: "system", label: "System", icons: [
      { name: "battery", sizes: { "8": "<base64>", "16": "...", "32": "...", "64": "..." } },
      …
    ] },
    …
  ],
};
```

Each `sizes[N]` is the base64 of the XBM-packed (LSB-first, byte-aligned
rows) `N×N` bitmap.

## Licensing

**Every glyph is original artwork authored for this repo and released
under the repo's MIT license.** No third-party icon sets are vendored, so
there are no upstream attribution or copyleft constraints on the
generated bitmaps. (This is deliberate: Flipper's firmware assets are
GPL-3.0, so the Flipper-themed glyphs here are independent originals, not
copies.)

## Authoring glyphs

Edit `icons.svg.mjs`. Each entry is `{ category, name, inner, dither? }`
where `inner` is SVG markup inside a `24×24` viewBox of **solid black
shapes on transparent** (`#fff` fills punch holes). Prefer bold filled
shapes over thin outlines — they threshold to legible 1-bit glyphs at
16 px. Set `dither: true` on a glyph if Floyd–Steinberg reads better than
the default hard threshold for it. Categories are declared in
`CATEGORIES`.

## Regenerating

Needs Playwright + a Chromium build (used only to rasterize SVG → canvas;
plain Node has no SVG rasterizer). From the `flipper-gui` dir:

```sh
node icongen/generate-icons.mjs
```

If Playwright or its browsers live outside the local `node_modules`, point
the script at them, e.g.:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
NODE_PATH=/opt/node/lib/node_modules \
node icongen/generate-icons.mjs
```

The script prints a per-category icon count and writes
`../lib/icons/library.js`. Commit the regenerated module.

### Editing the 8×8 art (no browser needed)

The 8 px bitmaps live in `icons-8px.mjs` as plain `'#'`/`.` grids — edit them
by eye. To repack just that tier into `../lib/icons/library.js` (headless, no
browser, deterministic):

```sh
node icongen/build-8px.mjs
```

It rewrites every icon's `sizes["8"]` from the art and leaves the
SVG-rendered 16/32/64 tiers untouched, so you don't need Chromium to tweak the
small icons. `build-8px.mjs` errors if any library icon is missing art. The
full `generate-icons.mjs` uses the same art for size 8, so both stay in sync.
