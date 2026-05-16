# JSON Formatter

> Pretty-print, minify, and validate JSON entirely in your browser.

## What it does

Paste JSON into the **Input** pane and the tool will pretty-print it,
minify it, or just tell you whether it parses. Errors include the exact
line and column where parsing failed. Everything runs locally — your
input never leaves the page and the result is yours to copy.

## User guide

### Features

- **Format** — re-emit the input with 2-space indentation.
- **Minify** — collapse the input to a single line, no whitespace.
- **Validate** — parse silently and report size in bytes, no output.
- **Sample** — load a representative document so you can try the tool.
- **Clear** — empty both panes.
- **Copy output** — copies the right-hand pane to the clipboard.
- **`Ctrl/Cmd + Enter`** in the input pane runs **Format**.
- Errors render line/column when the JS engine exposes a position.

### How to use it

1. Paste JSON into the **Input** textarea on the left.
2. Click **Format** (or hit `Ctrl/Cmd + Enter`).
3. Read the result on the right; click **Copy output** to grab it.
4. If the banner turns red, fix the reported line/col and try again.

### Examples

Input:

```
{"user":{"id":42,"roles":["author","admin"]}}
```

After **Format**:

```
{
  "user": {
    "id": 42,
    "roles": [
      "author",
      "admin"
    ]
  }
}
```

After **Minify** the result collapses back to the single-line form.
**Validate** on the same input shows: `Valid JSON. 46 bytes.`

### Privacy

Pure client-side. The tool calls `JSON.parse` / `JSON.stringify` in your
browser and never makes a network request with your data. The only
outbound request the page makes is for the in-app help modal (this
document) when you open it.

## Developer guide

### File layout

- `index.html` — markup, button row, two textareas (`#json-in`,
  `#json-out`), the `#status` banner.
- `tool.js` — single module, no exports. Wires a delegated `click`
  listener for `[data-action]` and a `Ctrl/Cmd + Enter` shortcut.

### Key DOM hooks

| Selector              | Role                                            |
| --------------------- | ----------------------------------------------- |
| `#json-in`            | Source textarea (writable).                     |
| `#json-out`           | Result textarea (read-only).                    |
| `#status` / `#status-text` | Inline banner; classes drive colour.       |
| `[data-action="format"]`   | Pretty-print button.                       |
| `[data-action="minify"]`   | Collapse-to-one-line button.               |
| `[data-action="validate"]` | Parse + size report, no output.            |
| `[data-action="sample"]`   | Load the `SAMPLE` constant.                |
| `[data-action="clear"]`    | Reset both panes.                          |
| `[data-action="copy"]`     | Clipboard write.                           |

### Dependencies

Vanilla JS only. Uses `JSON.parse`, `JSON.stringify`, `Blob` for the
validate-byte-count, and `navigator.clipboard`. No CDN scripts.

### Extending

- Add a new action button in `index.html` with `data-action="<name>"`
  and a matching branch in the delegated handler at the bottom of
  `tool.js`.
- The `parsePosition` helper in `tool.js` only understands the
  `position N` error format. If you want to support other engines'
  formats, extend that function.

### Limitations / gotchas

- The validator follows strict JSON — comments, trailing commas, and
  single-quoted strings are rejected. (That's by design; if you need to
  accept JSON5, write a separate tool.)
- Very large inputs (multi-MB) will block the main thread because
  parsing is synchronous. Acceptable for typical pasted payloads.
