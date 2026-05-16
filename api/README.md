# Vercel functions — `api.tools.ranzlappen.com`

This directory is the **Vercel project root** for the `tools` repo. It runs
on a separate hostname from the static dashboard.

## Two-hostname architecture

| Hostname                       | Hosted on     | Serves                                    |
| ------------------------------ | ------------- | ----------------------------------------- |
| `tools.ranzlappen.com`         | GitHub Pages  | Dashboard + every client-only tool subpage |
| `api.tools.ranzlappen.com`     | Vercel        | This directory's serverless functions      |

Tools that need an API call out from the browser to
`https://api.tools.ranzlappen.com/api/<endpoint>`. CORS is allowed for the
Pages origin via `vercel.json` headers.

## Why split?

- GitHub Pages is free and reliable for static.
- Vercel only bills/limits the dynamic workloads.
- One repo, two clean deploy targets — no proxy layer to debug.

## Adding an endpoint

1. Create `api/<name>.js` (or `.ts`) following Vercel's
   [Functions API](https://vercel.com/docs/functions).
2. Default-export a `(req, res) => {…}` handler.
3. Update `vercel.json`'s `headers` block if the endpoint needs different
   CORS or caching.
4. Reference it from the relevant tool subpage at
   `https://api.tools.ranzlappen.com/api/<name>`.

## Deployment checklist (first-time setup)

1. Create a new Vercel project pointed at this repo's `main` branch.
2. Vercel auto-detects `vercel.json`; confirm the project root is the
   repo root (`.`) and the `.vercelignore` excludes static-only paths.
3. Add `api.tools.ranzlappen.com` as a custom domain in the Vercel project.
4. Add a DNS record on `ranzlappen.com`:
   `api.tools` → `CNAME` → `cname.vercel-dns.com.`
5. Once the SSL cert provisions, smoke-test:
   `curl https://api.tools.ranzlappen.com/api/health`
   should return `{"ok": true, "service": "ranzlappen-tools-api", …}`.

## Local development

```bash
# Vercel CLI runs the serverless functions locally on :3000
npx vercel@latest dev
```

The dashboard at `localhost:8080` (Python http.server) can be pointed at
the local API by overriding `API_BASE` in tool JS during development.

## Environment variables

None today. Add via Vercel's project settings; never commit secrets here.
Reference in handler code with `process.env.MY_VAR`.

## CORS

`vercel.json` allows the Pages origin (`https://tools.ranzlappen.com`)
explicitly. If you need to test from `localhost`, temporarily add it to
the `Access-Control-Allow-Origin` header during local dev — never commit
a wildcard `*` for endpoints that accept credentials.
