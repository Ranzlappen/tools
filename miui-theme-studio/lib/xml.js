/* XML builders + parsers for the .mtz format.
   Built by hand with escaped string templates; parsed with the built-in
   DOMParser. No external dependencies. */

import { DEFAULT_UI_VERSION } from "./mtz-spec.js";

export function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const HEAD = '<?xml version="1.0" encoding="utf-8" standalone="no"?>\n';

// ── description.xml (required root manifest) ──────────────────────────────
export function description(meta = {}) {
  const m = {
    title: meta.title || "Untitled Theme",
    designer: meta.designer || "",
    author: meta.author || "",
    version: meta.version || 1,
    uiVersion: meta.uiVersion || DEFAULT_UI_VERSION,
  };
  return (
    HEAD +
    "<MIUI-Theme>\n" +
    `  <title>${esc(m.title)}</title>\n` +
    `  <designer>${esc(m.designer)}</designer>\n` +
    `  <author>${esc(m.author)}</author>\n` +
    `  <version>${esc(m.version)}</version>\n` +
    `  <uiVersion>${esc(m.uiVersion)}</uiVersion>\n` +
    "</MIUI-Theme>\n"
  );
}

// ── theme_values.xml (system package color/integer overrides) ─────────────
export function themeValues(pkg = {}) {
  const colors = pkg.colors || [];
  const integers = pkg.integers || [];
  const lines = [];
  for (const c of colors) {
    if (!c.name) continue;
    lines.push(`  <color name="${esc(c.name)}">${esc(c.value || "#FFFFFFFF")}</color>`);
  }
  for (const i of integers) {
    if (!i.name) continue;
    lines.push(`  <integer name="${esc(i.name)}">${esc(i.value ?? 0)}</integer>`);
  }
  return HEAD + "<MIUI_Theme_Values>\n" + lines.join("\n") + (lines.length ? "\n" : "") + "</MIUI_Theme_Values>\n";
}

// ── MAML lockscreen manifest (lockscreen/advance/manifest.xml) ────────────
function mamlAttrs(el) {
  // Common attribute set across MAML element types; emit only present keys.
  const keys = ["src", "x", "y", "align", "format", "fontSize", "color", "name"];
  return keys
    .filter((k) => el[k] !== undefined && el[k] !== "")
    .map((k) => {
      const attr = k === "fontSize" ? "fontSize" : k;
      return `${attr}="${esc(el[k])}"`;
    })
    .join(" ");
}

export function lockscreenManifest(maml = {}) {
  const root =
    `<Lockscreen frameRate="${esc(maml.frameRate || 60)}" ` +
    `screenWidth="${esc(maml.screenWidth || 1220)}" ` +
    `screenHeight="${esc(maml.screenHeight || 2712)}">`;
  const els = (maml.elements || [])
    .map((el) => `  <${el.type} ${mamlAttrs(el)} />`)
    .join("\n");
  return HEAD + root + "\n" + els + (els ? "\n" : "") + "</Lockscreen>\n";
}

// ── MAML fancy (animated) icon manifest ───────────────────────────────────
export function fancyIconManifest(cfg = {}) {
  const root =
    `<Icon version="1" frameRate="${esc(cfg.frameRate || 30)}" ` +
    `width="${esc(cfg.width || 136)}" height="${esc(cfg.height || 136)}">`;
  const els = (cfg.elements || [])
    .map((el) => `  <${el.type} ${mamlAttrs(el)} />`)
    .join("\n");
  return HEAD + root + "\n" + els + (els ? "\n" : "") + "</Icon>\n";
}

// ── parsers ───────────────────────────────────────────────────────────────
function parse(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Malformed XML");
  }
  return doc;
}

export function parseDescription(text) {
  const doc = parse(text);
  const get = (tag) => {
    const el = doc.querySelector(tag);
    return el ? el.textContent.trim() : "";
  };
  return {
    title: get("title") || "Imported Theme",
    designer: get("designer"),
    author: get("author"),
    version: Number(get("version")) || 1,
    uiVersion: Number(get("uiVersion")) || DEFAULT_UI_VERSION,
  };
}

export function parseThemeValues(text) {
  const doc = parse(text);
  const colors = [...doc.querySelectorAll("color")].map((el) => ({
    name: el.getAttribute("name") || "",
    value: el.textContent.trim(),
  }));
  const integers = [...doc.querySelectorAll("integer")].map((el) => ({
    name: el.getAttribute("name") || "",
    value: Number(el.textContent.trim()) || 0,
  }));
  return { colors, integers };
}

function elFromNode(node) {
  const el = { type: node.tagName };
  for (const attr of node.attributes) {
    const v = attr.value;
    const num = Number(v);
    el[attr.name] = v !== "" && !Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(v) ? num : v;
  }
  return el;
}

export function parseLockscreenManifest(text) {
  const doc = parse(text);
  const root = doc.querySelector("Lockscreen") || doc.documentElement;
  const maml = {
    frameRate: Number(root.getAttribute("frameRate")) || 60,
    screenWidth: Number(root.getAttribute("screenWidth")) || 1220,
    screenHeight: Number(root.getAttribute("screenHeight")) || 2712,
    elements: [...root.children].map(elFromNode),
  };
  return maml;
}

export function parseFancyIcon(text) {
  const doc = parse(text);
  const root = doc.querySelector("Icon") || doc.documentElement;
  return {
    frameRate: Number(root.getAttribute("frameRate")) || 30,
    width: Number(root.getAttribute("width")) || 136,
    height: Number(root.getAttribute("height")) || 136,
    elements: [...root.children].map(elFromNode),
  };
}
