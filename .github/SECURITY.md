# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for vulnerabilities.

Use one of the private channels below:

1. **GitHub private vulnerability reporting** (preferred): [open a draft advisory](../../security/advisories/new).
2. **Email**: security@ranzlappen.com with a description, reproduction steps, and any relevant logs.

Include in the report:

- A summary of the issue.
- Steps to reproduce.
- The version / commit SHA you tested against.
- Your assessment of impact (data exposure, account takeover, denial of service, etc.).
- Optional: a proposed fix.

You can expect:

- An acknowledgement within **3 business days**.
- A triage decision (accepted / needs more info / not a vulnerability) within **10 business days**.
- A coordinated disclosure window once a fix is identified — typically 30–90 days, longer for complex issues.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest `main` | ✅ |
| Latest tagged release | ✅ |
| Older tagged releases | ⚠️ Best-effort backports only |
| Forks | ❌ Out of scope |

## Out of scope

- Vulnerabilities in third-party dependencies that have not yet been patched upstream — please report those to the upstream project first. Once an upstream fix exists, a report here is welcome to track our adoption.
- Social engineering, phishing, or physical attacks against contributors.
- Issues that require an attacker to already control the user's device or network at a level that bypasses normal browser/OS sandboxing.

## Client-side scope

Every tool currently shipped on `tools.ranzlappen.com` runs entirely in the user's browser; no input is transmitted to a server. The JWT Decoder explicitly does **not** verify signatures — this is intentional and called out in the UI. Treat the decoded payload as untrusted in any downstream use.

The CDN-loaded libraries (`marked`, `DOMPurify`) are pinned by version and
delivered with Subresource Integrity hashes. A CDN supply-chain compromise
would be caught by the browser's SRI check and silently fail to load — please
report the failure mode if you observe it.
