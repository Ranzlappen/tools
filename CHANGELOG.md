# Changelog

All notable changes to **tools** are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`/api/og` is now a small layout engine.** Refactored from a single
  hard-coded composition into layered tables: 6 named palettes
  (`green`, `slate`, `amber`, `violet`, `rose`, `mono`) each with
  dark/light variants; 4 named sizes (`og` 1200×630, `twitter`
  1200×675, `linkedin` 1200×627, `square` 1080×1080) plus custom
  `WxH`; 5 backgrounds (`blobs`, `linear`, `solid`, `dots`, `noise`);
  5 layouts (`classic`, `centered`, `hero`, `minimal`, `split`); per-
  slot show/hide for brand chip, eyebrow, divider, URL pill; HEX
  colour overrides; sans/serif/mono headline font; word-index accent
  highlighting on the headline. Driven by a hybrid query surface:
  flat `title` / `subtitle` / `theme` for the legacy / link-friendly
  knobs (these still take precedence so existing OG meta-tag URLs
  render unchanged), plus one `cfg=<base64url(JSON)>` for everything
  else. Five bundled presets (`tools-default`, `hero`, `minimal`,
  `twitter-banner`, `square-post`) cover the visual range and act as
  golden test fixtures. Malformed `cfg` returns HTTP 400 with a
  plain-text body instead of an empty PNG.
- **`scripts/test-og.mjs`** — local exerciser for `api/og.js`,
  expanded to 35 generated cases: 5 legacy regressions; the 5 × 2
  layout × theme matrix; one case per background style; one case per
  named size; one case per preset; edge cases for max-length title,
  empty title, partial HEX accent override, custom dimensions,
  all-slots-hidden, and malformed `cfg` (asserts HTTP 400 + friendly
  body). Adds a `--filter <substr>` flag for iterating on one layout
  without re-rendering the whole matrix. PNGs written to
  `scripts/_og-out/` (gitignored). Catches Satori errors before
  deploying instead of relying on the merge-deploy-error loop.
- **OG Studio "Advanced — raw cfg JSON" disclosure** — a temporary
  `<details>` block that lets you paste a `cfg` object (or click a
  preset chip to populate it) so the new engine is testable
  end-to-end live before the polished UI for layout / palette /
  background / size knobs ships in the follow-up PR.

### Fixed
- **`/api/og` returning empty PNGs.** Three Satori strictness
  regressions surfaced under `@vercel/og` after platform drift; all
  three produced silent zero-byte responses with `HTTP 200 image/png`:
  1. `width: "fit-content"` on the "LIVE · TOOLS" chip →
     `Error: Invalid value fit-content for setWidth`. Replaced with
     `alignSelf: "flex-start"`.
  2. The root `background` shorthand mixed three `radial-gradient(...)`
     entries with a trailing solid colour →
     `Error: Invalid background image: "#0b1210"`. Newer Satori treats
     `background` as `background-image` and rejects solid-colour values
     in the gradient list. Split into separate `backgroundColor` and
     `backgroundImage` declarations.
  3. The `el()` helper returned `children: []` for divs passed no
     children — Satori sees an empty array as "multiple children" and
     throws `Expected <div> to have explicit "display: flex"…`.
     Helper now omits `children` entirely when none are passed.
- **Vercel build failure** — `Error: Function Runtimes must have a valid
  version`. Vercel tightened `functions[*].runtime` validation; the
  `"nodejs20.x"` shorthand pinned for `api/health.js` is no longer
  accepted (now expects `@vercel/node@x.y.z`). Removed the `functions`
  block from `vercel.json` entirely — Node functions inherit
  `engines.node` from `package.json` (`>=20`); the Edge declarations in
  `api/og.js` and `api/ping.js` already work via in-file
  `export const config = { runtime: "edge" }`.

## [0.4.0] — 2026-05-16

