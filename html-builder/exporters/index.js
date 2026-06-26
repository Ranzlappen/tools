/* index.js — DOM-free public surface for the exporters, lazy-imported by the
   shell on first code-view / export. */

export { buildHtml } from "./html.js";
export { splitSources, hasBehaviors } from "./code-view.js";
export { buildZip } from "./zip.js";
