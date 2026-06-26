/* zip.js — multi-file export (index.html + styles.css + app.js + assets/).
   JSZip is injected by the shell (lazy-loaded from the pinned SRI CDN).
   DOM-free. */

import { splitSources, hasBehaviors } from "./code-view.js";
import { walk } from "../lib/schema.js";

/* Only the assets actually referenced by the tree are written. */
function usedAssets(doc) {
  const ids = new Set();
  walk(doc.root, (n) => {
    for (const v of Object.values(n.attrs || {})) {
      if (typeof v === "string" && v.startsWith("asset:")) ids.add(v.slice(6));
    }
  });
  return (doc.assets || []).filter((a) => ids.has(a.id));
}

function dataUrlPayload(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (/;base64/i.test(meta)) return { data: body, opts: { base64: true } };
  return { data: decodeURIComponent(body), opts: {} }; // e.g. data:image/svg+xml,<encoded>
}

export async function buildZip(doc, { JSZip }) {
  const zip = new JSZip();
  const { html, css, js } = splitSources(doc);
  zip.file("index.html", html);
  zip.file("styles.css", css + "\n");
  if (hasBehaviors(doc)) zip.file("app.js", js);

  const assets = usedAssets(doc);
  if (assets.length) {
    const folder = zip.folder("assets");
    for (const a of assets) {
      const payload = dataUrlPayload(a.dataUrl || "");
      if (payload) folder.file(a.name, payload.data, payload.opts);
    }
  }
  return zip.generateAsync({ type: "blob" });
}