### Added
- **OG Image Studio** (`tools/og-studio/`) — first API-backed tool.
  Calls `/api/og` on `api.tools.ranzlappen.com` for live 1200×630
  previews; debounced input (300 ms) with cache-bust on edits,
  canonical URL display, clipboard copy, and `fetch` → blob PNG
  download. Image theme (dark/light) is independent of page theme.
  State round-trips through `location.hash` so previews are shareable
  as deep-links.

### Fixed
- **Panels overflowing the viewport on mobile.** Root cause: the site
  header's mono `TOOLS.RANZLAPPEN.COM` meta plus the brand + theme
  toggle pushed `.site-header__inner` wider than a 412 px viewport.
  Since `.page` is a flex column, the cross-axis stretched to the
  widest child — so `.shell` (and every `.panel` / `.card` inside it)
  rendered against an over-wide track. `body { overflow-x: hidden }`
  hid the visual overflow but the geometry was still off, producing
  panels that looked ~75 % of viewport with grid backdrop bleeding
  through the gap on the right.
  - Hide the redundant URL meta under `@media (max-width: 640px)`
    (URL bar already shows it).
  - Pin `.page` and `.shell` with `width: 100%; max-width: 100%;
    min-width: 0`. The flex-column cross-axis can no longer expand
    past viewport regardless of an overflowing child.
  - Promote `body` (and add `html`) to `overflow-x: clip; max-width:
    100%` so an overflowing descendant is genuinely contained.
  - Add `min-width: 0` to grid items inside `.split` and `.kv-row`
    (long monospace hashes / matches were preventing shrink to fit).
  - Tighten shell + card + panel padding on `≤640 px` (and shell
    again on `≤380 px`); shrink tool title + icon; collapse `.kv-row`
    columns on `≤420 px`.
  - `.match-list li` gets `word-break: break-word; overflow-wrap:
    anywhere` so long regex matches wrap inside their pill.

### Changed
- **Brand mark + favicon adopted from Ranzlappen.com.** Replaced the
  inline SVG "A" placeholder and the data-URI favicon with
  `assets/icon.png` (6.2KB transparent PNG of the canonical R-shield
  from `Ranzlappen/website/main/assets/images/icon_alpha.png`).
  Brand-mark chrome dropped — image renders without the accent-tinted
  box. Proper `<link rel="icon">` + `<link rel="apple-touch-icon">`
  tags in every page.
- **Mobile container overflow fix.** `.textarea` was `white-space: pre`
  which made any long input line require horizontal scroll inside the
  textarea (and read as overflow on narrow viewports). Now uses
  `white-space: pre-wrap; word-break: break-word; overflow-wrap:
  anywhere` so long markdown lines, URLs, and JSON values wrap.
- **Performance, round two.** After the v0.4 pass and the single-backdrop
  reduction, the page was still laggy on mobile. Three more cuts:
  - **Dropped `backdrop-filter` entirely from `.card` and `.panel`.**
    Even at `blur(8px)`, each glass surface forced a new compositor
    layer that repainted as the user scrolled cards/panels past the
    fixed backdrop. Replaced with a more-opaque solid background
    (`rgba(var(--c-bg-rgb), 0.88)`); visually similar, paint-cost
    near-zero.
  - **Dropped the `.grid-bg__plane` pan animation** (`grid-pan 14s
    linear infinite`). Animating `background-position` on a
    perspective-transformed, masked element repainted the plane every
    frame. Grid is static now; perspective look preserved.
  - **Spotlight + cursor tracking off on touch.** `.grid-bg__spot`
    hidden under `@media (hover: none), (pointer: coarse)`; main.js
    skips the `pointermove` listener entirely on coarse-pointer
    devices.
- **Single backdrop.** Removed aurora, WebGL shader, and constellation
  particles; kept only the cyberpunk perspective grid. The backdrop pill
  toggle is gone — backdrop is no longer user-switchable. `localStorage`
  key `tools:backdrop` is no longer read or written.
