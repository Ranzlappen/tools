/* api/health.js — smoke-test serverless function.
 *
 * Verifies that the Vercel project on `api.tools.ranzlappen.com` is
 * deploying and reachable. Returns a fixed JSON body. Used by uptime
 * checks; useful as a copy-paste template for new endpoints.
 */

export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.status(200).end(
    JSON.stringify({
      ok: true,
      service: "ranzlappen-tools-api",
      timestamp: new Date().toISOString(),
    })
  );
}
