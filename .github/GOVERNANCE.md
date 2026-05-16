# Governance

How **tools** is run. Short on purpose — anything not covered here lives in [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md), or [`SECURITY.md`](./SECURITY.md).

This document follows the [`repo-standards`](https://github.com/Ranzlappen/repo-standards) v3 governance template. The default is "lazy consensus, transparent decisions, branch protection backs the rules so the rules aren't the only line of defence".

## Roles

The repo recognises three roles:

- **Maintainers** — listed in [`CODEOWNERS`](./CODEOWNERS). Can merge PRs, cut releases, edit branch protection. Default: the repo owner. Add maintainers by PR (one PR per addition, requires approval from an existing maintainer).
- **Contributors** — anyone who has ever opened a PR or issue. No special permissions; reviews are welcome and weighed but non-binding.
- **Users** — everyone else. Bug reports and feature requests via [issue templates](./ISSUE_TEMPLATE/).

Roles are descriptive, not hierarchical. A contributor with sustained, quality contributions becomes a maintainer; a maintainer who steps away does so by PR (remove themselves from CODEOWNERS), no ceremony.

## Decision-making

**Lazy consensus.** Most decisions are made in PR review. If a maintainer opens a PR and no other maintainer objects within a reasonable window (default: 72 hours for non-urgent changes, immediate for security fixes), the change ships.

**Disagreement.** If two maintainers disagree on a substantive change:

1. The PR author drafts the change with the rationale in the PR description.
2. Other maintainers comment with concrete blocking concerns (not "I don't like it" — name what specifically would break or regress).
3. If consensus isn't reached in 7 days, the repo owner has the tiebreaker. Document the tiebreak in the PR thread so future contributors see the reasoning.

**No bikeshedding budget.** Trivial style preferences (where a comment goes, naming taste) are deferred to the existing linters and the existing patterns. If the linter doesn't catch it and there's no existing pattern, the PR author's choice stands.

## Contribution lifecycle

1. **Issue first** for non-trivial changes — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). Avoids wasted work.
2. **Branch from `main`** with a Conventional Commits–friendly name (`feat/csv-export`, `fix/swipe-flicker`, `docs/clarify-storage-keys`).
3. **PR is the conversation.** Use the [PR template](./pull_request_template.md). Keep the PR small and reviewable in one sitting.
4. **CI must be green** before review. Maintainers don't review red CI; they ask the author to fix it first.
5. **Squash-merge** is the default. The PR title becomes the merge commit subject (so it must conform to Conventional Commits).
6. **The author closes the loop** — replies to review comments, links to the merged PR from the originating issue, and ticks the issue closed if the PR resolves it.

## Recommended branch-protection rules (`main`)

Configure under **Settings → Branches → Branch protection rules → Add rule** with pattern `main`. The repo's `security-scan.yml` and `dependency-review.yml` workflows assume these rules are in place; without them the gates are advisory only.

- ✅ **Require a pull request before merging.**
  - ✅ Require approvals: **1**.
  - ✅ Dismiss stale pull request approvals when new commits are pushed.
  - ✅ Require review from Code Owners (uses [`CODEOWNERS`](./CODEOWNERS)).
- ✅ **Require status checks to pass before merging.**
  - ✅ Require branches to be up to date before merging.
  - Required checks (mark each as required after its first successful run):
    - `CodeQL` (per language matrix in `security-scan.yml`)
    - `Gitleaks secret scan`
    - `Dependency review`
    - `Deploy to GitHub Pages`
- ✅ **Require conversation resolution before merging.**
- ✅ **Require signed commits.** Recommended; flip on once maintainers have signing keys configured.
- ✅ **Require linear history.** Enforces squash- or rebase-merge; matches the lifecycle rule above.
- ✅ **Do not allow bypassing the above settings** — including for administrators.
- ✅ **Restrict who can push to matching branches.** Maintainers only.
- ✅ **Allow force pushes**: ❌ disabled. **Allow deletions**: ❌ disabled.

## Supply-chain governance

The repo's supply-chain primitives — SHA-pinning, CodeQL, gitleaks, and dependency review — are policy-bound, not best-effort.

- **`dependency-review.yml` is required on every PR to `main`.** A PR that introduces a `high`-or-above CVE blocks merge until the CVE is resolved upstream (preferred), pinned to a patched range (acceptable), or explicitly waived in the PR description with a CVE-ID and justification (last resort).
- **CodeQL is required on every language present in the repo.** Matrix in `security-scan.yml` tracks the languages actually checked in. Adding a new language is a `security` PR that updates the matrix in the same commit as the first source file.
- **CDN libraries pinned + SRI.** Every `<script src="...cdn...">` carries a version pin and an `integrity="sha384-..."` attribute. Adding or upgrading a CDN library is a `security`-tagged review item.
- **Dependabot's role.** Dependabot opens the PRs; `dependency-review.yml` gates them; a maintainer reviews and merges. Dependabot **does not** auto-merge in this repo.
- **Waivers are public.** Any time a primitive is bypassed, the bypass lives in `SECURITY.md` with the reason and the review date.

## Triage and release rhythm

- **Triage cadence**: Maintainers aim to acknowledge new issues within 7 days. "Acknowledge" means triage label + a one-line response, not a fix.
- **Release cadence**: Driven by Conventional Commits. Releases are cut manually when a maintainer judges enough has accumulated; tag the merge commit `vX.Y.Z`, push the tag, and add a CHANGELOG entry in the same PR.
- **Security fixes** ship out-of-band on their own PR, fast-tracked through review. See [`SECURITY.md`](./SECURITY.md) for private disclosure.

## Conflict resolution

Code-of-conduct concerns route to the contact in [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Repo-process concerns (this document, branch protection, lifecycle) route to the maintainer list in [`CODEOWNERS`](./CODEOWNERS) via a private email or issue tagged `governance`.

If something here is broken or missing, open a PR against this file — governance changes follow the same lifecycle as code changes.
