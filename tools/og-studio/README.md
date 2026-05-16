# OG Image Studio

> Compose 1200×630 social cards via the edge — title, subtitle, theme,
> instant preview.

## What it does

Type a title and subtitle, pick a theme, and the tool calls
`/api/og` on `api.tools.ranzlappen.com` (Vercel) to render a 1200×630
PNG. The preview updates as you type. State round-trips through the
URL hash so previews are shareable as deep-links.

Unlike the other tools, this one **does** call a server — it's the
first API-backed tool on `tools.ranzlappen.com`. The function only
sees your title/subtitle/theme; no other data leaves the page.

## User guide

### Features

- **Live preview** — debounced 300 ms with cache-bust on edits so the
  rendered image refreshes without browser caching getting in the way.
- **Canonical URL display** — the exact API call is shown; copy with
  one click.
- **PNG download** via `fetch` → blob.
- **Image theme** (dark / light) is independent of the page theme so
  you can preview both without leaving dark mode.
- **State in `location.hash`** — every edit updates the hash so the
  current preview is shareable as a deep-link.

### How to use it

1. Type a **title** and **subtitle**.
2. Pick an **image theme** (dark or light).
3. Watch the preview update. Wait for the debounce (300 ms).
4. **Copy URL** to grab the canonical `/api/og?…` link, or
   **Download PNG** to save the image.

### Privacy

This is the only tool on the dashboard that calls a server. The Vercel
function at `api.tools.ranzlappen.com/api/og` receives only the query
parameters (title, subtitle, theme). No cookies, no auth, no logging
of payload contents.

## Developer guide

### File layout

- `index.html` — input fields, theme picker, preview pane, action row.
- `tool.js` — debounced input handler, URL builder, hash-state
  round-trip, blob-download helper.

### API contract

`GET /api/og?title=…&subtitle=…&theme=dark|light` → 1200×630 PNG.

The function lives under `api/og.js` in this repo (served by Vercel at
`api.tools.ranzlappen.com`). See `vercel.json` for routing.

### Extending

- **New parameter:** add an input in `index.html`, wire it into the
  URL builder in `tool.js`, and accept it in `api/og.js`.
- **New theme:** add it to the theme picker and to the theme branch in
  `api/og.js`.

### Limitations

- Requires the API to be deployed at `api.tools.ranzlappen.com`. If
  the function is down, the preview will show a load error.
- Image theme is enforced by the API, not the browser — light/dark
  here is a query-param flip, not a CSS toggle.
