/* OG Image Studio — composes /api/og calls on api.tools.ranzlappen.com.
 *
 * State mirrors the engine's DEFAULTS object. Only fields that differ
 * from defaults are sent: flat `title`/`subtitle`/`theme` for the
 * legacy/link-friendly knobs (priority on the server), plus one
 * base64url-encoded `cfg=` for everything else. Hash uses the same
 * shape so URLs and hashes round-trip cleanly.
 */

const API = "https://api.tools.ranzlappen.com/api/og";
const DEBOUNCE_MS = 300;
const TITLE_MAX = 80;
const SUBTITLE_MAX = 120;

// Mirror of api/og.js DEFAULTS — must stay in sync. Nested objects
// (brand/eyebrow/url) are diffed per-field, not by deep-equality.
const DEFAULTS = {
  title: "",
  subtitle: "",
  theme: "dark",
  layout: "classic",
  palette: "green",
  bg: "blobs",
  bgAngle: 135,
  size: "og",
  customW: 1200,
  customH: 630,
  font: "sans",
  accentTitleWord: -1,
  divider: true,
  colors: { bg: "", text: "", muted: "", accent: "", accent2: "" },
  brand: { icon: "A", name: "ranzlappen", sub: " / tools", show: true },
  eyebrow: { text: "LIVE · TOOLS", show: true },
  url: { text: "tools.ranzlappen.com", show: true },
};

const PRESETS = {
  "tools-default": {
    title: "Small tools, sharp edges.",
    subtitle: "Open-source, client-only utilities.",
    layout: "classic",
    palette: "green",
    bg: "blobs",
    size: "og",
    theme: "dark",
    font: "sans",
    accentTitleWord: 1,
    divider: true,
    brand: { icon: "A", name: "ranzlappen", sub: " / tools", show: true },
    eyebrow: { text: "LIVE · TOOLS", show: true },
    url: { text: "tools.ranzlappen.com", show: true },
  },
  "hero": {
    title: "Ship the next big thing.",
    subtitle: "A bold announcement card for launches and headlines.",
    layout: "hero",
    palette: "slate",
    bg: "linear",
    bgAngle: 135,
    size: "og",
    theme: "dark",
    font: "sans",
    accentTitleWord: -1,
    divider: false,
    brand: { icon: "A", name: "ranzlappen", sub: " / tools", show: true },
    eyebrow: { show: false, text: "LIVE · TOOLS" },
    url: { show: false, text: "tools.ranzlappen.com" },
  },
  "minimal": {
    title: "Less, but better.",
    subtitle: "",
    layout: "minimal",
    palette: "mono",
    bg: "solid",
    size: "og",
    theme: "dark",
    font: "sans",
    accentTitleWord: -1,
    divider: false,
    brand: { show: false, icon: "A", name: "ranzlappen", sub: " / tools" },
    eyebrow: { show: false, text: "LIVE · TOOLS" },
    url: { text: "tools.ranzlappen.com", show: true },
  },
  "twitter-banner": {
    title: "Sharp edges. Wide canvas.",
    subtitle: "A wider format for header cards and feature posts.",
    layout: "split",
    palette: "amber",
    bg: "dots",
    size: "twitter",
    theme: "dark",
    font: "sans",
    accentTitleWord: -1,
    divider: true,
    brand: { icon: "A", name: "ranzlappen", sub: " / tools", show: true },
    eyebrow: { text: "FEATURED", show: true },
    url: { text: "tools.ranzlappen.com", show: true },
  },
  "square-post": {
    title: "Quiet, deliberate work.",
    subtitle: "A square card built for social feeds.",
    layout: "centered",
    palette: "violet",
    bg: "noise",
    size: "square",
    theme: "dark",
    font: "serif",
    accentTitleWord: -1,
    divider: true,
    brand: { icon: "A", name: "ranzlappen", sub: " / tools", show: true },
    eyebrow: { text: "ESSAY", show: true },
    url: { text: "tools.ranzlappen.com", show: true },
  },
};

const SAMPLE = {
  title: "JSON Formatter",
  subtitle: "Pretty-print, minify, validate — entirely in the browser.",
};

const SIZE_DIMS = {
  og:       { w: 1200, h: 630  },
  twitter:  { w: 1200, h: 675  },
  linkedin: { w: 1200, h: 627  },
  square:   { w: 1080, h: 1080 },
};

const HASH_FLAT_BUDGET = 180;

