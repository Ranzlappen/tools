/* schema.js — the document model. Pure data: no DOM, no globals beyond
   crypto/Date for id generation. Everything the editor renders, inspects,
   and exports is a projection of the tree defined here.

   A Doc is the single source of truth. The preview iframe is a render
   target only — the model is never read back out of the DOM. */

export const SCHEMA_VERSION = 1;

/* Editing layers, desktop-first. `base` is unconditional; `tablet`
   overrides it at <=1024px; `mobile` overrides tablet+base at <=640px.
   The style-engine emits real @media blocks so preview == export. */
export const BREAKPOINTS = ["base", "tablet", "mobile"];

/* Device view → iframe frame width + the editing layer it activates. */
export const DEVICES = {
  desktop: { label: "Desktop", width: 1280, layer: "base", max: null },
  tablet: { label: "Tablet", width: 834, layer: "tablet", max: 1024 },
  mobile: { label: "Mobile", width: 390, layer: "mobile", max: 640 },
};

export const VOID_TAGS = new Set([
  "img", "br", "hr", "input", "meta", "link", "area",
  "base", "col", "embed", "source", "track", "wbr",
]);

export const isVoid = (tag) => VOID_TAGS.has(tag);

/* Tag catalog. `text` = element naturally holds text content the user can
   edit. `children` = element accepts child nodes. `attrs` = the whitelisted
   attribute spec for the Attributes inspector tab. */
export const TAGS = {
  // ── layout ──
  div: { label: "Div", group: "Layout", children: true },
  section: { label: "Section", group: "Layout", children: true },
  header: { label: "Header", group: "Layout", children: true },
  footer: { label: "Footer", group: "Layout", children: true },
  nav: { label: "Nav", group: "Layout", children: true },
  main: { label: "Main", group: "Layout", children: true },
  article: { label: "Article", group: "Layout", children: true },
  aside: { label: "Aside", group: "Layout", children: true },

  // ── text ──
  h1: { label: "Heading 1", group: "Text", text: true, defaultText: "Heading" },
  h2: { label: "Heading 2", group: "Text", text: true, defaultText: "Heading" },
  h3: { label: "Heading 3", group: "Text", text: true, defaultText: "Heading" },
  p: { label: "Paragraph", group: "Text", text: true, defaultText: "Text paragraph." },
  span: { label: "Span", group: "Text", text: true, defaultText: "span" },
  blockquote: { label: "Quote", group: "Text", text: true, defaultText: "Quote" },
  a: {
    label: "Link", group: "Text", text: true, defaultText: "Link",
    attrs: { href: { type: "url" }, target: { type: "enum", options: ["", "_blank", "_self"] }, rel: { type: "text" } },
  },

  // ── media ──
  img: {
    label: "Image", group: "Media",
    attrs: {
      src: { type: "url" }, alt: { type: "text" },
      width: { type: "number" }, height: { type: "number" },
      loading: { type: "enum", options: ["", "lazy", "eager"] },
    },
    defaultAttrs: { src: "https://placehold.co/400x240", alt: "Image" },
  },
  video: {
    label: "Video", group: "Media",
    attrs: {
      src: { type: "url" }, poster: { type: "url" },
      controls: { type: "bool" }, autoplay: { type: "bool" },
      loop: { type: "bool" }, muted: { type: "bool" },
    },
    defaultAttrs: { controls: true },
  },
  iframe: {
    label: "Embed", group: "Media",
    attrs: { src: { type: "url" }, title: { type: "text" }, allow: { type: "text" } },
    defaultAttrs: { src: "https://example.com" },
  },

  // ── form ──
  button: { label: "Button", group: "Form", text: true, defaultText: "Button", attrs: { type: { type: "enum", options: ["button", "submit", "reset"] } } },
  input: {
    label: "Input", group: "Form",
    attrs: {
      type: { type: "enum", options: ["text", "email", "password", "number", "search", "tel", "url", "checkbox", "radio"] },
      placeholder: { type: "text" }, value: { type: "text" }, name: { type: "text" },
      required: { type: "bool" }, disabled: { type: "bool" },
    },
    defaultAttrs: { type: "text", placeholder: "Enter text…" },
  },
  textarea: { label: "Textarea", group: "Form", attrs: { placeholder: { type: "text" }, name: { type: "text" }, rows: { type: "number" } }, defaultAttrs: { placeholder: "Enter text…", rows: 4 } },
  label: { label: "Label", group: "Form", text: true, defaultText: "Label", attrs: { for: { type: "text" } } },
  form: { label: "Form", group: "Form", children: true, attrs: { action: { type: "url" }, method: { type: "enum", options: ["", "get", "post"] } } },

  // ── lists ──
  ul: { label: "Bullet list", group: "List", children: true },
  ol: { label: "Numbered list", group: "List", children: true },
  li: { label: "List item", group: "List", text: true, defaultText: "List item" },

  // ── misc ──
  hr: { label: "Divider", group: "Misc" },
  br: { label: "Line break", group: "Misc" },
};

