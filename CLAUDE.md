# CLAUDE.md

Architectural notes for AI assistants working on this repo.

## What this is

`tools.ranzlappen.com` — a static landing dashboard plus a growing set of
small client-side utilities. v1 is **landing page only**; the 7 advertised
tools are placeholder tiles linking to subpages that do not yet exist.

## Hosting

- **GitHub Pages** serves everything in v1 (custom domain via `CNAME`).
- **Vercel** will host tools that need a build step or server (planned, not
  yet wired up). Subdomain stays the same — routing TBD.

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

This repo follows `Ranzlappen/repo-standards` v3 at **essentials-only**
compliance. Files present today: README, LICENSE, CLAUDE.md,
`.standards-version`, `.gitignore`, `.nojekyll`, CNAME, pages-deploy
workflow, dependabot. Files **deferred** to follow-up: CHANGELOG,
CONTRIBUTING, SECURITY, PR template, issue forms, GOVERNANCE, CODEOWNERS,
security-scan / dependency-review / repo-sanitation workflows.

When you upgrade compliance, do it as a discrete PR labeled
`chore(standards)` and update this file's compliance summary above.

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
- Don't commit the OG image as a binary larger than 50 KB.

## Post-task self-check

Before declaring a task done, confirm:

- [ ] Pages still deploys (workflow green, custom domain serves 200).
- [ ] Dashboard renders with all 4 backdrops; switching works and persists.
- [ ] `prefers-reduced-motion: reduce` freezes all motion.
- [ ] No console errors on a clean load.
- [ ] No new top-level dependencies / build tools introduced silently.
- [ ] CLAUDE.md still under 200 lines (this file).
- [ ] If you added a tool: its card links to a working subpage.
