# Cookies.txt Converter

> Turn a browser cookie export into a `yt-dlp`-ready Netscape `cookies.txt`.
> Everything happens in your browser — nothing is uploaded.

> **Cookies are as sensitive as your password.** Never share a `cookies.txt`;
> anyone who has it can use your logged-in session. Delete it when you're done.

## What it does

Tools like `yt-dlp` read authenticated sessions from a **Netscape
`cookies.txt`** file. Browser extensions can export your cookies as JSON, but
not every tool accepts that shape. This converter takes a JSON cookie export
(or a raw `Cookie:` header) and emits a clean, correctly-formatted
`cookies.txt` you can pass to `yt-dlp --cookies cookies.txt` — handy for
private playlists, especially on Android where `--cookies-from-browser`
can't reach the system browser.

**It converts cookies you already have — it can't read them itself.** A web
page can't access another site's cookies (same-origin policy), and the ones
that matter are `httpOnly` and invisible even to scripts on that site. That
capability belongs to a browser extension. Export first, then paste here.

## User guide

### Features

- **Two input formats** — a JSON array from an extension like
  "Get cookies.txt LOCALLY" / EditThisCookie, or a raw
  `name=value; name2=value2` Cookie header.
- **Auto-detect** — JSON vs. header is recognised automatically.
- **Domain for header input** — header lines carry no domain, so you supply
  one (defaults to `.youtube.com`).
- **Domain filter** — optionally keep only cookies for one domain.
- **Correct Netscape output** — `#HttpOnly_` prefixes, include-subdomains
  flag from `hostOnly`, session cookies as expiry `0`.
- **Validation** — counts cookies, flags expired ones, and warns when no
  Google login cookie is present (so you know if you're actually signed in).
- **Copy** or **Download `cookies.txt`** in one click.

### How to use it

1. Install a trusted cookie-export extension and, **while signed in to
   YouTube**, export youtube.com cookies as JSON.
2. Paste that JSON here (or a `Cookie:` header + the domain).
3. Check the status line — it tells you how many cookies converted and
   whether a login cookie was found.
4. **Download `cookies.txt`** and run
   `yt-dlp --cookies cookies.txt …` (see the YouTube MP3 Studio).

### Examples

A JSON export like:

```json
[
  { "domain": ".youtube.com", "name": "SID", "value": "…", "path": "/", "secure": true, "hostOnly": false, "expirationDate": 1893456000 }
]
```

becomes a tab-separated Netscape line:

```
.youtube.com	TRUE	/	TRUE	1893456000	SID	…
```

Click **Sample** in the tool to see a full (fake) export converted.

### Privacy

Conversion is 100% in-page — the cookies you paste are never sent anywhere,
stored, or logged. Still, treat the result as a secret: a `cookies.txt` is a
live key to your account. (The in-app help modal is the only network request
the page makes.)

## Developer guide

### File layout

- `index.html` — input textarea, domain + filter fields, the output `<pre>`,
  status banner, and copy/download buttons. One scoped `<style>` (prefix
  `ck-`).
- `tool.js` — `parseInput()` (JSON or header → records),
  `normalizeDomain()` / `expiryOf()` normalisers, `toNetscape()` formatter,
  and `render()` which paints the output (`dataset.text`) plus the status.

### Key DOM hooks

| Selector        | Role                                               |
| --------------- | -------------------------------------------------- |
| `#ck-input`     | Pasted JSON or Cookie header.                      |
| `#ck-domain`    | Domain applied to header-format input.             |
| `#ck-filter`    | Optional domain keep-filter.                       |
| `#ck-output`    | `<pre>` output; `dataset.text` holds raw file.     |
| `#ck-status`    | Validation banner (info / warn / error).           |
| `[data-action]` | `sample` / `clear` / `copy` / `download`.          |

### Dependencies

Vanilla JS only — `JSON.parse`, string formatting, a `Blob` download. No
libraries, no CDN, no backend.

### Extending

- **Accept another export shape**: extend `parseInput()` (e.g. map a Puppeteer
  cookie array's fields).
- **More validation**: add cookie names to `LOGIN_COOKIES`, or check expiry
  windows in `render()`.

### Limitations / gotchas

- It **cannot harvest cookies** — you must export them with a browser
  extension first. That's a hard browser-security boundary, not a missing
  feature.
- Header-format input has no per-cookie domain, secure, or expiry data, so it
  applies one domain to all and marks them secure/session.
- A `cookies.txt` grants account access — keep it private and delete it after
  use. Cookies also expire; re-export if downloads start failing auth.
