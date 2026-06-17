# Changelog

All notable changes to **tools** are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Installable PWA (offline-capable).** Added a root `site.webmanifest`
  (standalone display, brand colors), a hand-written dependency-free service
  worker (`sw.js`) that precaches the app shell and serves an `offline.html`
  fallback for un-cached navigations, and `assets/icon-192.png` /
  `assets/icon-512.png` install icons (rendered from `favicons/tools.svg`).
  Every real page links the manifest + apple-mobile-web-app meta tags;
  `main.js` registers the service worker on `load`. No build step, no Workbox.

### Changed
- **Header `ranzlappen.com` button collapses to a favicon on small screens.**
  The text label took too much room in the mobile header, so at ≤640px the
  button now shows just the main-site favicon (`assets/favicons/ranzlappen.png`,
  a 48px downscale of the parent's icon-universe emblem); the text label +
  external-arrow are restored on wider viewports. Precached by `sw.js`
  (`CACHE_VERSION` → `tools-v7`).
- **Flattened tool URLs: `/tools/<slug>/` → `/<slug>/`.** The redundant
  `tools/` path segment is gone; every tool now lives at the repo root
  (`tools.ranzlappen.com/<slug>/`). Old paths survive as no-index
  meta-refresh redirect stubs under `tools/` so bookmarks/links keep working.
  Updated dashboard cards, `assets/search.json`, in-tool cross-links, and the
  Flipper `.fam` export URL accordingly.
- **Header & footer refactored to a single source of truth.** The inline,
  per-page header/footer are removed; `assets/js/partials.js` now injects the
  canonical header (brand standardized to `tools.ranzlappen` everywhere) and
  footer into `.page` on every page. The footer was brought back into visual
  parity with `Ranzlappen/website` (accent "Support My Work" button, copyright
  separator, 🛡️/🍪 cookie controls).
- The header's **ranzlappen.com link is now a button** and stays visible on
  mobile (compact).

### Fixed
- **Unpinned header pin no longer scrolls away.** When the header was unpinned,
  its solid-state `backdrop-filter` established a containing block that trapped
  the `position: fixed` pin, dragging it off-screen after a few inches; the
  filter is now dropped while unpinned so the pin stays viewport-fixed.

### Added
- **Video Studio expansion (`video/`).** A new default **Trim & convert** mode
  (no longer forces a reverse), plus **output types** — MP4/WebM video, **GIF**
  (single-pass `palettegen`/`paletteuse`), single **PNG frame**, **PNG
  frame-sequence**, and **audio (m4a)**. New transforms: scale (1080/720/480),
  centred crop (1:1/9:16/16:9), rotate (90°/180°), flip (H/V), colour presets
  (warm/cool/vivid/grayscale/sepia), fade in/out, and output FPS. **Frame-perfect
  editing**: a source-FPS field (auto-corrected from ffmpeg's input log) drives a
  `frame A → B` trim readout, frame-snapped trim, and ◀/▶ one-frame nudge buttons.
  The frame-sequence export renders a thumbnail gallery with per-frame download
  and a lazy-loaded **Download all (.zip)** (`fflate`, with an individual-download
  fallback). Filters use a hybrid model — mode/loop stay a labelled-pad graph,
  everything else is a comma-joined linear segment.
- **YouTube MP3 Studio (`tools/youtube-mp3/`).** A client-side builder for
  `yt-dlp` commands: max-quality MP3 (up to 320 kbps / VBR), M4A/Opus/best,
  embedded thumbnail/metadata/chapters, SponsorBlock removal, single-video or
  full-playlist scope with an item range, output templates, parallel
  fragments, and private-playlist auth via `--cookies-from-browser` (desktop)
  or `--cookies cookies.txt` (Android/Termux). Presets, one-click copy, and
  per-platform install snippets (incl. Termux). A hosted in-browser ripper
  isn't viable (CORS/signature deciphering) or safe for private playlists
  (cookies must stay local), so the tool generates the exact command to run
  locally instead. Pure vanilla JS — no deps, no backend; stays on Pages.
  Also includes an **optional, read-only "Sign in with Google"** flow
  (`yt-oauth.js`): it lists your **Liked videos** or any playlist via the
  YouTube Data API and emits a `urls.txt` + `-a urls.txt` command so those
  videos download **without cookies** (the list is private but the videos are
  public). The OAuth token stays in memory only; nothing leaves the page
  unless you sign in. Needs a one-time Google Cloud OAuth client (`CLIENT_ID`
  in `yt-oauth.js`); blank by default, and the tool works without it.
- **Cookies.txt Converter (`tools/cookies-txt/`).** Companion tool that turns
  a browser cookie export (extension JSON or a raw `Cookie:` header) into a
  `yt-dlp`-ready Netscape `cookies.txt` — `#HttpOnly_` prefixes,
  include-subdomains from `hostOnly`, session cookies as expiry `0`, optional
  domain filter, and validation (counts, expired, login-cookie presence).
  Copy or download in one click. 100% in-page; it converts cookies you export
  yourself and never harvests or uploads them. Cross-linked with the MP3
  Studio.

### Changed
- **Disclaimer hardening on the download-helper tools.** YouTube MP3 Studio
  and Cookies.txt Converter now show a one-time "I understand" acknowledgement
  gate before use — a native `<dialog>` whose acceptance is stored locally and
  versioned (re-prompts on a material wording change; Esc / backdrop-click
  can't bypass it). Also tightened the inline responsible-use banners and added
  a *Legal & responsible use* section to each tool's README. New shared,
  attribute-driven `assets/js/disclaimer-gate.js` (vanilla, no deps).

### Security
- **OG Studio prototype-pollution hardening.** CodeQL flagged
  `applyPartial()` in `tools/og-studio/tool.js` as "Remote property
  injection (high)" because it iterated `Object.keys(partial)` and
  wrote `state[k] = …` where `partial` could flow from
  `location.hash` (a `#c=<base64>` blob → arbitrary JSON keys
  including `__proto__` / `constructor`). Replaced the open
  iteration with an explicit allow-list of known top-level keys plus
  per-nested-object sub-key allow-lists; uses
  `Object.prototype.hasOwnProperty.call` so prototype-chain hits are
  ignored. Crafted hash payloads can no longer pollute
  `Object.prototype` or smuggle in unexpected fields.

### Added
- **Flipper GUI Studio: per-widget font/size picker + native side-scroll.**
  Every text-bearing widget (`text`, `button`, `menu`, `toggle`) now has a
  font picker in the inspector — previously only the standalone `text`
  widget did; `button`/`menu`/`toggle` were hard-wired to one font. Because
  Flipper's `canvas_set_font` takes no size argument, the four fixed bitmap
  fonts double as the size choices and the chips read as sizes (Secondary
  5×7 … BigNumbers 8×13). Each text widget also gains a **Scroll** option
  for overflowing text: the editor preview marquees it (clipped, gated on
  `prefers-reduced-motion`) and the exported C app drives it natively with a
  `FuriTimer` + `elements_scrollable_text_line` (emitted only when a design
  actually scrolls). New persisted fields: `font` on button/menu/toggle,
  `scroll` on all four, `scrollW` on `text`; old saved/shared designs
  default to the previously-hardcoded fonts so they render unchanged.
- **Flipper GUI Studio: predefined icon library + picker.** A built-in
  set of 30 original 1-bit glyphs (system / navigation / media /
  Flipper-themed) at 16/32/64 px, generated by `icongen/` through the
  same `lib/xbm.js` pipeline as uploads so they export identically.
  Clicking the **Icon** palette tool now opens a `<dialog>` picker
  (search, category tabs, size chips, plus your own uploads) instead of
  silently grabbing the first uploaded icon; *Browse library* stocks the
  icon list without placing a widget.
- **Flipper GUI Studio: Elements panel.** A collapsible layers list of
  every widget on the active screen; click a row to select, tick its
  checkbox to **lock** the widget — frozen position and clickthrough on
  the canvas (it still exports normally).
- **Flipper GUI Studio: download bundle (.zip).** One click packages a
  whole project for a **C app** (scene .c/.h, icons.h, per-screen draw
  snippets, README) or a **JS app** (JSON spec, a ready-to-run canvas
  renderer sharing the editor's draw module + fonts, an `icons.js` data
  module, PNG icons, README), chosen with a C | JS toggle. JSZip
  lazy-loads from the pinned CDN with SRI.
- **Metadata Studio** (`tools/metadata-studio/`) — universal client-side
  metadata viewer / editor / stripper. Magic-byte format detection plus
  a handler registry covers JPEG, PNG, GIF, WebP, TIFF, HEIC, SVG, PDF,
  DOCX/XLSX/PPTX, ZIP, MP3, WAV, FLAC, OGG, and MP4/MOV/M4A. Full
  read+edit+strip for JPEG (EXIF), PNG (tEXt/iTXt/zTXt + custom),
  PDF (info dict), Office docs (core.xml + app.xml), SVG, ZIP (archive
  + per-entry comments), and MP3 (ID3v2). Read-only fallback for media
  formats with no reliable browser write library, with a clear UI
  banner. Per-format recommended-field lists float common keys to the
  top of each group. All libraries (piexifjs, pdf-lib, jszip,
  browser-id3-writer, exifr, music-metadata-browser) lazy-load from
  jsDelivr with SRI only after a file is dropped.
- **`scripts/test-og.mjs`** — local exerciser for `api/og.js`. Imports
  the handler, runs it against five permutations (defaults, short/long
  titles, dark/light themes, title+subtitle) and writes the PNGs to
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
- **OG Studio v2 — four-section composer.** Replaces the v1 single
  Compose panel with a row of preset chips
  (`tools-default` / `hero` / `minimal` / `twitter-banner` /
  `square-post`) plus four collapsible sections rendered as native
  `<details>` accordions:
  - **Content** — title, subtitle, brand chip (icon + name + sub +
    show), eyebrow (text + show), URL pill (text + show), divider
    show.
  - **Layout & size** — layout chips (5), size chips (4 named +
    custom `W × H`), headline font (sans/serif/mono), accent-word
    index stepper (−1 disables).
  - **Colour** — palette chips (6), image-theme chips (dark/light),
    five HEX overrides (colour-picker + text + clear) for
    `bg`/`text`/`muted`/`accent`/`accent2`. Blank field falls back to
    palette default.
  - **Background** — style chips (5); contextual angle slider shown
    only when `linear` is selected.
  Preview frame's aspect ratio tracks the selected size; the panel
  label updates live to "1200×630" / "1080×1080" / "1500×1500" etc.
  Mobile collapses every section by default; desktop keeps them open.
  Replaces the temporary "Advanced — raw cfg JSON" disclosure
  introduced earlier in this Unreleased cycle.
- **Length-aware hash state for the studio.** State round-trips
  through `location.hash` in two forms: flat
  (`#title=…&layout=hero&palette=violet`) when the URL-encoded diff
  vs defaults fits in 180 chars and no nested cfg fields
  (`colors`/`brand`/`eyebrow`/`url`) are set; otherwise compact
  base64url (`#c=<encoded>`). The reader accepts both transparently
  so shared links keep working in either form.

### Fixed
- **Flipper GUI Studio: selected widgets wouldn't drag.** A selected
  widget's `.fg-handle` overlay had `pointer-events: auto`, so it sat
  above the canvas and swallowed `pointerdown` — you could only drag
  *unselected* widgets. Handles are now click-through.
- **Flipper GUI Studio: inspector ate keystrokes.** Text/number fields
  committed on every `input`, rebuilding the inspector mid-typing
  (stealing focus) and pushing one undo entry per character. They now
  commit on **Enter** / blur, revert on **Esc**, and produce one undo
  entry per edit.
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
- **QR &amp; Barcode Generator.** New subpage at
  `/tools/qr-barcode/` covers every common 1D and 2D symbology
  (~55 entries: QR, Data Matrix, Aztec, PDF417, MaxiCode, Han Xin,
  Code 128/39/93/11, EAN-13/8/5/2, UPC-A/E, ISBN/ISMN/ISSN,
  Codabar, ITF/ITF-14, MSI, Plessey, Telepen, GS1-128 &amp; DataBar
  variants, USPS Intelligent Mail/POSTNET/PLANET, Royal Mail, KIX,
  Australia Post, Japan Post, Deutsche Post Ident/Leitcode, pharma
  codes incl. PZN/HIBC, DotCode, Ultracode, raw bit patterns).
  Filter input narrows the picker; ECC controls per symbology
  (QR L/M/Q/H chips, PDF417 0-8 slider, Aztec 5-95% slider);
  module + quiet-zone sliders; human-readable text toggle for 1D.
- **Content presets** auto-format payload per spec: plain text,
  URL (auto `https://`), WiFi (`WIFI:T:…;S:…;P:…;;`), vCard 3.0,
  SMS (`SMSTO:…`), email (`mailto:…?subject=…&body=…`),
  geo (`geo:lat,lon?q=…`), calendar event (`BEGIN:VEVENT…`).
- **Design panel for QR** via `qr-code-styling`: foreground +
  background colours with synced hex inputs, six module shapes
  (square, dots, rounded, extra-rounded, classy, classy-rounded),
  three corner outer and two corner inner shapes, optional linear
  gradient with a second stop, logo overlay (file upload) that
  auto-bumps ECC to Q.
- **Exports**: SVG (vector), PNG at 1×/2×/4×, JPG (flattened on
  background), PDF (A4 portrait via jsPDF with caption), copy PNG
  to clipboard via `ClipboardItem`, share via Web Share API.
- CDN libraries pinned with SHA-384 SRI: `bwip-js@4.5.1`,
  `qr-code-styling@1.6.0-rc.1`, `jspdf@2.5.2`.
- Dashboard card added; README + CLAUDE.md updated.
- **Video Studio** (`/tools/video/`) — client-only tool. Pins
  `@ffmpeg/ffmpeg@0.12.10`, `@ffmpeg/util@0.12.1`, and
  `@ffmpeg/core@0.12.6` (with `core-mt` fallback when the page is
  `crossOriginIsolated` and `SharedArrayBuffer` is available). Lazy-loads
  the wasm core only on first run, so the dashboard's first-paint budget
  is untouched. Modes: boomerang (forward + reverse), reverse-only,
  palindrome (held endpoints). Trim by start/end timestamps + dual range
  sliders. Audio: drop, keep forward (silence-padded for boomerang /
  palindrome), or reverse with video. Speed 0.25× – 4× via `setpts` +
  chained `atempo` for the extremes. Quality preset (low / medium / high
  → CRF 30 / 23 / 18). Output format: mp4 (h264 + aac, faststart) or
  webm (vp9 + opus, row-mt). Loop count 1× / 2× / 3× via filter-graph
  split + concat. Drag-and-drop with metadata preview (filename, size,
  duration, resolution, MIME). Per-stage progress, elapsed timer, ffmpeg
  log mirror, cancel button. All `URL.createObjectURL` results revoked
  on reset or new selection. Filter graph centralized in `buildArgs()`
  so future modes only add a state field + one switch arm. Output codec
  selection isolated to a single block, ready for av1/hevc when the core
  bundle ships them. Refactor of the user's original
  `mp4reverse.html` upload.
- **OG Image Studio** (`tools/og-studio/`) — first API-backed tool.
  Calls `/api/og` on `api.tools.ranzlappen.com` for live 1200×630
  previews; debounced input (300 ms) with cache-bust on edits,
  canonical URL display, clipboard copy, and `fetch` → blob PNG
  download. Image theme (dark/light) is independent of page theme.
  State round-trips through `location.hash` so previews are shareable
  as deep-links.
- **Per-tool README + in-app info modal.** Each tool now ships a
  `README.md` rendered by `assets/js/info-modal.js` (marked + DOMPurify,
  lazy-loaded with SHA-384 SRI). Info button next to every tool title.

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
