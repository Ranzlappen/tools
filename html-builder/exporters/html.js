/* html.js — single-file export. One self-contained index.html with the
   stylesheet inlined in <style> and (when interactions exist) the runtime
   inlined in <script>. DOM-free. */

import { attrString } from "../lib/renderer.js";
import { cssSource, renderBody, hasBehaviors, jsSource } from "./code-view.js";
import { escapeHtml } from "../lib/renderer.js";

export function buildHtml(doc) {
  const lang = (doc.meta && doc.meta.lang) || "en";
  const meta = doc.meta || {};
  const title = escapeHtml(meta.title || "Untitled page");
  const desc = meta.description ? `\n  <meta name="description" content="${escapeHtml(meta.description)}">` : "";
  const css = cssSource(doc);
  const body = renderBody(doc);
  const script = hasBehaviors(doc) ? `\n  <script>\n${jsSource(doc)}\n  </script>` : "";
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>${desc}
  <style>
${css}
  </style>
</head>
<body${attrString(doc.root)}>
${body}${script}
</body>
</html>
`;
}
