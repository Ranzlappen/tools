// Local exerciser for api/og.js — generates a matrix of cases covering
// every layout × theme, every background style, every named size, every
// preset, plus a handful of edge cases (long title, partial HEX
// override, custom dimensions, malformed cfg, all-hidden slots).
//
// Run:           node scripts/test-og.mjs
// Filter:        node scripts/test-og.mjs --filter centered
// Verbose:       VERBOSE=1 node scripts/test-og.mjs
// Output:        scripts/_og-out/*.png (gitignored) + pass/fail summary.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import handler from "../api/og.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "_og-out");
await mkdir(outDir, { recursive: true });

// ── Helpers ─────────────────────────────────────────────────────────

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const ogUrl = (params = {}, cfg) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) sp.set(k, v);
  if (cfg) sp.set("cfg", b64url(cfg));
  const qs = sp.toString();
  return `https://x/api/og${qs ? "?" + qs : ""}`;
};

// ── Case generators ─────────────────────────────────────────────────

const LAYOUTS = ["classic", "centered", "hero", "minimal", "split"];
const THEMES  = ["dark", "light"];
const BGS     = ["blobs", "linear", "solid", "dots", "noise"];
const SIZES   = ["og", "twitter", "linkedin", "square"];
const PRESETS = ["tools-default", "hero", "minimal", "twitter-banner", "square-post"];

const cases = [];

// Legacy regression set (preserves v1 harness coverage)
cases.push(
  { name: "legacy-defaults",          mode: "png", url: ogUrl() },
  { name: "legacy-short-title-dark",  mode: "png", url: ogUrl({ title: "Hello" }) },
  { name: "legacy-short-title-light", mode: "png", url: ogUrl({ title: "Hello", theme: "light" }) },
  { name: "legacy-long-title-dark",   mode: "png", url: ogUrl({ title: "A Considerably Longer Title Goes Here" }) },
  { name: "legacy-title-subtitle",    mode: "png", url: ogUrl({ title: "JSON Formatter", subtitle: "Pretty-print, minify, validate" }) },
);

// Layout × theme matrix
for (const layout of LAYOUTS) {
  for (const theme of THEMES) {
    cases.push({
      name: `layout-${layout}-${theme}`,
      mode: "png",
      url: ogUrl({}, { layout, theme, title: `Layout · ${layout}`, subtitle: `Theme: ${theme}.` }),
    });
  }
}

// Each background style with default layout (vary palette so noise/dots are visible)
for (const bg of BGS) {
  cases.push({
    name: `bg-${bg}`,
    mode: "png",
    url: ogUrl({}, { bg, palette: "violet", title: `Background · ${bg}`, subtitle: "One pattern, every layout." }),
  });
}

// Each named size, non-default content so scaling rules are exercised
for (const size of SIZES) {
  cases.push({
    name: `size-${size}`,
    mode: "png",
    url: ogUrl({}, { size, palette: "amber", title: `Size · ${size}`, subtitle: "Padding and font-size scale by canvas." }),
  });
}

// Each preset
for (const preset of PRESETS) {
  cases.push({
    name: `preset-${preset}`,
    mode: "png",
    url: ogUrl({}, { preset }),
  });
}

// Edge cases
cases.push(
  // Max-length title
  {
    name: "edge-max-title",
    mode: "png",
    url: ogUrl({}, { title: "A".repeat(80), subtitle: "Eighty A's — should clamp / shrink, not overflow." }),
  },
  // Empty title → falls back to default
  {
    name: "edge-empty-title",
    mode: "png",
    url: ogUrl({ title: "" }),
  },
  // Partial HEX override (accent only)
  {
    name: "edge-accent-override",
    mode: "png",
    url: ogUrl({}, { palette: "slate", colors: { accent: "#ff00aa" }, title: "Accent overridden" }),
  },
  // Custom dimensions
  {
    name: "edge-custom-dims",
    mode: "png",
    url: ogUrl({}, { size: "1500x1500", palette: "rose", title: "Custom 1500×1500" }),
  },
  // All slots hidden — exercises every null-children code path
  {
    name: "edge-all-hidden",
    mode: "png",
    url: ogUrl({}, {
      brand: { show: false },
      eyebrow: { show: false },
      url: { show: false },
      divider: false,
      subtitle: "",
      title: "Headline only.",
    }),
  },
  // Malformed cfg → expects 400 with friendly body
  {
    name: "edge-malformed-cfg",
    mode: "error",
    url: "https://x/api/og?cfg=this-is-not-base64-json!",
    expectStatus: 400,
    expectErrorContains: "cfg",
  },
);

// ── Filter ──────────────────────────────────────────────────────────

const filterIdx = process.argv.indexOf("--filter");
const filter = filterIdx >= 0 ? process.argv[filterIdx + 1] : null;
const runCases = filter ? cases.filter((c) => c.name.includes(filter)) : cases;

if (filter && runCases.length === 0) {
  console.error(`No cases match filter "${filter}".`);
  process.exit(2);
}

// ── Run ─────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
for (const c of runCases) {
  try {
    const res = await handler(new Request(c.url));

    if (c.mode === "error") {
      const body = await res.text();
      const statusOk = c.expectStatus ? res.status === c.expectStatus : res.status >= 400;
      const bodyOk   = c.expectErrorContains ? body.toLowerCase().includes(c.expectErrorContains.toLowerCase()) : true;
      if (statusOk && bodyOk) {
        console.log(`✓ ${c.name}: HTTP ${res.status} "${body.slice(0, 60)}"`);
        pass++;
      } else {
        console.log(`✗ ${c.name}: expected status ${c.expectStatus} containing "${c.expectErrorContains}", got HTTP ${res.status} "${body.slice(0, 80)}"`);
        fail++;
      }
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const file = join(outDir, `${c.name}.png`);
    await writeFile(file, buf);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    const magicOk =
      buf.length > 5000 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (magicOk) {
      console.log(`✓ ${c.name}: ${buf.length} bytes → ${file}`);
      pass++;
    } else {
      console.log(`✗ ${c.name}: ${buf.length} bytes (not a valid PNG) → ${file}`);
      fail++;
    }
  } catch (e) {
    fail++;
    console.error(`✗ ${c.name}: ${e.message}`);
    if (process.env.VERBOSE) console.error(e.stack);
  }
}

console.log(`\n${pass} passed, ${fail} failed (of ${runCases.length} run${filter ? `, filter "${filter}"` : ""}).`);
process.exit(fail > 0 ? 1 : 0);
