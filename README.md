# tools

A collection of small, focused utilities served from **`tools.ranzlappen.com`**.

The landing page is a static dashboard. Client-only tools deploy alongside it
via GitHub Pages; heavier tools that need a build step or API will run on
Vercel under the same subdomain.

## Quick Reference

| Item              | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Live URL          | <https://tools.ranzlappen.com>                           |
| Fallback URL      | <https://ranzlappen.github.io/tools/>                    |
| Deploy target     | GitHub Pages (static) · Vercel (heavier tools, later)    |
| Default branch    | `main`                                                   |
| CI                | `.github/workflows/pages-deploy.yml`                     |
| Standards version | v3 (essentials-only — full dogfood deferred)             |

## Project Structure

```
.
├── index.html                  # dashboard landing page
├── assets/
│   ├── css/style.css           # design tokens, layout, cards
│   ├── css/backdrops.css       # 4 backdrop variants
│   └── js/
│       ├── main.js             # backdrop toggle + persistence
│       ├── backdrop-shader.js  # WebGL plasma (lazy)
│       └── backdrop-particles.js # canvas constellation (lazy)
├── tools/                      # per-tool subpages land here
├── CNAME                       # custom domain
└── .github/workflows/          # Pages deploy
```

## Tools (planned)

All currently "Coming Soon" tiles on the dashboard:

- **JSON Formatter** — pretty-print, minify, validate
- **Color Picker** — pick, convert, contrast check
- **Regex Tester & Builder** — live highlight + pattern generator
- **Markdown Preview** — live GFM preview
- **Multi-Encoder** — Base64 ↔ Hex / URL / Binary / ASCII
- **JWT Decoder** — client-only header + payload view
- **UUID & Hash Generator** — UUID v4/v7, MD5/SHA-1/SHA-256/SHA-512

## Running locally

No build step. Either open `index.html` directly, or:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

A real HTTP server is preferred over `file://` because `localStorage` and
custom-domain redirects behave normally.

## Design system

Color tokens, typography, spacing scale, and transition timings are
inherited verbatim from
[`Ranzlappen/website`](https://github.com/Ranzlappen/website)'s
`assets/css/style.css` so the subdomain reads as part of the same family.

## Standards

Baseline scaffolding follows
[`Ranzlappen/repo-standards`](https://github.com/Ranzlappen/repo-standards)
v3 (essentials-only for v1; full community-files and security workflows land
in a follow-up PR).

## License

[MIT](./LICENSE)
