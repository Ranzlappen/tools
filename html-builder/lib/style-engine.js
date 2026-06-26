/* style-engine.js — turns the model's per-breakpoint StyleMaps into one CSS
   string keyed by [data-hb-id]. Used by BOTH the live preview and the export
   codegen, so the responsive cascade is byte-identical in editor and output.

   Pure: takes a doc, returns a string. No DOM. */

import { walk, DEVICES } from "./schema.js";

/* Minimal, ship-quality base shared by preview and export so layout matches. */
export const BASE_RESET = `*,*::before,*::after{box-sizing:border-box}body{margin:0}`;

export const nodeSelector = (id) => `[data-hb-id="${id}"]`;

function declarations(obj, indent = "  ") {
  return Object.entries(obj)
    .filter(([, v]) => v !== "" && v != null)
    .map(([prop, v]) => `${indent}${prop}: ${v};`)
    .join("\n");
}

/* Collect every node's rule for one editing layer ("base"|"tablet"|"mobile"). */
function layerRules(doc, layer) {
  const out = [];
  walk(doc.root, (n) => {
    const styles = n.styles && n.styles[layer];
    if (!styles || !Object.keys(styles).length) return;
    const decls = declarations(styles);
    if (decls) out.push(`${nodeSelector(n.id)} {\n${decls}\n}`);
  });
  return out.join("\n");
}

export function buildStylesheet(doc, opts = {}) {
  const parts = [];

  // Google / web fonts via @import (kept first per CSS rules).
  const fonts = (doc.globals && doc.globals.fonts) || [];
  for (const f of fonts) {
    if (f && f.href) parts.push(`@import url("${f.href}");`);
  }

  parts.push(BASE_RESET);

  // base (unconditional)
  const base = layerRules(doc, "base");
  if (base) parts.push(`/* base */\n${base}`);

  // tablet <=1024
  const tablet = layerRules(doc, "tablet");
  if (tablet) parts.push(`@media (max-width: ${DEVICES.tablet.max}px) {\n${indentBlock(tablet)}\n}`);

  // mobile <=640
  const mobile = layerRules(doc, "mobile");
  if (mobile) parts.push(`@media (max-width: ${DEVICES.mobile.max}px) {\n${indentBlock(mobile)}\n}`);

  // raw escape-hatch CSS, appended last so it can override
  const custom = doc.globals && doc.globals.customCss;
  if (custom && custom.trim()) parts.push(`/* custom */\n${custom.trim()}`);

  return parts.join("\n\n");
}

function indentBlock(block) {
  return block.split("\n").map((l) => (l ? "  " + l : l)).join("\n");
}

/* Resolve the effective style for a node at a given device — used by the
   inspector to show inherited values. Desktop-first merge. */
export function resolveStyle(node, device) {
  const s = node.styles || {};
  if (device === "mobile") return { ...s.base, ...s.tablet, ...s.mobile };
  if (device === "tablet") return { ...s.base, ...s.tablet };
  return { ...s.base };
}
