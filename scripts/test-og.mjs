// Local exerciser for api/og.js — runs the handler against every code
// path (default theme, custom title short + long, light theme, both
// title-override branches) and writes each output as a PNG so we can
// see exactly what Satori produces *before* shipping to Vercel.
//
// Run: node scripts/test-og.mjs
// Output: scripts/_og-out/*.png + a pass/fail summary on stdout.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import handler from "../api/og.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "_og-out");
await mkdir(outDir, { recursive: true });

const cases = [
  { name: "defaults",          url: "https://x/api/og" },
  { name: "short-title-dark",  url: "https://x/api/og?title=Hello" },
  { name: "short-title-light", url: "https://x/api/og?title=Hello&theme=light" },
  { name: "long-title-dark",   url: "https://x/api/og?title=A%20Considerably%20Longer%20Title%20Goes%20Here" },
  { name: "title-and-subtitle",
    url: "https://x/api/og?title=JSON%20Formatter&subtitle=Pretty-print%2C%20minify%2C%20validate" },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  try {
    const res = await handler(new Request(c.url));
    const buf = Buffer.from(await res.arrayBuffer());
    const file = join(outDir, `${c.name}.png`);
    await writeFile(file, buf);
    const ok = buf.length > 0 && buf[0] === 0x89 && buf[1] === 0x50;
    console.log(`${ok ? "✓" : "✗"} ${c.name}: ${buf.length} bytes${ok ? "" : " (not a valid PNG)"} → ${file}`);
    if (ok) pass++; else fail++;
  } catch (e) {
    fail++;
    console.error(`✗ ${c.name}: ${e.message}`);
    if (process.env.VERBOSE) console.error(e.stack);
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
