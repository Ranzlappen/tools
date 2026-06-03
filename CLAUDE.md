# CLAUDE.md

Architectural notes for AI assistants working on this repo.

## What this is

`tools.ranzlappen.com` — a static landing dashboard plus twelve working
utilities (JSON formatter, color picker, regex tester, markdown
preview, multi-encoder, JWT decoder, UUID/hash generator, QR/barcode
generator, video studio, OG image studio, metadata studio, Flipper GUI
studio). Eleven run entirely in the browser; OG Image Studio is the
first to call an API (`/api/og` on `api.tools.ranzlappen.com`, served by
Vercel). Video Studio, Metadata Studio, and the Markdown file-importer
lazy-load their format libraries from pinned CDNs on first use, so the
first-paint budget is unaffected.

## Hosting

- **GitHub Pages** — `tools.ranzlappen.com`, static (dashboard + every
  current tool subpage). Custom domain via `CNAME`. Tools live at the root,
  `tools.ranzlappen.com/<slug>/` (no `/tools/` segment). The old
  `/tools/<slug>/` paths survive as tiny no-index redirect stubs under
  `tools/` that bounce to the flat URL.
- **Vercel** — `api.tools.ranzlappen.com`, serverless functions for tools
  that need a backend. Scaffold exists (`api/`, `vercel.json`,
  `.vercelignore`); no tool depends on it yet.

## Stack constraints

- **No build step.** Everything is hand-written HTML/CSS/JS.
- **No frameworks.** No React, no jQuery, no bundler.
- **Single CSS file per concern.** `style.css` (layout) + `backdrops.css`
  (animated backgrounds). Tokens live at the top of `style.css`.
- **JS is split by load priority.** `main.js` always loads.
  `backdrop-shader.js` and `backdrop-particles.js` lazy-load only when the
  user selects that backdrop.
- **Animations on `transform` / `opacity` / `filter` only.** No
  width/height/top/left animations.

## Design tokens

Color palette, fonts, spacing, radii, and transition timings are copied
verbatim from `Ranzlappen/website`'s `assets/css/style.css` so this
subdomain reads as part of the same family. If you change a token here,
think twice — drift from the parent is the cost.

## Backdrop system

Single backdrop: a CSS-only cyberpunk perspective grid (sky + plane +
scanlines + cursor-tracked spotlight). No runtime switching, no toggle UI.
The plane uses `lvh` (large-viewport height) so it doesn't reshape when
mobile URL bars collapse. Respect `prefers-reduced-motion` and
`prefers-reduced-transparency` everywhere.

## Header & footer

One source of truth: `assets/js/partials.js` holds the canonical site
header (brand `tools.ranzlappen`, the ranzlappen.com button, search/theme/
pin controls) and footer (links, project favicons, support, social,
cookie/storage controls), and injects them into `.page` (header first,
footer last) plus the search/storage modals at `<body>` end. Pages ship a
bare `<div class="page"><main>…</main></div>` — **no inline header/footer**.
`partials.js` is a `defer` classic script listed *before* the `main.js`
module, so it injects before `main.js` wires the control IDs. Edit the
chrome once here; every page inherits it. The footer is kept in visual
parity with `Ranzlappen/website`'s footer.

## Adding a new tool

1. Add a card to the grid in `index.html` (`href="./<slug>/"`). Match
   existing card markup.
2. Create `<slug>/index.html` at the repo root (URL becomes
   `tools.ranzlappen.com/<slug>/`). Re-import `/assets/css/style.css` for
   visual consistency. The shared site header and footer are **injected at
   runtime** by `assets/js/partials.js` — do **not** inline them (see
   **Header & footer**); just reuse the `<div class="page">` wrapper and the
   end-of-body script block from any existing page. Use absolute
   `/assets/...` paths so refs stay depth-independent.
3. Add a matching entry to `assets/search.json`
   (`{title, url:"/<slug>/", description, group:"Tools"}`) or the
   on-site search won't find the new tool.
4. Keep each tool self-contained — no shared state, no shared JS unless it
   genuinely belongs in `assets/js/`.
5. Client-only? Stays on Pages. Needs a server / build step? Plan for
   Vercel and document the routing.
6. Write `<slug>/README.md` using the template in
   `json-formatter/README.md` (User guide + Developer guide).
   This is **mandatory** — the in-app info modal expects it.
