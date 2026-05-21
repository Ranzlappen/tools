# tools

A collection of small, focused utilities served from **`tools.ranzlappen.com`**.

The landing page is a static dashboard. Client-only tools deploy alongside it
via GitHub Pages. Tools that need a server (or a build step) run on Vercel at
**`api.tools.ranzlappen.com`** and are called from the browser by the relevant
tool subpage.

## Quick Reference

| Item              | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Live URL          | <https://tools.ranzlappen.com>                           |
| API URL           | <https://api.tools.ranzlappen.com> (Vercel)              |
| Fallback URL      | <https://ranzlappen.github.io/tools/>                    |
| Deploy target     | GitHub Pages (static) · Vercel (serverless functions)    |
| Default branch    | `main`                                                   |
| CI                | `pages-deploy.yml` · `security-scan.yml` · `dependency-review.yml` · `repo-sanitation.yml` |
| Standards version | v3 (full dogfood)                                        |

## Project Structure

```
.
├── index.html                  # dashboard landing page
├── assets/
│   ├── css/style.css           # design tokens, layout, glass cards, light theme
│   ├── css/backdrops.css       # 4 backdrop variants
│   ├── css/tool.css            # shared per-tool layout
│   └── js/
│       ├── main.js             # theme + backdrop toggle, persistence
│       ├── backdrop-shader.js  # WebGL plasma (lazy)
│       └── backdrop-particles.js # canvas constellation (lazy)
├── tools/                      # client-only tool subpages
│   ├── json-formatter/
│   ├── color-picker/
│   ├── regex/
│   ├── markdown/
│   ├── encoder/
│   ├── jwt/
│   └── uuid-hash/
├── api/                        # Vercel serverless functions
│   ├── health.js
│   └── README.md
├── vercel.json                 # Vercel project config
├── .vercelignore               # keep static-only paths off Vercel
├── CNAME                       # GitHub Pages custom domain
└── .github/                    # workflows + community files
```

## Tools (shipped)

All run entirely in the browser. No network call leaves the page.

| Tool                  | Description                                       |
| --------------------- | ------------------------------------------------- |
| JSON Formatter        | Pretty-print, minify, validate                    |
| Color Picker          | Pick, convert HEX/RGB/HSL/OKLCH/HSV, WCAG check   |
| Regex Tester & Builder| Live highlight + common-pattern snippet palette   |
| Markdown Preview      | Live GFM preview with copy-to-clipboard           |
| Multi-Encoder         | Base64 ↔ Hex / URL / Binary / ASCII (UTF-8 safe)  |
| JWT Decoder           | Header + payload (signature not verified)         |
| UUID & Hash Generator | UUID v4/v7 + MD5/SHA-1/SHA-256/SHA-384/SHA-512    |
| QR & Barcode Generator| QR + every common 1D/2D symbology, ECC, design, exports |

## Heavier tools (Vercel)

The `api/` directory is a separate Vercel project served at
`api.tools.ranzlappen.com`. It hosts serverless functions for tools that
can't run entirely in the browser. The current scaffold ships only a
`/api/health` smoke-test; real endpoints land per-tool as needed. See
[`api/README.md`](./api/README.md) for the deployment checklist.

## Running locally

No build step. Either open `index.html` directly, or:

```bash
python3 -m http.server 8080
# visit http://localhost:8080
```

To exercise the future API endpoints locally:

```bash
npx vercel@latest dev
# functions served on http://localhost:3000
```

A real HTTP server is preferred over `file://` because `localStorage` and
custom-domain redirects behave normally.

## Design system

Color tokens, typography, spacing scale, and transition timings are
inherited verbatim from
[`Ranzlappen/website`](https://github.com/Ranzlappen/website)'s
`assets/css/style.css` so the subdomain reads as part of the same family.
Light-theme tokens come from the same source.

## Standards

Follows
[`Ranzlappen/repo-standards`](https://github.com/Ranzlappen/repo-standards)
v3 at full compliance: CHANGELOG, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT,
GOVERNANCE, CODEOWNERS, issue forms, PR template, dependabot, security-scan
(CodeQL + gitleaks), dependency-review, repo-sanitation.

## License

[MIT](./LICENSE)
