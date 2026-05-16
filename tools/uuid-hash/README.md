# UUID &amp; Hash Generator

> UUID v4 / v7 generation, plus MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 hashes.

## What it does

Two unrelated utilities packaged in one page:

1. **UUID generator** — produces RFC 4122 v4 (random) and RFC 9562 v7
   (time-ordered) UUIDs on demand, individually or in batches.
2. **Hash generator** — computes MD5, SHA-1, SHA-256, SHA-384, and
   SHA-512 of whatever text you type. Updates live as you type.

Both run entirely in the browser.

## User guide

### UUID features

- **New v4** — random 128-bit UUID using `crypto.randomUUID` (or
  `crypto.getRandomValues` as a fallback). RFC 4122 variant + version 4
  bits are set correctly.
- **New v7** — 48-bit Unix-millisecond timestamp + 74 random bits per
  RFC 9562 §5.7. Sorts lexicographically by creation time, which makes
  it nicer than v4 for database primary keys.
- **Batch generator** (collapsed details panel) — generate 1–100 UUIDs
  of either version in one click; result lands in a copy-friendly
  textarea.
- **Copy** buttons next to the v4 and v7 rows.

### Hash features

- Five hashes, computed in parallel: **MD5**, **SHA-1**, **SHA-256**,
  **SHA-384**, **SHA-512**.
- **Live update** with a 150 ms debounce so fast typing doesn't queue
  a hash per keystroke.
- **Per-row Copy** buttons.
- Empty input shows `—` for every row.

### How to use it

1. To grab a UUID: click **New v4** or **New v7**, then **Copy**.
2. For a batch: open **Batch generator**, set count + version, click
   **Generate**, copy the textarea.
3. To hash text: type or paste into the **Hashes** input pane. Read
   the five values below the box.

### Examples

Input `hello`:

```
MD5      5d41402abc4b2a76b9719d911017c592
SHA-1    aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d
SHA-256  2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

### Privacy

Hashing and UUID generation both run in the browser using
`SubtleCrypto.digest` (for SHA-*) and `crypto.randomUUID` /
`crypto.getRandomValues` (for UUIDs). The MD5 implementation is a
condensed copy of Joseph Myers's public-domain JS routine, embedded
in `tool.js`. **No part of your input is sent to any server.**

## Developer guide

### File layout

- `index.html` — two panels (UUID + Hashes), kv-row output rows for
  each value, batch-generator `<details>` block.
- `tool.js` — UUID v4/v7 generators, embedded MD5, `digestHex()`
  wrapper around `SubtleCrypto`, debounced hash refresh, delegated
  click handler for action and copy buttons.

### Key DOM hooks

| Selector                       | Role                                  |
| ------------------------------ | ------------------------------------- |
| `#uuid-v4` / `#uuid-v7`        | `<span>`s receiving the latest value. |
| `#uuid-count`                  | Batch count input (1–100, clamped).   |
| `#uuid-version`                | `<select>` for batch version.         |
| `#uuid-batch-out`              | Read-only batch result textarea.      |
| `#hash-in`                     | Hash input textarea.                  |
| `#h-md5`, `#h-sha1`, …, `#h-sha512` | Per-algorithm output spans.      |
| `[data-action="uuid-v4"]`      | Re-roll v4.                           |
| `[data-action="uuid-v7"]`      | Re-roll v7.                           |
| `[data-action="uuid-batch"]`   | Generate the batch.                   |
| `[data-copy-from="<id>"]`      | Clipboard-copy the text of `#<id>`.   |

### Dependencies

Vanilla JS only. Relies on the Web Crypto API
(`crypto.randomUUID`, `crypto.getRandomValues`, `crypto.subtle.digest`)
plus the embedded MD5 routine.

### Extending

- **Add SHA-3** (or any other `SubtleCrypto.digest`-supported algo):
  add a row in `index.html`, then push the new call into the
  `Promise.all([...])` in `updateHashes`.
- **Add a hex/uppercase toggle**: wrap each rendered hex string with a
  transform before assigning to `textContent`.
- **Replace MD5**: the embedded MD5 is included because SubtleCrypto
  doesn't expose it (MD5 is broken for security purposes but still
  used for integrity checksums). If you remove it, also remove the
  `#h-md5` row.

### Limitations / gotchas

- MD5 is included for compatibility, **not** because it's secure. Don't
  use it for anything where collision resistance matters.
- UUID v7's millisecond resolution means UUIDs generated in the same
  millisecond rely on the random tail for ordering — they're "mostly"
  sorted, not strictly.
- `crypto.subtle.digest` is async; the first paint shows `—` until the
  first input event fires.
