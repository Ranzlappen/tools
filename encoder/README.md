# Multi-Encoder

> Convert text between Base64, Hex, URL, Binary, and ASCII encodings (UTF-8 safe).

## What it does

Type plain text on the left; every encoding pane updates live. Edit any
encoding back and it round-trips into plain text, refreshing the others.
Multibyte characters (emoji, accented letters) are handled correctly
because the tool encodes/decodes through UTF-8 bytes, not 8-bit chars.

## User guide

### Features

- **Plain text** input drives every other field.
- **Five encodings**, each in its own editable textarea:
  - **Base64** — standard alphabet, padded.
  - **Hex** — lowercase, no separators; tolerates whitespace on input.
  - **URL encoded** — `encodeURIComponent` form (percent-escaped).
  - **Binary** — space-separated 8-bit byte groups (`01001000 …`).
  - **ASCII codes** — decimal byte values, space-separated.
- **Round-trip editing** — change any encoded pane and the others
  re-derive automatically. Bad input is silently ignored so the
  field you're editing isn't yanked from under you.
- **Sample** loads `héllo 🌍` to verify your UTF-8 path is solid.
- **Clear** empties every field.

### How to use it

1. Type or paste plain text into the **Plain text** pane.
2. Read off whichever encoding you need.
3. Or, paste an encoded value into one of the lower panes — the rest
   refresh from it.

### Examples

Plain text `Hi 🌍`:

```
Base64   SGkg8J+MjQ==
Hex      48692f09f8c8d           (illustrative; actual bytes differ)
URL      Hi%20%F0%9F%8C%8D
Binary   01001000 01101001 00100000 11110000 10011111 10001100 10001101
ASCII    72 105 32 240 159 140 141
```

(The plane emoji is 4 bytes in UTF-8 — that's why the Binary and ASCII
fields are longer than the visible string.)

### Privacy

Pure client-side. Encoding/decoding uses the built-in `TextEncoder`,
`TextDecoder`, `btoa`/`atob`, and `encodeURIComponent` APIs. No network
calls with your data.

## Developer guide

### File layout

- `index.html` — six textareas (plain + five encodings) plus the
  sample/clear buttons.
- `tool.js` — `TextEncoder` round-trip helpers, single shared `updating`
  flag to prevent recursion when one field's update writes to the
  others.

### Key DOM hooks

| Selector                | Role                                          |
| ----------------------- | --------------------------------------------- |
| `#enc-plain`            | Plain-text source.                            |
| `#enc-b64`              | Base64 round-trip pane.                       |
| `#enc-hex`              | Hex round-trip pane.                          |
| `#enc-url`              | URL-encoded round-trip pane.                  |
| `#enc-bin`              | Binary (space-separated bytes).               |
| `#enc-asc`              | ASCII decimal (space-separated bytes).        |
| `[data-action="sample"]`| Loads `héllo 🌍`.                             |
| `[data-action="clear"]` | Empties all six fields.                       |

### Dependencies

Vanilla JS only. `TextEncoder` / `TextDecoder` cover UTF-8 conversion,
and `btoa`/`atob` handle Base64. Browsers ≥ 2017 support all of these.

### Extending

- **Add an encoding** (e.g. Base32): write a `bytesTo<Name>` /
  `<name>ToBytes` pair in `tool.js`, append a textarea in `index.html`
  with id `enc-<name>`, and call `wire(<el>, parser)` plus add the new
  output line in `fromPlain` and `setPlainFromBytes`.
- **Toggle URL-encoding strictness**: replace `encodeURIComponent` with
  `encodeURI` if you want unreserved-character behaviour.

### Limitations / gotchas

- Editing one of the encoded panes uses `try/catch` and silently
  ignores invalid input. The field you're typing in is *not*
  overwritten, but the other panes stop updating until valid bytes
  appear.
- The Base64 parser tolerates whitespace but requires padding. If you
  paste an unpadded URL-safe Base64, decode it first.
- Hex parsing strips non-hex characters but rejects odd lengths.