- **Mobile URL-bar jump fixed.** `.grid-bg__plane`'s `height: 140vh`
  changed to `140lvh` (large-viewport height — stable across iOS Safari
  and Android Chrome dynamic URL-bar collapse). The plane projection
  no longer recomputes as the URL bar slides in/out.
- Simplified pre-paint script in every `<head>` to theme-only.
- Simplified `main.js`: dropped `setBackdrop`, lazy-import logic, and
  arrow-key navigation for the pill.
- `<html>` no longer carries `data-backdrop="aurora"`.

### Removed
- `assets/js/backdrop-shader.js` — WebGL plasma. Deleted.
- `assets/js/backdrop-particles.js` — canvas constellation. Deleted.
- `<aside class="backdrop-pill">` from all 8 HTML files.
- All `.backdrop-pill*`, `.aurora__*`, `.is-aurora`, `.is-shader`,
  `.is-particles`, and `.backdrop-layer` CSS rules.

### Changed
- **Performance pass.** Stripped the worst compositor offenders so the
  site is usable on real hardware:
  - Dropped the outer `filter: blur(80px) saturate(120%)` on the aurora
    layer (was triple-blurring the already-soft blob gradients).
  - Removed the `.aurora__grain` SVG-turbulence overlay (an
    `inset: -50%`, `filter: contrast(140%)`, `mix-blend-mode: overlay`
    element for a barely-visible film grain — not worth the paint cost).
    Stripped the matching `<div class="aurora__grain">` from the
    dashboard and all 7 tool subpages.
  - Reduced aurora blob size (`55vmax` → `45vmax`) and opacity
    (`0.55` → `0.42` dark, `0.35` → `0.30` light).
  - Card `backdrop-filter` reduced from `blur(14px) saturate(140%)` to
    `blur(8px)`. Same change on `.panel` (tool subpages) and
    `.backdrop-pill`. Card background opacity nudged up to compensate.
  - Dropped `transition: background 0.1s linear` on `.grid-bg__spot` —
    forced a 100ms paint on every cursor move.
- Cursor-tracked `--mouse-x` / `--mouse-y` CSS vars now update only
  when the grid backdrop is active (was a style recalc per pointermove
  on every backdrop).

### Added
- `@media (prefers-reduced-transparency: reduce)` blocks in
  `backdrops.css`, `style.css`, and `tool.css`. Honors the OS opt-out
  signal: freezes backdrop animations, drops blob opacity to 0.15,
  removes all `backdrop-filter` blurs, swaps cards/panels/pill for
  solid opaque surfaces.

### Removed
- OpenSSF Scorecard job from `security-scan.yml` and the
  `branch_protection_rule:` trigger that only existed to re-evaluate
  it. Workflow now runs CodeQL + gitleaks only.
- Scorecard references in `README.md`, `.github/GOVERNANCE.md`, and
  `.github/workflows/dependency-review.yml` comment.

## [0.3.0]

### Added
- Hero-style Open Graph image (`assets/og.png`, 1200×630, 92KB) with
  aurora-blob backdrop and accent-gradient title; SVG source committed
  alongside for re-renders. Wired into `<head>` of the dashboard and
  all 7 tool subpages (og:title/description/url per-page,
  twitter:card=summary_large_image).
- `.github/FUNDING.yml` — GitHub Sponsors (`Ranzlappen`) + Ko-fi
  (`ranzlappen`). Surfaces the Sponsor button on the repo page.
- Vercel deploy automation:
  - **Native GitHub integration** documented step-by-step in
    `api/README.md` (project import + DNS CNAME + smoke tests).
  - **Actions fallback** at `.github/workflows/vercel-deploy.yml` —
    Vercel CLI flow, skips cleanly when `VERCEL_TOKEN` / `VERCEL_ORG_ID`
    / `VERCEL_PROJECT_ID` secrets are absent.
