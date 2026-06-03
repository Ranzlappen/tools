# Flipper GUI Studio

> Visual designer for Flipper Zero / Momentum app GUIs. Drag widgets,
> wire buttons, export drop-in C code.

## What it does

A WYSIWYG editor for the Flipper Zero's 128×64 monochrome screen.
Drop primitives (text, box, frame, line, dot), interactive buttons,
icons, and composite widgets (progress bar, menu, toggle) onto a
multi-screen canvas; free-draw pixel art with a pencil and eraser;
wire buttons to screen transitions; export as
**C** that drops straight into a Momentum app under
`ranzlappen/Flipper` — or as a JSON spec, snippet, or XBM header.

Everything runs locally. No upload, no network calls beyond the
shared CDN that lazy-loads the markdown renderer for this info modal.

## User guide

### Features

- **Drag-and-drop placement** from the palette onto the 128×64 canvas
  (CSS-scaled, pixel-aligned).
- **Free draw + eraser** — the tool row above the canvas has **Select**
  (the default move tool), **Pencil**, and **Eraser**, plus a 1–3 px
  brush-size picker. Pencil paints individual pixels MS-Paint-style;
  Eraser clears them. Strokes collect into a single per-screen paint
  layer (a `bitmap` widget) that lives in the Elements list, undoes one
  stroke at a time, round-trips through JSON, and exports as a
  `canvas_draw_xbm` call trimmed to its bounding box. Switch tools with
  **V / P / E** (or **Esc** to return to Select).
- **Multi-screen** with a tab bar; buttons wire screen-to-screen with
  a `goto` action. Custom-event actions emit an integer event code
  you can dispatch in your app.
- **Per-widget inspector** auto-generated from each widget's schema —
  coordinates, dimensions, fonts, keys, actions. Text/number fields
  commit on **Enter** or blur; **Esc** reverts the edit.
- **Font / size picker on every text-bearing widget** — `text`, `button`,
  `menu`, and `toggle` each pick from Flipper's four native bitmap fonts.
  Since `canvas_set_font` has no size argument, the font *is* the size:
  Secondary 5×7, Primary 6×8, Keyboard 6×9, BigNumbers 8×13. The choice
  maps straight to `canvas_set_font(canvas, Font…)` on export.
- **Native side-scroll for long text** — flip **Scroll** on any
  text-bearing widget and overflowing text marquees Flipper-style. The
  `text` widget also takes a **Scroll width**; `button`/`menu`/`toggle`
  scroll within their own bounds. The editor preview animates it, and the
  exported C app drives it for real with a `FuriTimer` +
  `elements_scrollable_text_line`. Both freeze under
  `prefers-reduced-motion`.
- **Elements panel** — a layers list of every widget on the active
  screen. Click a row to select it; tick its checkbox to **lock** the
  widget (its position is frozen and it becomes clickthrough on the
  canvas, so you can edit whatever sits beneath it). Locked widgets
  still export normally.
- **Variable bindings** — `progress`, `menu`, and `toggle` widgets can
  read from named model fields (set the value/state to `var:name`).
  The exporter collects all bindings into a single `<App>Model` struct.
- **XBM icon pipeline** — upload any image; downscale; threshold or
  Floyd–Steinberg dither; emit as 1-bit byte array compatible with
  `canvas_draw_xbm`.
- **Predefined icon library** — a built-in set of 1-bit glyphs (system,
  navigation, media and Flipper-themed) at 16/32/64 px. Clicking the
  **Icon** palette tool opens a picker to choose one (or one of your
  uploads) instead of guessing; *Browse library* stocks your icon list
  without placing a widget.
- **Four export formats** — Snippet (draw-body only), Full scene
  (.c + .h pair), XBM (icons-only header), JSON spec (round-trippable).
- **Download bundle (.zip)** — one click packages a **build-ready C app**
  that unzips straight into `C-Apps/<app>/` in `ranzlappen/Flipper`:
  `application.fam`, the `<appid>.c` entry point, the `<ns>_scene.c/.h`
  pair, a 10×10 `icon.png`, and a README with the exact `ufbt` steps. The
  **Preview** target instead emits a browser-only canvas preview (not a
  deployable Flipper app — see *Limitations*). Pick the target with the
  C | Preview toggle.
- **Undo / redo** — 50-step history, `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y`.
- **Keyboard nudge** — arrow keys move by 1 px, Shift+arrow by 8 px,
  Delete removes, `Ctrl/Cmd+D` duplicates. `V`/`P`/`E` switch between the
  Select, Pencil and Eraser tools.
- **Hash round-trip** — the entire design lives in the URL hash, so
  designs are shareable as deep-links. Large designs (oversized
  icons, many screens) fall back to the JSON download flow.

### How to use it

1. Fill in **App settings** in the palette — name, namespace (the C
   identifier prefix), category, stack size, required SDK modules, and a
   10×10 launcher icon. A *validate-ready* badge shows the derived
   `C-Apps/<folder>/`, `appid` and entry point.
2. **Drag a widget** from the palette onto the canvas — or click it
   to drop at the default position. Click the widget to select; use
   the inspector to fine-tune.
