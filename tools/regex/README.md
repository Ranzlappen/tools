# Regex Tester &amp; Builder

> Live match highlighting with a builder palette for the patterns you reach for most.

## What it does

Type a JavaScript regular expression and a test string. The tool
compiles the pattern, highlights every match inline, lists each match
with its capture groups, and — if you want — runs a replacement pass.
A palette of common pre-built patterns (email, URL, IPv4, UUID,
semver, …) sits one click away. Everything happens in your browser
via the `RegExp` constructor.

## User guide

### Features

- **Pattern input** rendered between mock `/` delimiters with the
  active flags shown to the right.
- **Flag chips** — toggle any of `g i m s u y`. Selecting `y` while
  `g` is on auto-removes `g` (they're mutually exclusive in `RegExp`).
- **Live match highlighting** in the right pane as you type.
- **Match list** — index, value, byte offset, numbered groups (`$1`,
  `$2`, …) and named groups.
- **Match count** in the panel header (`N matches` / `1 match` /
  `No matches`).
- **Snippet palette** — click any chip to load a battle-tested
  pattern (email, URL, IPv4, ISO date, phone, hex colour, UUID,
  semver, whitespace-only lines).
- **Replace mode** (collapsed by default) — supports `$1`, `$2`, `$&`
  back-references via `String.prototype.replace`.
- **Invalid pattern** errors surface in a red banner with the engine
  message verbatim.

### How to use it

1. Pick a snippet chip *or* type a pattern between the `/` markers.
2. Toggle the flag chips you need (`g` is on by default).
3. Drop a test string into the **Input** textarea on the left.
4. Read matches on the right. Expand **Replace mode** if you need to
   produce a transformed string.

### Examples

Pattern `\b\w+@\w+\.\w+\b` with flags `g`, input:

```
Email: ada@example.com
Visit https://ranzlappen.com
IP 10.0.0.1 today.
```

Highlighted match: `ada@example.com`. Match list shows
`0 ada@example.com @7`. Count: `1 match`.

Pattern `(\d{4})-(\d{2})-(\d{2})` with replacement `$3/$2/$1` →
`2026-05-16` becomes `16/05/2026`.

### Privacy

Pure client-side. The pattern is compiled with `new RegExp(...)` and
the test string is matched in your browser; nothing is transmitted.

## Developer guide

### File layout

- `index.html` — pattern input, flag-chip row, snippet container,
  input/highlight split, match list, collapsible replace mode.
- `tool.js` — compile + run on every input, render highlights, build
  the match list, snippet palette injected at startup.

### Key DOM hooks

| Selector            | Role                                           |
| ------------------- | ---------------------------------------------- |
| `#re-pattern`       | Pattern text input.                            |
| `#re-flags`         | `<span>` showing active flags.                 |
| `#re-input`         | Test-string textarea.                          |
| `#re-highlight`     | Render target for highlighted matches.         |
| `#re-matches`       | `<ul>` populated with one `<li>` per match.    |
| `#re-count`         | Match count caption.                           |
| `#re-error` / `#re-error-text` | Invalid-pattern banner.             |
| `#re-replace`       | Replacement template input.                    |
| `#re-replaced`      | Read-only replaced output.                     |
| `#re-snippets`      | Chip container, populated from `SNIPPETS`.     |
| `[data-flag="…"]`   | Flag toggle chips.                             |
| `[data-snippet="…"]`| Snippet chips (populated from `SNIPPETS`).     |

### Dependencies

Vanilla JS only. Uses the built-in `RegExp` constructor and
`String.prototype.replace` for replace mode.

### Extending

- **Add a snippet**: push an object `{ name, pattern }` into the
  `SNIPPETS` array near the top of `tool.js`. The chip is rendered
  automatically.
- **Add a flag**: add a `<button class="chip" data-flag="x">` to the
  flag row in `index.html`. The delegated click handler already
  toggles it in the `flags` `Set`.
- **Cap match count**: the `safety++ < 10000` guard in the global-loop
  prevents runaway patterns; tune that number if you really need more.

### Limitations / gotchas

- JS regex only — no Perl-style modifiers (no `x` extended), no
  look-behind in older Safari builds.
- The highlighted pane renders into an `innerHTML`; the input string is
  HTML-escaped first via `escapeHtml`. Don't bypass that helper.
- An empty match in global mode advances `lastIndex` by 1 manually to
  prevent infinite loops (see `if (m[0] === "") r2.lastIndex++;`).
