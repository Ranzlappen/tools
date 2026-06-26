# HTML Builder

> Design a web page visually — drag elements onto a live canvas, style every
> property, add responsive breakpoints and no-code interactions, then export
> clean HTML/CSS/JS. Entirely in your browser.

## What it does

HTML Builder is a no-code, model-first page builder. You assemble a page by
dragging elements and components onto a live preview, selecting them, and
editing their styles, attributes, and behaviors through panels — no markup or
CSS typing required. A structured document model is the single source of
truth; the preview is rendered from it, and clean, framework-free HTML/CSS/JS
is generated when you export. Everything runs locally; nothing is uploaded.

## User guide

### Layout

- **Left panel** — *Palette* (elements + component presets) and *Layers* (the
  page tree). Switch with the tabs at the top.
- **Center** — the device toolbar and the live canvas.
- **Right panel** — the *Inspector* with *Style*, *Attributes*, and
  *Behaviors* tabs for the selected element.

### Features

- **Drag-and-drop building** — drag any element or component preset (hero,
  card, nav bar, button group, two columns, form) from the Palette onto the
  canvas or into the Layers tree. An insertion marker shows where it will land.
  You can also click a palette item to drop it into the current selection.
- **Click to select** — click anything on the canvas to select it; a labelled
  outline with resize handles appears. The Layers tree mirrors the selection.
- **Full style inspector** — box model (margin/padding), size, display with
  flex/grid sub-controls, typography, colour, background, border, radius,
  shadow, opacity, and position. Every value is a control; nothing is typed as
  CSS unless you want to.
- **Visual grid editor** — set `display: grid` and the Layout section shows a
  track editor: add/remove columns and rows, pick each track's unit
  (`fr / px / % / em / auto / min-content / max-content`), and set the gap — no
  raw `grid-template` strings required.
- **Image upload** — on an image (or video) element, click **↑** to upload a
  file. It is stored with the design, shown in the preview, inlined into the
  single-file HTML export, and written to `assets/` in the ZIP export.
- **Import HTML** — the **Import** button opens a panel to paste existing HTML
  (or fetch a URL). Structure, classes, and inline styles become editable;
  `<style>`/linked CSS is preserved as custom CSS; scripts are stripped.
- **Responsive breakpoints** — switch *Desktop / Tablet / Mobile* in the
  toolbar. Edits made while on Tablet or Mobile become overrides for that
  breakpoint only (real `@media` rules); a badge marks overridden properties.
- **No-code interactions** — in the *Behaviors* tab add rules like
  *On click → toggle CSS class* or *On scroll into view → show element*. They
  run in exported pages and in **Test** mode.
- **Undo / redo** — `Ctrl/Cmd + Z` and `Ctrl/Cmd + Shift + Z` (or `Ctrl + Y`).
- **Test mode** — the *▶ Test* button runs your interactions live in the
  canvas; click it again or press `Esc` to return to editing.
- **Code view** — *&lt;/&gt; Code* opens read-only HTML / CSS / JS tabs.
- **Export** — *Export HTML* downloads one self-contained file; *ZIP* downloads
  `index.html` + `styles.css` + `app.js`.
- **Share** — *Share* encodes the whole design into the URL and copies a link.
- **Autosave** — with functional cookies enabled, your work is saved locally
  and restored on reload. *Reset* clears the canvas.

### How to use it

1. Drag a **Hero section** (or any element) from the Palette onto the canvas.
2. Click an element to select it.
3. In the **Style** tab, adjust spacing, colour, layout, and type.
4. Switch to **Mobile** and tweak anything that should differ on phones.
5. Open **Behaviors** and add an interaction if you want one.
6. Hit **Export HTML** — the downloaded file opens standalone in any browser.

### Keyboard shortcuts

- `Ctrl/Cmd + Z` — undo · `Ctrl/Cmd + Shift + Z` / `Ctrl + Y` — redo
- `Ctrl/Cmd + D` — duplicate the selected element
- `Delete` / `Backspace` — remove the selected element
- `Esc` — exit Test mode, or deselect

### Privacy

