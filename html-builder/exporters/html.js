/* html.js — single-file export. One self-contained index.html with the
   stylesheet inlined in <style> and (when interactions exist) the runtime
   inlined in <script>. DOM-free. */

import { cssSource, renderBody, bodyOpenTag, hasBehaviors, jsSource } from "./code-view.js";
import { escapeHtml } from "../lib/renderer.js";

export function buildHtml(doc) {
  const lang = (doc.meta && doc.meta.lang) || "en";
  const meta = doc.meta || {};
  const title = escapeHtml(meta.title || "Untitled page");
  const desc = meta.description ? `\n  <meta name="description" content="${escapeHtml(meta.description)}">` : "";
  const css = cssSource(doc);
  // single file → inline uploaded assets as data URLs
  const body = renderBody(doc, "inline");
  const bodyOpen = bodyOpenTag(doc, "inline");
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
${bodyOpen}
${body}${script}
</body>
</html>
`;
}