// ── State + utilities ───────────────────────────────────────────────

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const state = clone(DEFAULTS);
let debounceTimer = null;
let statusTimer = null;

function clone(o) {
  if (Array.isArray(o)) return o.map(clone);
  if (o && typeof o === "object") {
    const out = {};
    for (const k of Object.keys(o)) out[k] = clone(o[k]);
    return out;
  }
  return o;
}

function initialTheme() {
  try {
    return localStorage.getItem("tools:theme") === "light" ? "light" : "dark";
  } catch (e) {
    return "dark";
  }
}

function encodeCfg(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCfg(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  b64 = b64 + "=".repeat(pad);
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch (e) {
    // fall through
  }
  return null;
}

// Compute the minimal cfg diff vs DEFAULTS, excluding flat fields.
function diffCfg() {
  const diff = {};
  // Top-level scalars (excluding flat title/subtitle/theme).
  for (const k of ["layout", "palette", "bg", "bgAngle", "size", "font", "accentTitleWord", "divider"]) {
    if (state[k] !== DEFAULTS[k]) diff[k] = state[k];
  }
  // Custom size: only relevant when size === "custom"; serialize as WxH.
  if (state.size === "custom") {
    const w = clampInt(state.customW, 600, 2400);
    const h = clampInt(state.customH, 600, 2400);
    diff.size = `${w}x${h}`;
  }
  // Colour overrides (only non-empty HEX values).
  const colors = {};
  for (const k of Object.keys(DEFAULTS.colors)) {
    const v = (state.colors[k] || "").trim();
    if (v && /^#([0-9a-f]{3,8})$/i.test(v)) colors[k] = v;
  }
  if (Object.keys(colors).length) diff.colors = colors;
  // Nested object diffs (brand/eyebrow/url).
  for (const k of ["brand", "eyebrow", "url"]) {
    const sub = {};
    for (const sk of Object.keys(DEFAULTS[k])) {
      if (state[k][sk] !== DEFAULTS[k][sk]) sub[sk] = state[k][sk];
    }
    if (Object.keys(sub).length) diff[k] = sub;
  }
  return diff;
}

function clampInt(v, lo, hi) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function buildUrl({ bust = false } = {}) {
  const params = new URLSearchParams();
  if (state.title) params.set("title", state.title);
  if (state.subtitle) params.set("subtitle", state.subtitle);
  if (state.theme !== "dark") params.set("theme", state.theme);
  const cfg = diffCfg();
  if (Object.keys(cfg).length) params.set("cfg", encodeCfg(cfg));
  if (bust) params.set("t", String(Date.now()));
  const qs = params.toString();
  return qs ? `${API}?${qs}` : API;
}

// ── Hash hybrid encoding ────────────────────────────────────────────

const FLAT_HASH_KEYS = new Set([
  "title", "subtitle", "theme", "layout", "palette", "bg", "bgAngle",
  "size", "font", "accentTitleWord", "divider",
]);

function syncHash() {
  // Try flat hash first (readable). If it exceeds the budget, switch
  // to base64url(JSON(diff)) under `#c=`.
  const flat = new URLSearchParams();
  if (state.title) flat.set("title", state.title);
  if (state.subtitle) flat.set("subtitle", state.subtitle);
  if (state.theme !== "dark") flat.set("theme", state.theme);
  const cfg = diffCfg();
  for (const k of Object.keys(cfg)) {
    if (FLAT_HASH_KEYS.has(k) && (typeof cfg[k] !== "object")) {
      flat.set(k, String(cfg[k]));
    }
  }
  // If nested cfg fields (colors/brand/eyebrow/url) are present, flat
  // mode can't represent them — fall back to base64.
  const hasNested = Object.keys(cfg).some((k) => typeof cfg[k] === "object");
  const flatStr = flat.toString();
  let next;
  if (!hasNested && flatStr.length <= HASH_FLAT_BUDGET) {
    next = flatStr ? `#${flatStr}` : "";
  } else {
    // Build full diff (everything non-default) for the base64 form.
    const full = {};
    if (state.title) full.title = state.title;
    if (state.subtitle) full.subtitle = state.subtitle;
    if (state.theme !== "dark") full.theme = state.theme;
    Object.assign(full, cfg);
    const encoded = encodeCfg(full);
    next = `#c=${encoded}`;
  }
  if (next !== location.hash) {
    history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  }
}

function readHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return null;
  // base64 form: #c=<base64url>
  if (raw.startsWith("c=")) {
    return decodeCfg(raw.slice(2));
  }
  // flat form
  const params = new URLSearchParams(raw);
  const out = {};
  for (const [k, v] of params.entries()) {
    if (k === "title")             out.title = v.slice(0, TITLE_MAX);
    else if (k === "subtitle")     out.subtitle = v.slice(0, SUBTITLE_MAX);
    else if (k === "theme")        { if (v === "dark" || v === "light") out.theme = v; }
    else if (k === "layout")       out.layout = v;
    else if (k === "palette")      out.palette = v;
    else if (k === "bg")           out.bg = v;
    else if (k === "bgAngle")      out.bgAngle = parseInt(v, 10);
    else if (k === "size")         out.size = v;
    else if (k === "font")         out.font = v;
    else if (k === "accentTitleWord") out.accentTitleWord = parseInt(v, 10);
    else if (k === "divider")      out.divider = v !== "false";
  }
  return out;
}

// ── Apply state ↔ DOM ──────────────────────────────────────────────

const els = {};

function cacheEls() {
  els.title           = $("#og-title");
  els.subtitle        = $("#og-subtitle");
  els.titleCount      = $("#og-title-count");
  els.subtitleCount   = $("#og-subtitle-count");
  els.brandIcon       = $("#og-brand-icon");
  els.brandName       = $("#og-brand-name");
  els.brandSub        = $("#og-brand-sub");
  els.brandShow       = $("#og-brand-show");
  els.eyebrowText     = $("#og-eyebrow-text");
  els.eyebrowShow     = $("#og-eyebrow-show");
  els.urlText         = $("#og-url-text");
  els.urlShow         = $("#og-url-show");
  els.divider         = $("#og-divider");
  els.customWrap      = $("#og-custom-size");
  els.customW         = $("#og-custom-w");
  els.customH         = $("#og-custom-h");
  els.accentWord      = $("#og-accent-word");
  els.bgAngleWrap     = $("#og-bg-angle");
  els.bgAngleInput    = $("#og-bg-angle-input");
  els.bgAngleVal      = $("#og-bg-angle-val");
  els.previewImg      = $("#og-preview");
  els.previewLabel    = $("#og-preview-label");
  els.previewFrame    = $("#og-preview-frame");
  els.urlEcho         = $("#og-url-echo");
  els.statusEl        = $("#og-status");
  els.statusText      = $("#og-status-text");
}

function syncChipGroup(attr, value) {
  $$(`[data-${attr}]`).forEach((btn) => {
    if (btn.classList.contains("chip")) {
      btn.setAttribute("aria-pressed", btn.dataset[attr] === String(value) ? "true" : "false");
    }
  });
}

function syncDom() {
  els.title.value = state.title;
  els.subtitle.value = state.subtitle;
  els.titleCount.textContent = `${state.title.length} / ${TITLE_MAX}`;
  els.titleCount.classList.toggle("is-warn", state.title.length >= TITLE_MAX - 4);
  els.subtitleCount.textContent = `${state.subtitle.length} / ${SUBTITLE_MAX}`;
  els.subtitleCount.classList.toggle("is-warn", state.subtitle.length >= SUBTITLE_MAX - 4);

  els.brandIcon.value = state.brand.icon;
  els.brandName.value = state.brand.name;
  els.brandSub.value  = state.brand.sub;
  els.brandShow.checked = state.brand.show;

  els.eyebrowText.value = state.eyebrow.text;
  els.eyebrowShow.checked = state.eyebrow.show;

  els.urlText.value = state.url.text;
  els.urlShow.checked = state.url.show;

  els.divider.checked = state.divider;
  els.accentWord.value = String(state.accentTitleWord);

  // Hex overrides
  for (const k of Object.keys(DEFAULTS.colors)) {
    const txt = document.querySelector(`[data-hex-text="${k}"]`);
    const clr = document.querySelector(`[data-hex-color="${k}"]`);
    if (txt) txt.value = state.colors[k] || "";
    if (clr) clr.value = expandHex(state.colors[k]) || "#000000";
  }

  // Chip groups
  syncChipGroup("layout", state.layout);
  syncChipGroup("palette", state.palette);
  syncChipGroup("bg", state.bg);
  syncChipGroup("theme", state.theme);
  syncChipGroup("font", state.font);
  syncChipGroup("size", state.size);

  // Custom size visibility + values
  els.customWrap.classList.toggle("is-collapsed", state.size !== "custom");
  els.customW.value = String(state.customW);
  els.customH.value = String(state.customH);

  // Bg angle visibility + value
  els.bgAngleWrap.classList.toggle("is-collapsed", state.bg !== "linear");
  els.bgAngleInput.value = String(state.bgAngle);
  els.bgAngleVal.textContent = String(state.bgAngle);

  // Preview label + aspect ratio
  const dims = state.size === "custom"
    ? { w: clampInt(state.customW, 600, 2400), h: clampInt(state.customH, 600, 2400) }
    : SIZE_DIMS[state.size] || SIZE_DIMS.og;
  els.previewLabel.textContent = `${dims.w}×${dims.h}`;
  els.previewFrame.style.setProperty("--og-aspect", `${dims.w} / ${dims.h}`);
}

function expandHex(v) {
  if (!v) return "";
  // <input type="color"> wants #rrggbb. If the value is short or has alpha, normalize.
  const m = String(v).match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return "";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length > 6) h = h.slice(0, 6);
  if (h.length !== 6) return "";
  return "#" + h.toLowerCase();
}

