<!--
PR title should follow Conventional Commits:
  feat(scope): …   fix(scope): …   docs: …   chore(deps): …
See CONTRIBUTING.md for the full type list.
-->

## Summary

<!-- One or two sentences. What changed and why. Link the originating issue. -->

Closes #

## Behavior-preservation evidence

<!--
If this PR is a refactor or cleanup, prove the behavior did not change.
Acceptable evidence: existing tests still pass, manual repro of the
affected flow, screenshots/recordings of before vs after, or "N/A — this
PR intentionally changes behavior".
-->

## Repo-specific risks / edge cases

<!--
What could break that the CI checks won't catch?
- Backdrop pill state across tool subpages?
- Theme persistence across reloads?
- CDN library SRI changes (marked/DOMPurify)?
- Path-filter regressions in pages-deploy.yml?
-->

## Test plan

- [ ] Local: opened `index.html` and at least one affected tool subpage in a browser.
- [ ] Toggled both backdrops and theme; reloaded; settings persisted.
- [ ] No console errors on clean load.
- [ ] `prefers-reduced-motion: reduce` still freezes animations.
- [ ] CI green.

## Checklist

- [ ] Followed [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- [ ] Conventional Commits title.
- [ ] Updated [`CHANGELOG.md`](../CHANGELOG.md) under `[Unreleased]` if user-visible.
- [ ] Updated [`README.md`](../README.md) and/or [`CLAUDE.md`](../CLAUDE.md) if behavior, commands, or architecture changed.
- [ ] No secrets, credentials, or unredacted personal data committed.
