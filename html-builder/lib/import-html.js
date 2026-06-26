/* import-html.js — pragmatic HTML → model importer (lazy-loaded; pulls in
   DOMPurify). Sanitizes the markup, parses it, and walks the body into the
   document model: structure + classes + whitelisted attrs + inline style= map
   to editable per-element styles; <style>/linked CSS is collected verbatim
   into the page's custom-CSS escape hatch; scripts and handlers are stripped.

   Limitations (documented in README): CSS from stylesheets is not mapped to
   per-element styles; interleaved text next to child elements is dropped;
   JavaScript/interactions are not imported. */

import { makeNode, makeStyleMap, tagInfo, GLOBAL_ATTRS, uid } from "./schema.js";

const PURIFY_SRC = "https://cdn.jsdelivr.net/npm/dompurify@3.0.11/dist/purify.min.js";
const PURIFY_SRI = "sha384-Ic7KEGROu37YaruU6NyiYeib7UhjFyDZQ5fzBAji965L75T/4LGk5nzwMEjNGexs";

function loadDOMPurify() {
  if (window.DOMPurify) return Promise.resolve(window.DOMPurify);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PURIFY_SRC;
    s.integrity = PURIFY_SRI;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => resolve(window.DOMPurify);
    s.onerror = () => reject(new Error("Could not load the HTML sanitizer"));
    document.head.appendChild(s);
  });
}

const SKIP_TAGS = new Set(["script", "style", "link", "meta", "title", "head", "noscript", "template"]);

function parseInlineStyle(str) {
  const out = {};
  for (const decl of String(str || "").split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim();
    if (prop && value) out[prop] = value;
  }
  return out;
}

function elementToNode(el) {
  const tag = el.tagName ? el.tagName.toLowerCase() : "";
  if (!tag || SKIP_TAGS.has(tag)) return null;

  const node = makeNode(tag, { id: uid() });
  node.text = "";
  node.styles = makeStyleMap();

  const cls = el.getAttribute("class");
  if (cls) node.classes = cls.split(/\s+/).filter(Boolean);

  const style = el.getAttribute("style");
  if (style) node.styles.base = parseInlineStyle(style);

  // copy whitelisted attributes (global + tag-specific)
  const spec = { ...GLOBAL_ATTRS, ...(tagInfo(tag).attrs || {}) };
  for (const [name, def] of Object.entries(spec)) {
    if (!el.hasAttribute(name)) continue;
    const raw = el.getAttribute(name);
    node.attrs[name] = def.type === "bool" ? true : raw;
  }

  // children (elements only) — interleaved text alongside elements is dropped
  for (const child of el.children) {
    const n = elementToNode(child);
    if (n) node.children.push(n);
  }
  if (!node.children.length) {
    const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (txt) node.text = txt;
  }
  return node;
}

/* parseHtml(htmlString) -> Promise<{ root, customCss, skippedLinks }> */
export async function parseHtml(htmlString) {
  const DOMPurify = await loadDOMPurify();
  const clean = DOMPurify.sanitize(String(htmlString || ""), {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ["style"],
    FORBID_TAGS: ["script"],
  });
  const dp = new DOMParser().parseFromString(clean, "text/html");

  // collect <style> blocks
  let customCss = "";
  dp.querySelectorAll("style").forEach((s) => { customCss += (s.textContent || "") + "\n"; });

  // best-effort fetch of linked stylesheets (CORS-permitting)
  const hrefs = [...dp.querySelectorAll('link[rel~="stylesheet"]')].map((l) => l.getAttribute("href")).filter(Boolean);
  let skippedLinks = 0;
  for (const href of hrefs) {
    try {
      const res = await fetch(href, { mode: "cors" });
      if (res.ok) customCss += "\n/* " + href + " */\n" + (await res.text()) + "\n";
      else skippedLinks++;
    } catch (e) { skippedLinks++; }
  }

  const root = makeNode("body", { id: "root" });
  root.styles = makeStyleMap();
  const body = dp.body || dp.querySelector("body");
  if (body) for (const child of body.children) {
    const n = elementToNode(child);
    if (n) root.children.push(n);
  }

  return { root, customCss: customCss.trim(), skippedLinks };
}