function render({ bust = false } = {}) {
  els.previewImg.src = buildUrl({ bust });
  els.urlEcho.textContent = buildUrl({ bust: false });
  syncHash();
}

function showStatus(msg, tone = "info") {
  els.statusText.textContent = msg;
  els.statusEl.classList.remove("is-hidden", "banner--info", "banner--warn", "banner--error");
  els.statusEl.classList.add(tone === "error" ? "banner--error" : tone === "warn" ? "banner--warn" : "banner--info");
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => els.statusEl.classList.add("is-hidden"), 2400);
}

function debounced(fn) {
  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      fn();
    }, DEBOUNCE_MS);
  };
}

// ── Mutations ──────────────────────────────────────────────────────

function setField(path, value, { immediate = false } = {}) {
  if (path.includes(".")) {
    const [head, tail] = path.split(".");
    state[head] = { ...state[head], [tail]: value };
  } else {
    state[path] = value;
  }
  syncDom();
  if (immediate) {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    render({ bust: false });
  } else {
    debouncedRender();
  }
}

const debouncedRender = debounced(() => render({ bust: true }));

function applyPartial(partial, { immediate = false } = {}) {
  // Merge partial into state — supports nested brand/eyebrow/url/colors.
  for (const k of Object.keys(partial)) {
    const v = partial[k];
    if (v && typeof v === "object" && !Array.isArray(v) && state[k] && typeof state[k] === "object") {
      state[k] = { ...state[k], ...v };
    } else {
      state[k] = v;
    }
  }
  syncDom();
  if (immediate) {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    render({ bust: false });
  } else {
    debouncedRender();
  }
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  // Reset to defaults first, then overlay the preset.
  Object.assign(state, clone(DEFAULTS));
  state.theme = initialTheme();  // preserve user's theme
  applyPartial(p, { immediate: true });
  showStatus(`Loaded preset "${name}".`);
}

