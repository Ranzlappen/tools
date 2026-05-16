# CLAUDE.md

Architectural notes for AI assistants working on this repo.

## What this is

`tools.ranzlappen.com` — a static landing dashboard plus seven working
client-only utilities (JSON formatter, color picker, regex tester,
markdown preview, multi-encoder, JWT decoder, UUID/hash generator). All
seven run entirely in the browser; nothing is transmitted to a server.

## Hosting

- **GitHub Pages** — `tools.ranzlappen.com`, static (dashboard + every
  current tool subpage). Custom domain via `CNAME`.
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

`<html data-backdrop="aurora|shader|particles|grid">` switches between four
visual backdrops. Aurora and grid are pure CSS. Shader and particles are
canvas-based and **must** pause when `document.hidden`. Selection persists
in `localStorage['tools:backdrop']`. Respect `prefers-reduced-motion:
reduce` everywhere.

## Adding a new tool

1. Add a card to the grid in `index.html`. Match existing card markup.
2. Create `tools/<slug>/index.html` with the tool itself. Re-import
   `/assets/css/style.css` for visual consistency.
3. Keep each tool self-contained — no shared state, no shared JS unless it
   genuinely belongs in `assets/js/`.
4. Client-only? Stays on Pages. Needs a server / build step? Plan for
   Vercel and document the routing.

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
