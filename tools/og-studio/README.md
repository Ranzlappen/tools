# OG Image Studio

> Compose 1200×630 social cards via the edge — title, subtitle, theme,
> instant preview.

## What it does

Compose a social card — title, subtitle, brand chip, eyebrow, URL
pill, layout, size, font, colour palette, and background — and the
tool calls `/api/og` on `api.tools.ranzlappen.com` (Vercel) to render
the image. The preview updates as you type. State round-trips through
the URL hash so previews are shareable as deep-links.

Unlike the other tools, this one **does** call a server — it's the
first API-backed tool on `tools.ranzlappen.com`. Every field you change
from its default is sent to the render function as a query parameter
(see *Privacy* below).

## User guide

- **Presets** — one-click starting points (`tools-default`, `hero`,
  `minimal`, `twitter-banner`, `square-post`).
- **Content** — title, subtitle (with live character counters), a
  brand chip (icon + name + sub), an eyebrow line, a URL pill, and a
  divider toggle. Each of the chip / eyebrow / URL blocks can be shown
  or hidden.
- **Layout** — `classic`, `centered`, `hero`, `minimal`, `split`.
- **Size** — `og` (1200×630), `twitter` (1200×675), `linkedin`
  (1200×627), `square` (1080×1080), or `custom` (600–2400 px each axis).
- **Font** — `sans`, `serif`, `mono`.
- **Colour** — a named palette (`green`, `slate`, `amber`, `violet`,
  `rose`, `mono`) plus optional per-role HEX overrides (bg / text /
  muted / accent / accent2) and an accent-word highlight in the title.
- **Background** — `blobs`, `linear` (with adjustable angle), `solid`,
  `dots`, or `noise`.
- **Image theme** (dark / light) is independent of the page theme so
  you can preview both without leaving dark mode.
- **Live preview** — debounced 300 ms with cache-bust on edits so the
  rendered image refreshes without browser caching getting in the way.
- **Canonical URL display** — the exact API call is shown; copy with
  one click.
- **PNG download** via `fetch` → blob.
- **State in `location.hash`** — every edit updates the hash so the
  current preview is shareable as a deep-link.

### How to use it

1. (Optional) Click a **Preset** to start from a finished card.
2. Fill in **Content** — title, subtitle, and any brand / eyebrow /
   URL text you want shown.
3. Tune **Layout & size**, **Font**, **Colour**, and **Background**.
4. Watch the preview update (300 ms debounce).
5. **Copy URL** to grab the canonical `/api/og?…` link, or
   **Download PNG** to save the image.

### Examples

A minimal card with only a title and subtitle produces a short URL:

```
https://api.tools.ranzlappen.com/api/og?title=Hello&subtitle=World
```

Changing the layout, palette, and brand name adds a single packed
`cfg` parameter that encodes just the non-default fields:

```
https://api.tools.ranzlappen.com/api/og?title=Hello&cfg=eyJsYXlvdXQiOiJoZXJvIiwicGFsZXR0ZSI6InNsYXRlIn0
```

### Privacy

This is the only tool on the dashboard that calls a server. The Vercel
function at `api.tools.ranzlappen.com/api/og` receives the title,
subtitle, and image theme as plain query parameters, plus a single
`cfg` parameter that encodes **every other field you changed from its
default** — brand text, eyebrow text, the URL-pill text, layout,
palette, any custom HEX colours, background, size, and font. Only
non-default fields are transmitted. There are no cookies, no auth, and
no logging of payload contents, but treat anything you type into these
fields as data that leaves your browser.

## Developer guide

### File layout

- `index.html` — collapsible `<details>` sections (Content, Layout &
  size, Style), preset chips, preview pane, action row. Tool-specific
  styling is inlined in a `<style>` block in the `<head>`.
- `tool.js` — `DEFAULTS` state mirror, debounced input handler, the
  `diffCfg()` / `encodeCfg()` URL builder, hash-state round-trip
  (flat-readable below a budget, base64url `#c=` fallback above it),
  and the blob-download helper.

### Key DOM hooks

| Selector                       | Role                                       |
| ------------------------------ | ------------------------------------------ |
| `#og-title` / `#og-subtitle`   | Headline fields (+ `…-count` counters).    |
| `#og-brand-icon/-name/-sub`    | Brand-chip fields; `#og-brand-show` toggle.|
| `#og-eyebrow-text` / `-show`   | Eyebrow line + visibility toggle.          |
| `#og-url-text` / `-show`       | URL pill text + visibility toggle.         |
| `#og-divider`                  | Divider-line toggle.                       |
| `[data-preset]`                | Preset chips.                              |
| `[data-layout]` / `[data-size]`| Layout / size chips.                       |
| `#og-custom-w` / `#og-custom-h`| Custom-size inputs (shown for `size=custom`).|
| `[data-action="sample"]` / `"reset"` | Sample / reset buttons.              |

### Client-side dependencies

**None.** The card is rendered server-side by the edge function, so the
page loads no CDN libraries — only `main.js`, `info-modal.js`, and
`tool.js`. This is why OG Image Studio has no SRI block: there's
nothing third-party to pin.

### API contract

`GET /api/og?title=…&subtitle=…&theme=dark|light&cfg=…` → PNG at the
selected size.

- `title`, `subtitle`, `theme` are sent flat (link-friendly, and the
  server prioritises them).
- `cfg` is a base64url-encoded JSON object of **only** the fields that
  differ from `DEFAULTS` (layout, palette, bg, size, font, colours,
  brand, eyebrow, url, …). Built by `diffCfg()` + `encodeCfg()`.

The function lives under `api/og.js` in this repo (served by Vercel at
`api.tools.ranzlappen.com`). See `vercel.json` for routing. The
`DEFAULTS` object in `tool.js` must stay in sync with the server's.

### Extending

- **New parameter:** add a control in `index.html`, a field in the
  `DEFAULTS` object in `tool.js` (so `diffCfg()` picks it up), and
  accept it in `api/og.js`.
- **New layout / palette / background:** add the chip in `index.html`,
  the allowed value to `tool.js`, and the rendering branch in
  `api/og.js`.

### Limitations

- Requires the API to be deployed at `api.tools.ranzlappen.com`. If
  the function is down, the preview will show a load error.
- Image theme is enforced by the API, not the browser — light/dark
  here is a query-param flip, not a CSS toggle.
