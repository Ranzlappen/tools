# Markdown Preview

> Live GitHub-Flavored Markdown rendering — or import a file and convert it to Markdown.

## What it does

Type GFM on the left, see rendered HTML on the right. Output is
sanitised with [DOMPurify](https://github.com/cure53/DOMPurify) before
it touches the DOM, so pasting hostile markdown can't run scripts or
exfiltrate data. Click **Copy HTML** to put the sanitised markup on
your clipboard.

You can also **import a file** — drop or pick an HTML, CSV, JSON, TXT,
DOCX, XLSX, PDF, or PPTX file and the tool converts it to Markdown,
drops it into the source pane, and renders it live. Conversion runs
entirely in your browser; the file is never uploaded.

## User guide

### Features

- **Live preview** with an 80 ms debounce — no render flicker on fast
  typing.
- **GitHub-Flavored Markdown**: tables, task lists, fenced code blocks,
  strikethrough, autolinked URLs.
- **File import → Markdown** — drop or choose a file and get Markdown in
  the source pane:
  - **HTML** → Markdown (via [Turndown](https://github.com/mixmark-io/turndown)).
  - **CSV / TSV** → a Markdown table.
  - **JSON** → a pretty-printed fenced code block.
  - **TXT / MD** → inserted as-is.
  - **DOCX** → Markdown ([mammoth](https://github.com/mwilliamson/mammoth.js)
    converts to HTML, then Turndown to Markdown).
  - **XLSX** → one Markdown table per sheet ([SheetJS](https://sheetjs.com)).
  - **PDF** → extracted text, one section per page
    ([pdf.js](https://mozilla.github.io/pdf.js/)). Text only.
  - **PPTX** → extracted slide text, one section per slide. Text only.
- **Sanitised output** — any embedded `<script>` or event-handler
  attribute is stripped by DOMPurify before the HTML reaches the
  preview pane.
- **Copy HTML** copies the rendered HTML (post-sanitisation).
- **Copy Markdown** copies the source-pane Markdown.
- **Download .md** saves the source-pane Markdown as a `.md` file.
- **Sample** loads a representative GFM document.
- **Clear** empties the source pane.
- **Fallback** — if marked or DOMPurify fails to load (SRI mismatch,
  network down), the preview falls back to escaped plaintext so the
  page still shows your input.

### How to use it

1. Type or paste markdown into the left textarea — or drop/choose a file
   in the import zone to convert it to Markdown automatically.
2. Watch the preview update on the right.
3. Click **Copy HTML**, **Copy Markdown**, or **Download .md** to grab
   the output for use elsewhere.

### Examples

Input:

```
# Hello, world

A small **markdown** preview tool.

- [x] write a sample
- [ ] do something with it
```

Renders as a level-1 heading, a paragraph with a bold word, and a task
list with one item checked.

Drop a `.docx`: its headings, lists, and tables become equivalent
Markdown in the source pane and render immediately on the right.

### Privacy

The tool runs locally; your content — typed or imported — is never sent
anywhere. The preview always loads two scripts from `cdn.jsdelivr.net`
with Subresource Integrity (SRI) hashes pinned:
[`marked@12.0.2`](https://www.npmjs.com/package/marked/v/12.0.2) and
[`dompurify@3.0.11`](https://www.npmjs.com/package/dompurify/v/3.0.11).

Converter libraries load from `cdn.jsdelivr.net` **only when you import a
matching file** (e.g. mammoth is fetched the first time you import a
DOCX), so the page stays light until you use the feature. The CDN sees
only the request for those static JS files — not your file or its
contents.

## Developer guide

### File layout

- `index.html` — markup, status banner, import drop zone, two-pane
  split, button row. The marked + DOMPurify `<script>` tags live in the
  `<head>` with SRI hashes.
- `tool.js` — debounced render loop, button delegation, sample data,
  drop-zone wiring, and the import/download glue.
- `convert.js` — self-contained ES module: file-type detection and the
  per-format converters. Lazy-loads parser libraries from jsDelivr on
  first use. Exports `convertFileToMarkdown(file, { onProgress })`.

### Key DOM hooks

| Selector                       | Role                                    |
| ------------------------------ | --------------------------------------- |
| `#md-in`                       | Source textarea.                        |
| `#md-out`                      | Preview container (`<div>`).            |
| `#drop`                        | Import drop zone (click / drag-drop).   |
| `#md-file`                     | Hidden `<input type="file">`.           |
| `#status` / `#status-text`     | Import status / error banner.           |
| `[data-action="copy-html"]`    | Copies `#md-out.innerHTML`.             |
| `[data-action="copy-md"]`      | Copies `#md-in` (the Markdown source).  |
| `[data-action="download-md"]`  | Downloads `#md-in` as `document.md`.    |
| `[data-action="sample"]`       | Loads the `SAMPLE` constant.            |
| `[data-action="clear"]`        | Empties the input.                      |

### Dependencies

Always loaded (preview), `defer` + SRI + `crossorigin="anonymous"` +
`referrerpolicy="no-referrer"`:

- [`marked@12.0.2`](https://github.com/markedjs/marked) — markdown
  parser. SRI:
  `sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi`.
- [`dompurify@3.0.11`](https://github.com/cure53/DOMPurify) — HTML
  sanitiser. SRI:
  `sha384-Ic7KEGROu37YaruU6NyiYeib7UhjFyDZQ5fzBAji965L75T/4LGk5nzwMEjNGexs`.

Lazy-loaded from jsDelivr on first matching import (UMD scripts pinned
with SRI; pdf.js is loaded as an ES module via `import()`, so it has no
SRI — matching the repo precedent):

- [`turndown@7.2.4`](https://github.com/mixmark-io/turndown) +
  [`turndown-plugin-gfm@1.0.2`](https://github.com/mixmark-io/turndown-plugin-gfm)
  — HTML → Markdown (used for HTML and DOCX).
- [`mammoth@1.12.0`](https://github.com/mwilliamson/mammoth.js) — DOCX →
  HTML.
- [`xlsx@0.18.5`](https://sheetjs.com) — XLSX parsing. **Note:** 0.18.5
  is the newest build published to npm/jsDelivr and carries a known
  advisory (CVE-2023-30533, prototype pollution / ReDoS); the patched
  ≥0.19.3 builds are only on SheetJS's own CDN. The risk is low here —
  the tool is client-only, the output is rendered through DOMPurify, and
  no input is ever `eval`'d — so it is pinned from jsDelivr to keep the
  single-CDN convention. The `dependency-review` workflow may flag it.
- [`jszip@3.10.1`](https://stuk.github.io/jszip/) — unzips OOXML (DOCX/
  XLSX/PPTX) containers for format detection and PPTX slide extraction.
- [`pdfjs-dist@4.10.38`](https://mozilla.github.io/pdf.js/) — PDF text
  extraction. Its worker is loaded via a same-origin blob shim so the
  cross-origin CDN worker can be used.

### Extending

- **Add a format**: add an entry to `EXT_KIND` (and a magic-byte branch
  if needed) in `detectKind()`, write a `convertX(file, warnings)`
  helper, and add a `case` to the `switch` in `convertFileToMarkdown()`.
- **Add an extension**: call `window.marked.use(extensionObject)` once
  on `load`.
- **Tighten the sanitiser**: pass a custom `DOMPurify.sanitize(html,
  config)` config — e.g. `ALLOWED_TAGS`, `FORBID_ATTR`.

### Limitations / gotchas

- **PDF and PPTX are text-only** — no layout, images, or styling; tables
  in a PDF come through as plain text lines, not Markdown tables.
- **Scanned / image-only PDFs** yield no text (there is no OCR); you get
  a warning instead.
- **Password-protected PDFs** can't be read — the import surfaces a
  clear error.
- **DOCX images** are converted to inline data-URIs, which can bloat the
  output Markdown.
- **PPTX slide order** is taken from the `slideN.xml` filename's numeric
  suffix, not the presentation's true slide order.
- **Large files** are flagged (>25 MB) or blocked (>100 MB); big
  spreadsheets are truncated to 5000 rows per sheet.
- Importing **replaces** whatever is in the source pane.
- The fallback path (preview libs failed to load) shows plaintext only.
- Tables and task lists rely on `gfm: true`; don't disable it.
- The default config does not pass `breaks: true`; single newlines
  become spaces, not `<br>`.
