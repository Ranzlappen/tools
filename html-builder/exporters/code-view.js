/* code-view.js — generate the read-only HTML/CSS/JS sources shown in the code
   modal, and the shared building blocks the single-file and ZIP exporters
   reuse. DOM-free. */

import { walk } from "../lib/schema.js";
import { buildStylesheet } from "../lib/style-engine.js";
import { renderNodePretty, attrString, escapeHtml } from "../lib/renderer.js";
import { RUNTIME_JS } from "../lib/behaviors-runtime.js";

export function hasBehaviors(doc) {
  let yes = false;
  walk(doc.root, (n) => { if (n.behaviors && n.behaviors.length) yes = true; });
  return yes;
}

export function renderBody(doc) {
  return (doc.root.children || [])
    .filter((c) => !c.hidden)
    .map((c) => renderNodePretty(c, 2))
    .join("\n");
}

export function cssSource(doc) {
  return buildStylesheet(doc);
}

export function jsSource(doc) {
  return hasBehaviors(doc) ? RUNTIME_JS : "// No interactions defined.\n";
}

function headTags(doc, links) {
  const meta = doc.meta || {};
  const title = escapeHtml(meta.title || "Untitled page");
  const desc = meta.description ? `\n  <meta name="description" content="${escapeHtml(meta.description)}">` : "";
  return `<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${title}</title>${desc}\n${links}\n</head>`;
}

/* Multi-file HTML that links styles.css / app.js. */
export function htmlSourceLinked(doc) {
  const lang = (doc.meta && doc.meta.lang) || "en";
  const head = headTags(doc, `  <link rel="stylesheet" href="styles.css">`);
  const bodyOpen = `<body${attrString(doc.root)}>`;
  const body = renderBody(doc);
  const script = hasBehaviors(doc) ? `\n  <script src="app.js"></script>` : "";
  return `<!doctype html>\n<html lang="${lang}">\n${head}\n${bodyOpen}\n${body}${script}\n</body>\n</html>\n`;
}

export function splitSources(doc) {
  return { html: htmlSourceLinked(doc), css: cssSource(doc), js: jsSource(doc) };
}