function reset() {
  Object.assign(state, clone(DEFAULTS));
  state.theme = initialTheme();
  syncDom();
  render({ bust: false });
}

function loadSample() {
  applyPartial(SAMPLE, { immediate: true });
}

// ── Download + clipboard ───────────────────────────────────────────

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function downloadPng() {
  const url = buildUrl({ bust: false });
  showStatus("Downloading…");
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    })
    .then((blob) => {
      const objUrl = URL.createObjectURL(blob);
      const slug = state.title ? slugify(state.title) : "";
      const name = slug ? `og-image-${slug}.png` : "og-image.png";
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      showStatus(`Saved ${name}`);
    })
    .catch(() => {
      showStatus("Download blocked (likely CORS). Open the URL in a new tab to save.", "warn");
    });
}

function copyUrl() {
  const url = buildUrl({ bust: false });
  if (!navigator.clipboard) {
    showStatus("Clipboard unavailable — select the URL above to copy.", "warn");
    return;
  }
  navigator.clipboard.writeText(url)
    .then(() => showStatus("URL copied to clipboard"))
    .catch(() => showStatus("Copy failed — select the URL above to copy.", "warn"));
}

// ── Event wiring ───────────────────────────────────────────────────

function wireInputs() {
  els.title.addEventListener("input", (e) => setField("title", e.target.value.slice(0, TITLE_MAX)));
  els.subtitle.addEventListener("input", (e) => setField("subtitle", e.target.value.slice(0, SUBTITLE_MAX)));
  els.brandIcon.addEventListener("input", (e) => setField("brand.icon", e.target.value.slice(0, 2)));
  els.brandName.addEventListener("input", (e) => setField("brand.name", e.target.value.slice(0, 24)));
  els.brandSub.addEventListener("input", (e) => setField("brand.sub", e.target.value.slice(0, 24)));
  els.brandShow.addEventListener("change", (e) => setField("brand.show", e.target.checked, { immediate: true }));
  els.eyebrowText.addEventListener("input", (e) => setField("eyebrow.text", e.target.value.slice(0, 32)));
  els.eyebrowShow.addEventListener("change", (e) => setField("eyebrow.show", e.target.checked, { immediate: true }));
  els.urlText.addEventListener("input", (e) => setField("url.text", e.target.value.slice(0, 48)));
  els.urlShow.addEventListener("change", (e) => setField("url.show", e.target.checked, { immediate: true }));
  els.divider.addEventListener("change", (e) => setField("divider", e.target.checked, { immediate: true }));

  els.customW.addEventListener("input", (e) => setField("customW", clampInt(e.target.value, 600, 2400)));
  els.customH.addEventListener("input", (e) => setField("customH", clampInt(e.target.value, 600, 2400)));
  els.accentWord.addEventListener("input", (e) => setField("accentTitleWord", clampInt(e.target.value, -1, 20)));

  els.bgAngleInput.addEventListener("input", (e) => {
    state.bgAngle = clampInt(e.target.value, 0, 359);
    els.bgAngleVal.textContent = String(state.bgAngle);
    debouncedRender();
  });

  // Stepper buttons for accent-word
  $$("[data-step]").forEach((b) => {
    b.addEventListener("click", () => {
      const delta = parseInt(b.dataset.step, 10);
      const next = clampInt(state.accentTitleWord + delta, -1, 20);
      setField("accentTitleWord", next, { immediate: true });
    });
  });
}

