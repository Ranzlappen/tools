# Font data generator

Dev-only tooling that produces the pixel-font modules in
`../lib/fonts/`. **Not part of the site build** — the generated
`*.js` files are committed and loaded directly by the tool. You only
run this when the source fonts or coverage ranges change.

## What it generates

`extract-fonts.mjs` converts u8g2's Flipper fonts into compact ES
modules:

| Output module        | Source              | Flipper font     | Contents            |
| -------------------- | ------------------- | ---------------- | ------------------- |
| `primary.js`         | `helvB08.bdf`       | `FontPrimary`    | bitmaps + advances  |
| `keyboard.js`        | `profont11.bdf`     | `FontKeyboard`   | bitmaps + advances  |
| `big_numbers.js`     | `profont22.bdf`     | `FontBigNumbers` | bitmaps + advances  |
| `secondary.js`       | `haxrcorp4089_tr.c` | `FontSecondary`  | advances only       |

`FontSecondary` (haxrcorp4089) has no upstream BDF — u8g2 ships it only
as a compiled binary blob. The generator partially decodes that blob to
recover per-glyph advance widths (no pixel data), so the editor lays out
secondary text correctly while drawing it with a `fillText` fallback.

Coverage is ASCII (0x20–0x7E) + Latin-1 (0xA0–0xFF) where the source
provides it; `big_numbers` is restricted to the `_tn` subset
(space..colon). None of these fonts include Cyrillic — the Cyrillic
glyphs seen on translated Flipper firmware come from Momentum's
separately-patched font variants, which are out of scope here.

## Regenerating

The source fonts live in `src/` and are **gitignored** (vendored,
~140 KB). Fetch them, then run the generator:

```sh
cd tools/flipper-gui
mkdir -p fontgen/src && cd fontgen/src
base=https://raw.githubusercontent.com/olikraus/u8g2/master/tools/font
curl -sO $base/bdf/helvB08.bdf
curl -sO $base/bdf/profont11.bdf
curl -sO $base/bdf/profont22.bdf
curl -s -o haxrcorp4089_tr.c \
  $base/build/single_font_files/u8g2_font_haxrcorp4089_tr.c
cd ../.. && node fontgen/extract-fonts.mjs
```

Then sanity-check `lib/fonts/*.js` and reload the tool.

## Licensing

These fonts ship in u8g2 under their original permissive terms
(helvB08: Adobe/DEC X11 license; ProFont: free distribution; HaxrCorp
4089: CC BY-SA by sahwar). Only the derived glyph data is committed
here; see the upstream u8g2 repository for full license texts.