- Two new API endpoints:
  - `/api/ping` (edge) — latency probe returning `{ ok, ts, region,
    runtimeMs }`.
  - `/api/og` (edge) — dynamic Open Graph generator via `@vercel/og`
    0.6.5. Query params: `title`, `subtitle`, `theme=dark|light`.
    1h edge cache. Hand-built element tree (no JSX).
- `package.json` at repo root listing `@vercel/og` as the only dep so
  the Vercel build installs it; the static Pages site stays
  dependency-free.

### Changed
- `vercel.json`: scoped the `nodejs20.x` runtime pin to
  `api/health.js` only so edge-runtime declarations in `og.js` /
  `ping.js` take effect.
- `CLAUDE.md`: refreshed standards-compliance summary to include
  FUNDING.yml; OG-image size note relaxed for the hero asset.

## [0.2.0]

### Added
- Light-mode toggle wired through CSS custom properties (`[data-theme="light"]`),
  with pre-paint sync script to prevent FOUC and a sun/moon button in the
  header. Tokens copied verbatim from `Ranzlappen/website`.
- Seven fully functional, client-only tool subpages under `tools/<slug>/`:
  JSON Formatter, Color Picker, Regex Tester & Builder, Markdown Preview,
  Multi-Encoder, JWT Decoder, UUID & Hash Generator.
- Shared per-tool layout stylesheet (`assets/css/tool.css`) — back link,
  panes, copy buttons, swatches, contrast badges, warning banners.
- Vercel scaffold for future `api.tools.ranzlappen.com` hostname: `vercel.json`,
  `.vercelignore`, `api/health.js` smoke-test function, and `api/README.md`
  documenting the two-hostname architecture.
- Full repo-standards v3 dogfood: `CHANGELOG.md`, `.github/CONTRIBUTING.md`,
  `.github/SECURITY.md`, `.github/CODE_OF_CONDUCT.md` (full Contributor
  Covenant 2.1), `.github/GOVERNANCE.md`, `.github/CODEOWNERS`,
  `.github/pull_request_template.md`, issue forms (bug, feature, question),
  `security-scan.yml`, `dependency-review.yml`, `repo-sanitation.yml`.

### Changed
- Root dashboard cards now link to working tool subpages; "Coming soon"
  pills replaced with subtle "Open →" affordances.
- `pages-deploy.yml` adds path filters so it no longer re-deploys when
  only `api/**` changes.
- `README.md` and `CLAUDE.md` updated to reflect full v3 compliance and
  the Vercel hostname split.

## [0.1.0] — 2026-05-16

### Added
- Initial static dashboard at `tools.ranzlappen.com`.
- Seven named "Coming Soon" tool tiles in a responsive glass grid.
- Four runtime-switchable backdrops (aurora CSS blobs, WebGL plasma
  shader, canvas constellation, cyberpunk perspective grid) with
  localStorage persistence, lazy-loaded canvas modules, and
  `prefers-reduced-motion` respect.
- Design tokens copied verbatim from `Ranzlappen/website` for visual
  cohesion across the family.
- GitHub Pages deploy workflow with all actions pinned to 40-char SHAs.
- Essentials-only repo-standards v3 scaffolding (README, LICENSE,
  CLAUDE.md, `.standards-version`, `.gitignore`, `.nojekyll`, CNAME,
  dependabot).

<!--
Workflow:
  1. Append to [Unreleased] as you merge PRs.
  2. When cutting a release, rename [Unreleased] to [X.Y.Z] — <date>
     and add a fresh empty [Unreleased] heading at the top.
  3. Update the comparison links at the bottom of this file.
  4. Tag the merge commit (e.g. `git tag -a vX.Y.Z -m "vX.Y.Z"`).

Sections to use (omit any that don't apply for a given release):
  Added | Changed | Deprecated | Removed | Fixed | Security
-->

[Unreleased]: https://github.com/Ranzlappen/tools/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Ranzlappen/tools/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Ranzlappen/tools/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Ranzlappen/tools/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ranzlappen/tools/releases/tag/v0.1.0