Pure client-side. The model, preview, and all generated code stay in your
browser; no design data is sent anywhere. The only network requests the page
makes are for the shared site chrome, this help document, and — only when you
export a ZIP — the pinned JSZip library from a CDN.

## Developer guide

### File layout

- `index.html` — page shell: head boilerplate, the three-pane app, the toolbar,
  the code modal, and all tool-specific CSS (inline `<style>`).
- `tool.js` — the shell. Owns the toolbar, keyboard map, code modal, exports,
  and the single store subscription that drives every panel. Lazy-loads the
  exporters and JSZip.
- `lib/` — concern-split ES modules (see below).
- `exporters/` — lazy-loaded, DOM-free code generators.

### lib/ modules

| Module | Responsibility |
| --- | --- |
| `schema.js` | Node/Doc factories, tag + attribute catalog, tree traversal. Pure data. |
| `store.js` | Live document, mutation helpers, undo/redo, subscriptions. No DOM. |
| `style-engine.js` | Per-breakpoint StyleMaps → one `@media`-aware stylesheet (preview == export). |
| `renderer.js` | Model → iframe `srcdoc`; targeted patch helpers; pretty export render. |
| `canvas.js` | Owns the preview iframe; device framing; click/hover/drop bridge. |
| `overlay.js` | Parent-drawn selection/hover boxes, resize handles, drop markers. |
| `layers.js` | The tree panel with drag-to-reparent. |
| `inspector.js` | Style/Attributes tabs and all controls. |
| `palette.js` | Element catalog + component presets; the shared drag factory. |
| `behaviors.js` | The Behaviors tab UI. |
| `behaviors-runtime.js` | Interaction metadata + the runtime IIFE (shared by preview and export). |
| `grid-editor.js` | Visual `grid-template` track editor (Layout section). |
| `assets.js` | Uploaded-media registry (data URLs, size caps, export pruning). |
| `import-html.js` | Pragmatic HTML → model importer (lazy; sanitizes via DOMPurify). |
| `persistence.js` | localStorage autosave + base64url share links. |

### Key DOM hooks

| Selector | Role |
| --- | --- |
| `#hb-frame` | Preview iframe (same-origin `srcdoc`). |
| `#hb-stage` / `#hb-overlay` | Scroll container / parent overlay layer. |
| `#hb-palette` / `#hb-layers` | Left-pane mounts. |
| `#hb-inspector` | Right-pane inspector mount. |
| `[data-device]` | Breakpoint chips. |
| `[data-hb-id]` | Per-element id in the rendered output (maps DOM ↔ model). |

### Dependencies

Vanilla JS only. The Markdown help modal and ZIP export lazy-load `marked`,
`DOMPurify`, and `JSZip` from pinned, SRI-checked CDNs on first use. Nothing
else; no build step, no framework.

### Extending

- **Add an element** — add an entry to `TAGS` in `lib/schema.js` (with its
  attribute spec); it appears in the Palette automatically.
- **Add a component preset** — add a `() => Node` factory to `PRESETS` in
  `lib/palette.js` and list it in `PRESET_META`.
- **Add a style control** — add it to the section spec in `lib/inspector.js`.
- **Add an interaction** — add a trigger/action to `lib/behaviors-runtime.js`
  (metadata + a `case` in the runtime IIFE).

### Limitations / gotchas

- **HTML import is pragmatic, not pixel-perfect.** Inline `style=` attributes
  become editable per-element styles, but CSS from `<style>` blocks and linked
  stylesheets is preserved verbatim as *custom CSS* (not GUI-editable per
  element). Text interleaved directly beside child elements (e.g. `Hello
  <b>world</b>`) is dropped; JavaScript/interactions are not imported;
  cross-origin linked stylesheets may be skipped by CORS. Import replaces the
  current canvas (undoable).
- **Uploaded images** are capped (per-file and total) and live in your browser
  only. They inline into the single-file HTML and write to `assets/` in the
  ZIP, but are **not** included in share links — export a file to keep them.
- The Spacing controls read/write the longhand `*-top/right/bottom/left`
  properties; a shorthand `padding`/`margin` set by a preset still applies but
  won't populate the four side fields.
- Resize handles adjust width/height only (no positional reflow).
- Very large designs may exceed the share-link size; export a file instead.