function wireChips() {
  $$("[data-layout]").forEach((c) => c.addEventListener("click", () => setField("layout", c.dataset.layout, { immediate: true })));
  $$("[data-palette]").forEach((c) => c.addEventListener("click", () => setField("palette", c.dataset.palette, { immediate: true })));
  $$("[data-bg]").forEach((c) => c.addEventListener("click", () => setField("bg", c.dataset.bg, { immediate: true })));
  $$("[data-theme]").forEach((c) => c.addEventListener("click", () => setField("theme", c.dataset.theme, { immediate: true })));
  $$("[data-font]").forEach((c) => c.addEventListener("click", () => setField("font", c.dataset.font, { immediate: true })));
  $$("[data-size]").forEach((c) => c.addEventListener("click", () => setField("size", c.dataset.size, { immediate: true })));
  $$("[data-preset]").forEach((c) => c.addEventListener("click", () => applyPreset(c.dataset.preset)));
}

function wireHex() {
  $$("[data-hex-text]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const k = input.dataset.hexText;
      const v = e.target.value.trim();
      if (!v || /^#([0-9a-f]{3,8})$/i.test(v)) {
        setField(`colors.${k}`, v);
      } else {
        setField(`colors.${k}`, "");
      }
    });
  });
  $$("[data-hex-color]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const k = input.dataset.hexColor;
      setField(`colors.${k}`, e.target.value.toLowerCase());
    });
  });
  $$("[data-hex-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.hexClear;
      setField(`colors.${k}`, "", { immediate: true });
    });
  });
}

function wireActions() {
  $$("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "copy-url") copyUrl();
      else if (action === "download") downloadPng();
      else if (action === "reset") reset();
      else if (action === "sample") loadSample();
    });
  });
}

// ── Boot ───────────────────────────────────────────────────────────

cacheEls();
wireInputs();
wireChips();
wireHex();
wireActions();

window.addEventListener("hashchange", () => {
  const fromHash = readHash();
  if (fromHash) applyPartial(fromHash, { immediate: true });
});

// Mobile: collapse all sections by default. Desktop keeps them open.
if (window.matchMedia("(max-width: 640px)").matches) {
  $$("details.og-section").forEach((d) => d.removeAttribute("open"));
}

// Hydrate from hash if present; otherwise reset to defaults but keep
// the page's current theme as a sane starting point.
const fromHash = readHash();
state.theme = initialTheme();
if (fromHash) applyPartial(fromHash);
syncDom();
render({ bust: false });