export const canHaveChildren = (tag) => !!(TAGS[tag] && TAGS[tag].children);
export const canHaveText = (tag) => !!(TAGS[tag] && TAGS[tag].text);
export const tagInfo = (tag) => TAGS[tag] || { label: tag, group: "Misc" };

/* Global attributes offered for every element. */
export const GLOBAL_ATTRS = {
  id: { type: "text" },
  title: { type: "text" },
  role: { type: "text" },
  "aria-label": { type: "text" },
};

/* ── id generation ─────────────────────────────────────────────────────── */
let seq = 0;
export function uid(prefix = "n") {
  seq = (seq + 1) % 1e6;
  const t = Date.now().toString(36);
  return `${prefix}_${t}${seq.toString(36)}`;
}

/* ── factories ─────────────────────────────────────────────────────────── */
export function makeStyleMap() {
  return { base: {}, tablet: {}, mobile: {} };
}

export function makeNode(tag, opts = {}) {
  const info = tagInfo(tag);
  const node = {
    id: opts.id || uid(),
    tag,
    attrs: { ...(info.defaultAttrs || {}), ...(opts.attrs || {}) },
    classes: opts.classes ? [...opts.classes] : [],
    text: opts.text != null ? opts.text : (info.text ? (info.defaultText || "") : ""),
    children: [],
    styles: opts.styles || makeStyleMap(),
    behaviors: opts.behaviors ? [...opts.behaviors] : [],
    name: opts.name || "",
    locked: false,
    hidden: false,
  };
  if (opts.children) node.children = opts.children;
  return node;
}

export function defaultDoc() {
  const root = makeNode("body", { id: "root" });
  root.styles.base = {
    "font-family": "system-ui, sans-serif",
    color: "#1a2a22",
    background: "#ffffff",
    margin: "0",
    "min-height": "100vh",
    padding: "0",
  };
  // body is a synthetic root container; allow children explicitly.
  return {
    schema: SCHEMA_VERSION,
    meta: { title: "Untitled page", lang: "en", description: "" },
    root,
    globals: { fonts: [], customCss: "", bodyStyles: makeStyleMap() },
    assets: [], // uploaded media: { id, name, type, dataUrl } — referenced as "asset:<id>"
    ui: { selectedId: null, hoverId: null, device: "desktop", expandedIds: ["root"], zoom: 1 },
  };
}

/* `body` is the root tag but not in TAGS; treat it as a children container. */
export function acceptsChildren(tag) {
  return tag === "body" || canHaveChildren(tag);
}

/* ── cloning ───────────────────────────────────────────────────────────── */
export function cloneDoc(doc) {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc));
}
export function cloneNode(node) {
  const copy = typeof structuredClone === "function" ? structuredClone(node) : JSON.parse(JSON.stringify(node));
  // fresh ids so a duplicated subtree never collides
  const reid = (n) => { n.id = uid(); n.children.forEach(reid); };
  reid(copy);
  return copy;
}

/* ── tree traversal ────────────────────────────────────────────────────── */
export function walk(node, fn, parent = null, index = 0) {
  fn(node, parent, index);
  node.children.forEach((c, i) => walk(c, fn, node, i));
}

export function findNode(root, id) {
  if (!id) return null;
  let found = null;
  walk(root, (n) => { if (n.id === id) found = n; });
  return found;
}

export function findParent(root, id) {
  let parent = null;
  walk(root, (n) => {
    if (n.children.some((c) => c.id === id)) parent = n;
  });
  return parent;
}

/* true if `maybeAncestorId` is an ancestor of (or equal to) `id`. Used to
   block dropping a node into its own subtree. */
export function isAncestor(root, maybeAncestorId, id) {
  const node = findNode(root, maybeAncestorId);
  if (!node) return false;
  let hit = false;
  walk(node, (n) => { if (n.id === id) hit = true; });
  return hit;
}

/* ── migration ─────────────────────────────────────────────────────────── */
export function migrate(doc) {
  if (!doc || typeof doc !== "object") return defaultDoc();
  if (!doc.schema) doc.schema = SCHEMA_VERSION;
  // future version bumps branch here
  // normalize shape defensively
  if (!doc.ui) doc.ui = defaultDoc().ui;
  if (!doc.globals) doc.globals = { fonts: [], customCss: "", bodyStyles: makeStyleMap() };
  if (!Array.isArray(doc.assets)) doc.assets = [];
  walk(doc.root, (n) => {
    if (!n.styles) n.styles = makeStyleMap();
    for (const bp of BREAKPOINTS) if (!n.styles[bp]) n.styles[bp] = {};
    if (!Array.isArray(n.classes)) n.classes = [];
    if (!Array.isArray(n.behaviors)) n.behaviors = [];
    if (!Array.isArray(n.children)) n.children = [];
    if (!n.attrs) n.attrs = {};
  });
  return doc;
}
