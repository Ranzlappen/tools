# Markdown Preview

> Live GitHub-Flavored Markdown rendering with one-click HTML copy.

## What it does

Type GFM on the left, see rendered HTML on the right. Output is
sanitised with [DOMPurify](https://github.com/cure53/DOMPurify) before
it touches the DOM, so pasting hostile markdown can't run scripts or
exfiltrate data. Click **Copy HTML** to put the sanitised markup on
your clipboard.

## User guide

### Features

- **Live preview** with an 80 ms debounce — no render flicker on fast
  typing.
- **GitHub-Flavored Markdown**: tables, task lists, fenced code blocks,
  strikethrough, autolinked URLs.
- **Sanitised output** — any embedded `<script>` or event-handler
  attribute is stripped by DOMPurify before the HTML reaches the
  preview pane.
- **Copy HTML** copies the rendered HTML (post-sanitisation) to the
  clipboard.
- **Sample** loads a representative GFM document covering headings,
  code, tables, blockquotes, and task lists.
- **Clear** empties the source pane.
- **Fallback** — if marked or DOMPurify fails to load (SRI mismatch,
  network down), the preview falls back to escaped plaintext so the
  page still shows your input.

### How to use it

1. Type or paste markdown into the left textarea.
2. Watch the preview update on the right.
3. Click **Copy HTML** to grab the rendered output for use elsewhere.

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

### Privacy

The tool itself runs locally; your markdown source is never sent
anywhere. Two scripts are loaded from `cdn.jsdelivr.net` with
Subresource Integrity (SRI) hashes pinned:
[`marked@12.0.2`](https://www.npmjs.com/package/marked/v/12.0.2) and
[`dompurify@3.0.11`](https://www.npmjs.com/package/dompurify/v/3.0.11).
The CDN sees only the request for those static JS files — not your
content.

## Developer guide

### File layout

- `index.html` — markup, two-pane split, button row. The marked +
  DOMPurify `<script>` tags live in the `<head>` with SRI hashes.
- `tool.js` — debounced render loop, button delegation, sample data.

### Key DOM hooks

| Selector                       | Role                                |
| ------------------------------ | ----------------------------------- |
| `#md-in`                       | Source textarea.                    |
| `#md-out`                      | Preview container (`<div>`).        |
| `[data-action="copy-html"]`    | Copies `#md-out.innerHTML`.         |
| `[data-action="sample"]`       | Loads the `SAMPLE` constant.        |
| `[data-action="clear"]`        | Empties the input.                  |

### Dependencies

- [`marked@12.0.2`](https://github.com/markedjs/marked) — markdown
  parser. SRI:
  `sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi`.
- [`dompurify@3.0.11`](https://github.com/cure53/DOMPurify) — HTML
  sanitiser. SRI:
  `sha384-Ic7KEGROu37YaruU6NyiYeib7UhjFyDZQ5fzBAji965L75T/4LGk5nzwMEjNGexs`.

Both are loaded `defer` with `crossorigin="anonymous"` and
`referrerpolicy="no-referrer"`.

### Extending

- **Add an extension**: call `window.marked.use(extensionObject)` once
  on `load`. Define new tokens / renderers per the marked extension
  API.
- **Tighten the sanitiser**: pass a custom `DOMPurify.sanitize(html,
  config)` config — e.g. `ALLOWED_TAGS`, `FORBID_ATTR`.
- **Syntax highlighting**: combine marked with a `renderer.code` hook
  that delegates to a highlighter. Keep the highlighter behind SRI too.

### Limitations / gotchas

- The fallback path (libs failed to load) shows plaintext only — it
  intentionally does *not* try to render markdown manually.
- Tables and task lists rely on `gfm: true`; don't disable it.
- The default config does not pass `breaks: true`; single newlines
  become spaces, not `<br>`. Flip it in `tool.js` if you want
  GitHub-comment behaviour.
