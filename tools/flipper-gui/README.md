# Flipper GUI Studio

> Visual designer for Flipper Zero / Momentum app GUIs. Drag widgets,
> wire buttons, export drop-in C code.

## What it does

A WYSIWYG editor for the Flipper Zero's 128×64 monochrome screen.
Drop primitives (text, box, frame, line, dot), interactive buttons,
icons, and composite widgets (progress bar, menu, toggle) onto a
multi-screen canvas; wire buttons to screen transitions; export as
**C** that drops straight into a Momentum app under
`ranzlappen/Flipper` — or as a JSON spec, snippet, or XBM header.

Everything runs locally. No upload, no network calls beyond the
shared CDN that lazy-loads the markdown renderer for this info modal.

## User guide

### Features

- **Drag-and-drop placement** from the palette onto the 128×64 canvas
  (CSS-scaled, pixel-aligned).
- **Multi-screen** with a tab bar; buttons wire screen-to-screen with
  a `goto` action. Custom-event actions emit an integer event code
  you can dispatch in your app.
- **Per-widget inspector** auto-generated from each widget's schema —
  coordinates, dimensions, fonts, keys, actions.
- **Variable bindings** — `progress`, `menu`, and `toggle` widgets can
  read from named model fields (set the value/state to `var:name`).
  The exporter collects all bindings into a single `<App>Model` struct.
- **XBM icon pipeline** — upload any image; downscale; threshold or
  Floyd–Steinberg dither; emit as 1-bit byte array compatible with
  `canvas_draw_xbm`.
- **Four export formats** — Snippet (draw-body only), Full scene
  (.c + .h pair, drop-in), XBM (icons-only header), JSON spec
  (round-trippable).
- **Undo / redo** — 50-step history, `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y`.
- **Keyboard nudge** — arrow keys move by 1 px, Shift+arrow by 8 px,
  Delete removes, `Ctrl/Cmd+D` duplicates.
- **Hash round-trip** — the entire design lives in the URL hash, so
  designs are shareable as deep-links. Large designs (oversized
  icons, many screens) fall back to the JSON download flow.

### How to use it

1. Set **App name** and **Namespace** in the palette's *App settings*.
   The namespace becomes the C identifier prefix.
2. **Drag a widget** from the palette onto the canvas — or click it
   to drop at the default position. Click the widget to select; use
   the inspector to fine-tune.
3. Add screens via the `+ Screen` tab. Double-click a tab to rename.
4. To wire a button transition, add a **Button**, pick a **Key**
   (e.g. `ok`), and set its **Action** to `goto` → target screen.
5. To bind a value, open a `progress`, `menu`, or `toggle` and switch
   its value/state from `static` to `var`. Name the variable; the
   scene exporter declares it as a model field.
6. To add icons: *Icons / XBM* → *Upload image* → enter width/height
   (Flipper screen is 128×64 so 8/16/32 are typical) → choose
   threshold or dithering. The icon appears in the list and is
   selectable from any `icon` widget's inspector.
7. Open the **Export** section and pick:
   - **Snippet** — paste into an existing `view_port_draw_callback`.
   - **Scene** — the `.c` + `.h` pair drops into your app directory.
   - **XBM** — icons-only header.
   - **JSON** — round-trippable spec; paste back via *Load JSON*.

### How to integrate into a Momentum app

After exporting the **Scene** files into your app folder:

```c
// In your app's main entry point:
#include "my_app_scene.h"

int32_t my_app_main(void* p) {
    UNUSED(p);
    MyAppScene* scene = my_app_scene_alloc();
    my_app_scene_run(scene);
    my_app_scene_free(scene);
    return 0;
}
```

The generated scene uses a single `ViewPort` (the simpler Flipper
path). To plug into a multi-app `ViewDispatcher`, wrap the
view port in a `View` (`view_alloc`, `view_set_*_callback`, then
`view_dispatcher_add_view`). Native `ViewDispatcher` emission is on
the v2 list — for now the bridge is a few hand-written lines.

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
- `exporters/xbm.js` — icons-only header.
- `exporters/json.js` — pretty-printed spec.
- `lib/xbm.js` — XBM packing, 1bpp dithering, base64.
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
2. Add a case to `drawWidget` (editor preview).
3. Add a case to `widgetBbox` (selection handle sizing).
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
- **Single-image icons only.** Multi-frame animated icons are on the
  v2 list.
- **ViewPort target only.** Generated scenes use a single ViewPort;
  ViewDispatcher / SceneManager scaffolding is on the v2 list.
- **One-way export.** Importing existing `.c` back into the editor
  isn't supported — round-trip via the JSON format.
- **Desktop-first.** The drag-and-drop flow is built around pointer
  events; mobile users should use the inspector form fields.