3. Add screens via the `+ Screen` tab. Double-click a tab to rename.
4. To wire a button transition, add a **Button**, pick a **Key**
   (e.g. `ok`), and set its **Action** to `goto` → target screen.
5. To bind a value, open a `progress`, `menu`, or `toggle` and switch
   its value/state from `static` to `var`. Name the variable; the
   scene exporter declares it as a model field.
6. To add icons, either click the **Icon** palette tool and pick from
   the **library** (choose a 16/32/64 px size) or your own uploads — or
   use *Icons / XBM* → *Upload image* (enter width/height; the Flipper
   screen is 128×64 so 8/16/32 are typical; choose threshold or
   dithering). *Browse library* adds an icon to your list without
   placing a widget. Any placed `icon` widget can be re-pointed from its
   inspector dropdown.
7. To draw freehand, click **Pencil** in the tool row under the canvas
   (or press `P`), pick a brush size, and drag on the canvas. **Eraser**
   (`E`) removes painted pixels; **Select** (`V`) returns to moving
   widgets. The drawing is a single per-screen layer — select it in the
   Elements panel to **Clear** it. Painted pixels never block clicking
   the widgets beneath them.
8. Use the **Elements** panel (top of the right pane) to find, select,
   or **lock** widgets — handy when shapes overlap. A locked widget
   won't move and lets clicks fall through to whatever is beneath it.
9. Open the **Export** section and pick a format:
   - **Snippet** — paste into an existing `view_port_draw_callback`.
   - **Scene** — the `.c` + `.h` pair drops into your app directory.
   - **XBM** — icons-only header.
   - **JSON** — round-trippable spec; paste back via *Load JSON*.

   …or hit **Download bundle (.zip)** with the **C** target for a
   build-ready app folder (or **Preview** for a browser-only canvas
   preview).

### How to integrate into a Momentum app

The **C app** bundle is already a complete app. Unzip it into the
`C-Apps/` directory of your `ranzlappen/Flipper` checkout and build:

```sh
cd C-Apps/<your-app>
ufbt            # → dist/<appid>.fap
ufbt launch     # build + upload + run over USB
```

The bundle's `application.fam` already satisfies the repo's
`validate.mjs` (its `appid` matches the folder name and its
`entry_point` is defined in `<appid>.c`). To react to a button's custom
event, override the generated `<ns>_on_event()` in `<appid>.c`:

```c
void my_app_on_event(int32_t event, MyAppModel* state) {
    switch(event) {
        case 1: /* … */ break;
    }
}
```

The generated app uses a single `ViewPort` with an idiomatic
`FuriMessageQueue` input loop — the same pattern as the repo's
`hello-world` C template. For richer multi-view apps you can wrap the
scene in a `ViewDispatcher` by hand; native ViewDispatcher emission is a
planned mode.

### Editing a deployed app later (round-trip)

The C bundle ships an `<appid>.flipper-gui.json` sidecar — the design's
**source of truth**. The FAM and scene are fully recoverable from it, so
that one file is all you need to keep editing:

1. **Load JSON** the committed `<appid>.flipper-gui.json` back into the
   editor.
2. Make your change and re-export the **C** bundle over the folder.
3. Re-export overwrites `application.fam`, `<ns>_scene.c`/`.h`, and the
   JSON sidecar; it **never** touches `<appid>.c`, so your hand-written
   `<ns>_on_event()` logic survives.

The `ranzlappen/flipper` repo commits this sidecar next to every
Studio-generated app and runs `npm run regen-check` in CI: it regenerates
the FAM + scene from the committed JSON (using these exporters, headless)
and byte-diffs them, so the spec and generated files can't drift. The
exclusion list (`<appid>.c` + assets) matches step 3.

### Privacy

This tool is entirely client-side. The generated code, JSON spec, and
icon bytes never leave your browser. The only network calls are the
shared CDN that lazy-loads marked + DOMPurify for this README modal.

## Developer guide

### File layout

- `index.html` — three-pane editor scaffold (palette / canvas /
  inspector + export), inline `<style>` for editor-specific chrome.
- `tool.js` — state, hash round-trip, render loop, drag/select/nudge,
  undo/redo, inspector form generator. Lazy-imports exporters.
- `exporters/snippet.js` — current screen's `draw_callback` body only.
- `exporters/scene.js` — full `.c` + `.h` pair; the widget→C emitter
  table is the canonical place to add a new widget type.
- `exporters/fam.js` — `application.fam` manifest, plus `appMeta` (the
  single source of truth for the appid / folder / entry-point identifiers).
- `exporters/entry.js` — the `<appid>.c` entry point and the
  `<ns>_on_event` override stub.
- `exporters/xbm.js` — icons-only header.
- `exporters/json.js` — pretty-printed `flipper-gui/v1` spec; the
  `<appid>.flipper-gui.json` round-trip sidecar (filename derived from
  `appMeta`).
- `exporters/index.js` — the stable, **DOM-free** export surface
  (`exportFam`, `exportScene`, `exportEntry`, `exportJson`, `appMeta`,
  `preloadFonts`) that headless consumers like the Flipper repo's
  `regen-check` import. `await preloadFonts()` once before `exportScene`
  for byte-identical output.
