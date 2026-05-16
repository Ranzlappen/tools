# Vercel functions — `api.tools.ranzlappen.com`

This directory is the **Vercel project root** for the `tools` repo. It runs
on a separate hostname from the static dashboard.

## Two-hostname architecture

| Hostname                       | Hosted on     | Serves                                    |
| ------------------------------ | ------------- | ----------------------------------------- |
| `tools.ranzlappen.com`         | GitHub Pages  | Dashboard + every client-only tool subpage |
| `api.tools.ranzlappen.com`     | Vercel        | Serverless functions in this directory     |

Tools that need an API call out from the browser to
`https://api.tools.ranzlappen.com/api/<endpoint>`. CORS is allowed for the
Pages origin via `vercel.json` headers.

## Endpoints

| Path           | Runtime  | Purpose                                                |
| -------------- | -------- | ------------------------------------------------------ |
| `/api/health`  | node 20  | Static status payload. Smoke test for uptime monitors. |
| `/api/ping`    | edge     | Returns `{ ok, ts, region, runtimeMs }`. Latency probe.|
| `/api/og`      | edge     | Dynamic 1200×630 Open Graph image. `?title=&subtitle=&theme=`. |

Try the OG generator once deployed:

```
https://api.tools.ranzlappen.com/api/og?title=My%20Tool&subtitle=Built%20with%20ranzlappen
```

## First-time setup (do this once)

### 1. Create the Vercel project

1. Sign in at <https://vercel.com> → **Add New… → Project**.
2. Import `Ranzlappen/tools` from GitHub.
3. Framework preset: **Other**.
4. Root directory: leave at repo root (`./`). The `.vercelignore` file
   keeps the static dashboard out of the Vercel build.
5. Build & Output Settings:
   - Build Command: leave empty.
   - Install Command: `npm install`.
   - Output Directory: leave empty (functions auto-detected from `api/`).
6. Environment variables: none required.
7. Click **Deploy**. First build installs `@vercel/og` and bundles each
   handler.

### 2. Wire the custom domain

1. In the Vercel project: **Settings → Domains → Add**.
2. Domain: `api.tools.ranzlappen.com`.
3. Vercel will print one of two DNS instructions; for a subdomain it
   typically asks for a CNAME:

   ```
   Type:  CNAME
   Name:  api.tools
   Value: cname.vercel-dns.com.
   TTL:   Auto / 300
   ```

4. Add that record at your DNS provider for `ranzlappen.com`.
5. Wait for the SSL cert to provision (usually < 1 minute).

### 3. Smoke-test

```bash
curl -i https://api.tools.ranzlappen.com/api/health
# → { "ok": true, "service": "ranzlappen-tools-api", "timestamp": "…" }

curl -i https://api.tools.ranzlappen.com/api/ping
# → { "ok": true, "ts": "…", "region": "iad1", "runtimeMs": 0 }

open https://api.tools.ranzlappen.com/api/og?title=Hello
# → renders a 1200×630 PNG
```

## Deploy paths

Two deploy paths ship in this repo, in priority order:

### A. Vercel's native GitHub integration (recommended)

Once the project is imported (step 1 above), Vercel watches `main` and
auto-deploys whenever any file in `api/`, `vercel.json`, or
`package.json` changes. Zero workflow files required. Preview
deployments fire on every PR.

### B. GitHub Actions fallback

`.github/workflows/vercel-deploy.yml` reproduces the deploy via the
Vercel CLI. Useful when you want to deploy from a branch other than
`main`, when the native integration is paused, or for bisecting via
`workflow_dispatch`.

Required repo secrets (Settings → Secrets and variables → Actions):

| Secret              | Where to find it                                     |
| ------------------- | ---------------------------------------------------- |
| `VERCEL_TOKEN`      | <https://vercel.com/account/tokens>                  |
| `VERCEL_ORG_ID`     | After `vercel link`: `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | Same file → `projectId`                              |

If any secret is missing the workflow skips cleanly (no failure noise).
After populating the secrets, dispatch the workflow once manually from
the Actions tab to confirm it works end-to-end.

## Local development

```bash
# Vercel CLI runs the serverless functions locally on :3000
npm install
npx vercel@latest dev
```

The dashboard at `localhost:8080` (Python http.server) can be pointed at
the local API by overriding `API_BASE` in tool JS during development.

## Environment variables

None required today. Add via Vercel project settings; never commit
secrets here. Reference in handler code with `process.env.MY_VAR`.

## CORS

`vercel.json` allows the Pages origin (`https://tools.ranzlappen.com`)
explicitly. To test from `localhost`, temporarily add it to the
`Access-Control-Allow-Origin` header during local dev — never commit a
wildcard `*` for endpoints that accept credentials.

## Adding an endpoint

1. Create `api/<name>.js`.
2. Default-export a `(req, res) => {…}` handler (Node) or a `(req) =>`
   Response (Edge). For Edge runtime add `export const config = { runtime: "edge" }`.
3. Update `vercel.json`'s `headers` block if the endpoint needs
   different CORS or caching.
4. Reference it from the relevant tool subpage at
   `https://api.tools.ranzlappen.com/api/<name>`.
5. Add the row to the **Endpoints** table above.
