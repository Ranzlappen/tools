/* renderer.js — model → HTML for the preview iframe and (via exporters) for
   the final output. Every rendered element carries data-hb-id so the canvas
   can map a clicked node back to the model and patch it in place.

   Two render paths:
   • buildSrcdoc(doc) — full document string (structural changes, srcdoc swap)
   • patch helpers      — update one element's text/attrs, or rewrite the single
                          <style data-hb-styles> block, with no iframe reload. */

import { isVoid, canHaveChildren } from "./schema.js";
import { buildStylesheet } from "./style-engine.js";
import { serializeBindings, RUNTIME_JS } from "./behaviors-runtime.js";

const AMP = /&/g, LT = /</g, GT = />/g, QUOT = /"/g;
export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(AMP, "&amp;").replace(LT, "&lt;").replace(GT, "&gt;");
}
export function escapeAttr(s) {
  return String(s == null ? "" : s).replace(AMP, "&amp;").replace(QUOT, "&quot;").replace(LT, "&lt;");
}

/* Reject javascript: / data: schemes on navigable attributes. */
function safeUrl(v) {
  const s = String(v).trim();
  if (/^\s*javascript:/i.test(s)) return "#";
  return s;
}
const URL_ATTRS = new Set(["href", "src", "poster", "action"]);

export function attrString(node) {
  let out = ` data-hb-id="${node.id}"`;
  if (node.classes && node.classes.length) out += ` class="${escapeAttr(node.classes.join(" "))}"`;
  for (const [name, value] of Object.entries(node.attrs || {})) {
    if (value === false || value == null || value === "") continue;
    if (value === true) { out += ` ${name}`; continue; }
    const v = URL_ATTRS.has(name) ? safeUrl(value) : value;
    out += ` ${name}="${escapeAttr(v)}"`;
  }
  const bind = serializeBindings(node);
  if (bind) out += ` data-hb-bind="${escapeAttr(JSON.stringify(bind))}"`;
  return out;
}

export function renderNode(node, opts = {}) {
  if (node.hidden && !opts.keepHidden) return "";
  const tag = node.tag;
  const attrs = attrString(node);
  if (isVoid(tag)) return `<${tag}${attrs}>`;

  let inner = "";
  if (node.children && node.children.length) {
    inner = node.children.map((c) => renderNode(c, opts)).join("");
  } else if (!canHaveChildren(tag)) {
    inner = escapeHtml(node.text || "");
  } else {
    inner = node.text ? escapeHtml(node.text) : "";
  }
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

/* Pretty, indented render for export/code-view. Block elements break onto
   their own lines; text-only leaves stay inline. */
export function renderNodePretty(node, depth = 0) {
  if (node.hidden) return "";
  const pad = "  ".repeat(depth);
  const tag = node.tag;
  const attrs = attrString(node);
  if (isVoid(tag)) return `${pad}<${tag}${attrs}>`;
  const kids = (node.children || []).filter((c) => !c.hidden);
  if (!kids.length) {
    const text = canHaveChildren(tag) ? (node.text ? escapeHtml(node.text) : "") : escapeHtml(node.text || "");
    return `${pad}<${tag}${attrs}>${text}</${tag}>`;
  }
  const inner = kids.map((c) => renderNodePretty(c, depth + 1)).join("\n");
  return `${pad}<${tag}${attrs}>\n${inner}\n${pad}</${tag}>`;
}

/* Editor-only CSS injected into the preview so empty containers are visible
   and grabbable. NOT shipped in export. */
const EDITOR_CSS = `
  html{cursor:default}
  [data-hb-id]:empty:not(img):not(input):not(textarea):not(video):not(iframe):not(br):not(hr){
    min-height:28px;min-width:28px;outline:1px dashed rgba(120,140,130,.5);outline-offset:-1px;
  }
  body[data-hb-id]:empty{min-height:100vh}
`;

export function buildSrcdoc(doc, opts = {}) {
  const interactive = !!opts.interactive;
  const css = buildStylesheet(doc);
  const bodyAttrs = attrString(doc.root);
  const bodyInner = (doc.root.children || []).map((c) => renderNode(c, opts)).join("");
  const editorBlock = interactive ? "" : `<style data-hb-editor>${EDITOR_CSS}</style>`;
  const runtimeBlock = interactive ? `<script>${RUNTIME_JS}</script>` : "";
  const lang = (doc.meta && doc.meta.lang) || "en";
  const title = escapeHtml((doc.meta && doc.meta.title) || "");
  return `<!doctype html><html lang="${escapeAttr(lang)}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${title}</title>` +
    `<style data-hb-styles>${css}</style>${editorBlock}</head>` +
    `<body${bodyAttrs}>${bodyInner}${runtimeBlock}</body></html>`;
}

/* ── targeted patches (operate on the live iframe document) ─────────────── */

export function applyStylesheet(iframeDoc, doc) {
  const styleEl = iframeDoc && iframeDoc.querySelector("style[data-hb-styles]");
  if (styleEl) styleEl.textContent = buildStylesheet(doc);
}

export function elFor(iframeDoc, id) {
  return iframeDoc ? iframeDoc.querySelector(`[data-hb-id="${CSS.escape ? CSS.escape(id) : id}"]`) : null;
}

export function patchText(iframeDoc, node) {
  const el = elFor(iframeDoc, node.id);
  if (el && (!node.children || !node.children.length) && !canHaveChildren(node.tag) && !isVoid(node.tag)) {
    el.textContent = node.text || "";
  }
}

const RESERVED = new Set(["data-hb-id", "class", "style", "data-hb-bind"]);
export function patchAttrs(iframeDoc, node) {
  const el = elFor(iframeDoc, node.id);
  if (!el) return;
  el.className = (node.classes || []).join(" ");
  // remove stale whitelisted attrs
  for (const a of [...el.attributes]) {
    if (RESERVED.has(a.name)) continue;
    if (!(a.name in (node.attrs || {}))) el.removeAttribute(a.name);
  }
  for (const [name, value] of Object.entries(node.attrs || {})) {
    if (value === false || value == null || value === "") { el.removeAttribute(name); continue; }
    if (value === true) { el.setAttribute(name, ""); continue; }
    el.setAttribute(name, URL_ATTRS.has(name) ? safeUrl(value) : value);
  }
  const bind = serializeBindings(node);
  if (bind) el.setAttribute("data-hb-bind", JSON.stringify(bind));
  else el.removeAttribute("data-hb-bind");
  // patch text too (covers set-text-style nodes)
  patchText(iframeDoc, node);
}
