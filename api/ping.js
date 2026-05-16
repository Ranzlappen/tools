/* api/ping.js — lightweight uptime probe.
 *
 * Returns `{ ok, ts, region, runtimeMs }`. `runtimeMs` is the elapsed
 * handler time, which is a rough indicator of cold-start latency when
 * the function hasn't been hit recently. Used by external uptime checks
 * and the dashboard if/when a "system status" pill ships.
 */

export const config = { runtime: "edge" };

export default function handler(req) {
  const start = Date.now();
  const body = {
    ok: true,
    ts: new Date().toISOString(),
    region: process.env.VERCEL_REGION || "unknown",
    runtimeMs: Date.now() - start,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