7. Wire the info modal into the tool's `<header>` — add a
   `<button class="info-btn" data-info-button>` next to `.tool-title__text`
   and include `<script type="module" src="/assets/js/info-modal.js">`.
   The modal fetches `./README.md` by default.
8. Smoke-test the tool at a 360 px viewport before shipping. If
   anything clips the right edge, the fix is almost always
   `minmax(0, 1fr)` on the offending grid track or a `.scroll-x`
   wrapper on wide content — not a custom per-tool media query.

## Tool documentation

Every tool ships with a `<slug>/README.md` rendered by
`assets/js/info-modal.js` (marked + DOMPurify, lazy-loaded with SRI).
Keep the markdown plain GFM — no raw HTML, no remote images, no inline
scripts. Sections expected: *What it does* · *User guide* (features, how
to use, examples, privacy) · *Developer guide* (file layout, DOM hooks,
dependencies, extending, limitations).

## Branching

- `main` — production, deployed by `pages-deploy.yml` on every push.
- Feature work goes on `claude/<slug>` or similar; merge to `main` via PR.
- Never force-push `main`.

## Standards

This repo follows `Ranzlappen/repo-standards` v3 at **full** compliance.
Files present:

- Root: `README.md`, `LICENSE`, `CLAUDE.md`, `CHANGELOG.md`,
  `.standards-version`, `.gitignore`, `.nojekyll`, `CNAME`, `vercel.json`,
  `.vercelignore`, `package.json`.
- `.github/`: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `GOVERNANCE.md`, `CODEOWNERS`, `FUNDING.yml`,
  `pull_request_template.md`, issue forms (`bug.yml`, `feature.yml`,
  `question.yml`, `config.yml`), `dependabot.yml`.
- Workflows: `pages-deploy.yml`, `security-scan.yml`,
  `dependency-review.yml`, `repo-sanitation.yml`, `vercel-deploy.yml`.
- Assets: `assets/og.png` (1200×630 hero card) + `assets/og.svg`
  (source).
- Icons: `site.webmanifest` + `icons/` set (`favicon.ico`,
  `favicon-16x16/32x32.png`, `apple-touch-icon.png`,
  `icon-192/512.png`, `icon-maskable-192/512.png`) from the shared
  "icon universe" wrench-emblem master; every page head links them via
  absolute `/icons/...` paths. The header brand mark in `partials.js`
  reuses `assets/icon.png` (a 64px downscale of the same master). Footer
  project favicons are 48px PNG downscales of each brand master in
  `assets/favicons/` (no more green SVGs).

## Performance budget

- Total page weight on first paint: keep < 100 KB (HTML + CSS + main.js).
- Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95,
  SEO ≥ 90.
- Lazy-loaded backdrop scripts excluded from the first-paint budget but
  each must stay < 5 KB.

## Don'ts

- Don't introduce a build step without a strong reason — Pages stops being
  trivial the moment you do.
- Don't add per-card event listeners — delegate from the grid.
- Don't animate properties that trigger layout/paint.
- Don't use bare `1fr` for mobile-collapsed grid tracks that can
  contain wide content (canvas, long strings, code). Use
  `minmax(0, 1fr)` so the track can shrink below its content's
  intrinsic min size. `tool.css` already zeroes `min-width` on
  descendants of `.tool-main` / `.panel` / `.shell`, and turns
  `<table>` inside `.panel` into a horizontal-scroll container —
  rely on those defaults; only opt out if you know better.
- Don't commit binaries beyond what the page actually needs. The OG
  hero card is allowed up to ~100 KB (gradients don't compress well in
  PNG); other binaries should stay under 50 KB.

## Post-task self-check

Before declaring a task done, confirm:

- [ ] Pages still deploys (workflow green, custom domain serves 200).
- [ ] Dashboard renders with all 4 backdrops; switching works and persists.
- [ ] `prefers-reduced-motion: reduce` freezes all motion.
- [ ] No console errors on a clean load.
- [ ] No new top-level dependencies / build tools introduced silently.
- [ ] CLAUDE.md still under 200 lines (this file).
- [ ] If you added a tool: its card links to a working subpage.
- [ ] If you added or changed a tool: its `README.md` is present and the
      info button opens it in the modal.
- [ ] Tool READMEs use only GFM (no raw HTML / no remote images).
