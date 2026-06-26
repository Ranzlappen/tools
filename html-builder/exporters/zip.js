/* zip.js — multi-file export (index.html + styles.css + app.js). JSZip is
   injected by the shell (lazy-loaded from the pinned SRI CDN). DOM-free. */

import { splitSources, hasBehaviors } from "./code-view.js";

export async function buildZip(doc, { JSZip }) {
  const zip = new JSZip();
  const { html, css, js } = splitSources(doc);
  zip.file("index.html", html);
  zip.file("styles.css", css + "\n");
  if (hasBehaviors(doc)) zip.file("app.js", js);
  return zip.generateAsync({ type: "blob" });
}
