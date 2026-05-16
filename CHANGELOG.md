# Changelog

All notable changes to **tools** are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Ranzlappen/tools/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Ranzlappen/tools/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Ranzlappen/tools/releases/tag/v0.1.0