- `exporters/bundle.js` — assembles the C-app / JS-app `.zip` (pure;
  JSZip + the loaded exporters + a PNG renderer are injected). The C
  target also writes the `<appid>.flipper-gui.json` sidecar.
- `lib/xbm.js` — XBM packing, 1bpp dithering, base64.
- `lib/png1.js` — minimal 1-bit-grayscale PNG encoder for the launcher
  `icon.png` and `images/` assets (`canvas.toBlob` can't emit 1-bit, which
  the firmware asset compiler requires).
- `lib/draw-scene.js` — the pure 1-bit scene renderer, shared by the
  editor canvas (`renderCanvas`) and the exported JS bundle (`render.js`)
  so both draw identically. Takes the icon list as a parameter (no
  editor state).
- `lib/icon-picker.js` — the `<dialog>` icon picker; lazy-loads the
  library on first open.
- `lib/icons/library.js` — generated predefined-icon data (base64 XBM at
  16/32/64). Regenerate with `icongen/` — see `icongen/README.md`.
- `lib/font-metrics.js` — per-font vertical metrics + u8g2 names (and
  the `charW` fallback width).
- `lib/font-render.js` — pixel-exact glyph rendering: loads the glyph
  data, measures strings, and blits bitmaps onto the editor canvas.
- `lib/fonts/*.js` — generated glyph data (bitmaps + advances) for
  FontPrimary / FontKeyboard / FontBigNumbers, advances only for
  FontSecondary. Regenerate with `fontgen/` — see `fontgen/README.md`.

### Adding a new widget type

1. Add it to `ALLOWED_WIDGET_TYPES` in `tool.js` and extend
   `sanitizeWidget` with its discriminated fields.
2. Add a case to `drawWidget` in `lib/draw-scene.js` (shared by the
   editor preview and the exported JS renderer).
3. Add a case to `widgetBbox` in `tool.js` (selection handle sizing).
4. Add a case to `addWidget` (default values).
5. Add a case to `renderInspector` (the form fields).
6. Add a case to `emitWidgetDraw` in `exporters/scene.js`.
7. If interactive: extend `emitScreenInput` or `emitAction`.

### State shape

```jsonc
{
  "v": 1,
  "app": { "name": "...", "namespace": "..." },
  "screens": [
    { "id": "scr_xxx", "name": "...", "widgets": [{ "id": "w_n", "type": "...", "x": 0, "y": 0, ... }] }
  ],
  "icons": [{ "id": "ico_xxx", "name": "I_xxx_8x8", "w": 8, "h": 8, "frames": 1, "rate": 0, "bits": "base64-1bpp" }],
  // text/button/menu/toggle carry "font" (primary|secondary|keyboard|big_numbers)
  // and "scroll": true|false; the text widget also carries "scrollW" (clip px).
  // widgets may carry "locked": true — editor-only (frozen position +
  // clickthrough); locked widgets still export.
  // the free-draw paint layer is a "bitmap" widget: { type:"bitmap",
  // x:0, y:0, w:128, h:64, bits:"base64-1bpp" } — one per screen.
  "activeScreenId": "scr_main",
  "selection": []
}
```

### Limitations

- **Font fidelity in preview.** FontPrimary, FontKeyboard and
  FontBigNumbers render pixel-exact from the real u8g2 glyph bitmaps,
  so the editor matches `canvas_draw_str` on device. FontSecondary
  (haxrcorp4089) has no upstream BDF, so it falls back to an
  antialiased `fillText` — text is laid out with the font's real
  advances (centering/measuring is correct) but the glyph shapes are
  approximate. None of these fonts include Cyrillic; Latin-1 is
  covered where the source font provides it.
- **Side-scroll preview is an approximation.** The editor clips and
  marquees long text to convey the effect; the exact cadence on device
  comes from `elements_scrollable_text_line` driven by the generated
  `FuriTimer`. Both the preview and the exported JS bundle freeze the
  motion under `prefers-reduced-motion`.
- **Single-image icons only.** Multi-frame animated icons are on the
  v2 list.
- **ViewPort target.** Generated apps use a single ViewPort with an
  idiomatic blocking input loop — build-ready, but native ViewDispatcher
  / SceneManager emission is still planned.
- **Preview export is browser-only.** The *Preview* bundle renders the
  design to an HTML canvas; it is **not** a deployable Flipper app (the
  Momentum JS runtime has no pixel-canvas API). Use the **C app** bundle
  to build something that runs on-device.
- **Round-trip is via JSON, not `.c`.** The C bundle ships an
  `<appid>.flipper-gui.json` sidecar — the design's source of truth — next
  to the generated FAM and scene. To keep editing a deployed app, **Load
  JSON** that sidecar back into the editor, change it, and re-export over the
  folder. Reverse-engineering hand-written `.c` is deliberately out of scope.
- **Desktop-first.** The drag-and-drop flow is built around pointer
  events; mobile users should use the inspector form fields.
