/* api/og.js — dynamic Open Graph image generator (layered engine).
 *
 * Flat query params (legacy, take priority over cfg.* overrides):
 *   title    — main headline
 *   subtitle — tagline below
 *   theme    — "dark" (default) or "light"
 *
 * Compound param:
 *   cfg      — base64url-encoded JSON. Fields documented in normalizeConfig().
 *
 * Examples:
 *   /api/og
 *   /api/og?title=JSON%20Formatter&subtitle=Pretty-print%2C%20minify
 *   /api/og?cfg=eyJsYXlvdXQiOiJoZXJvIiwicGFsZXR0ZSI6InZpb2xldCJ9
 *
 * Architecture: PALETTES + SIZES + BACKGROUNDS + slot builders + LAYOUTS.
 * Adding a new layout = one new key in LAYOUTS. Adding a new palette
 * or background = one new entry in its table. No JSX (Edge runtime,
 * no transpile step). See CLAUDE.md for hosting / standards context.
 */

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// ─── Palettes ─────────────────────────────────────────────────────────

const PALETTES = {
  green: {
    dark: {
      bg: "#0b1210", text: "#dce8e2", muted: "#7e948a",
      accent: "#4ade80", accent2: "#a7f3d0",
      chip: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.30)",
      pill: "rgba(11,18,16,0.55)",
    },
    light: {
      bg: "#f5f9f7", text: "#1a2a22", muted: "#5a7068",
      accent: "#16a34a", accent2: "#15803d",
      chip: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.30)",
      pill: "rgba(255,255,255,0.65)",
    },
  },
  slate: {
    dark: {
      bg: "#0f172a", text: "#e2e8f0", muted: "#94a3b8",
      accent: "#7dd3fc", accent2: "#a5b4fc",
      chip: "rgba(125,211,252,0.10)", border: "rgba(125,211,252,0.32)",
      pill: "rgba(15,23,42,0.55)",
    },
    light: {
      bg: "#f1f5f9", text: "#0f172a", muted: "#475569",
      accent: "#0369a1", accent2: "#4338ca",
      chip: "rgba(3,105,161,0.08)", border: "rgba(3,105,161,0.30)",
      pill: "rgba(255,255,255,0.65)",
    },
  },
  amber: {
    dark: {
      bg: "#1c1410", text: "#fef3c7", muted: "#a8916a",
      accent: "#f59e0b", accent2: "#fcd34d",
      chip: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.32)",
      pill: "rgba(28,20,16,0.55)",
    },
    light: {
      bg: "#fffbeb", text: "#451a03", muted: "#92611b",
      accent: "#d97706", accent2: "#b45309",
      chip: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.30)",
      pill: "rgba(255,255,255,0.7)",
    },
  },
  violet: {
    dark: {
      bg: "#1a0f1f", text: "#ede9fe", muted: "#a78bfa",
      accent: "#a78bfa", accent2: "#c4b5fd",
      chip: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.32)",
      pill: "rgba(26,15,31,0.55)",
    },
    light: {
      bg: "#faf5ff", text: "#3b0764", muted: "#7c3aed",
      accent: "#7c3aed", accent2: "#5b21b6",
      chip: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.30)",
      pill: "rgba(255,255,255,0.7)",
    },
  },
  rose: {
    dark: {
      bg: "#1a0e15", text: "#ffe4e6", muted: "#fda4af",
      accent: "#fb7185", accent2: "#fda4af",
      chip: "rgba(251,113,133,0.10)", border: "rgba(251,113,133,0.32)",
      pill: "rgba(26,14,21,0.55)",
    },
    light: {
      bg: "#fff1f2", text: "#4c0519", muted: "#9f1239",
      accent: "#e11d48", accent2: "#9f1239",
      chip: "rgba(225,29,72,0.08)", border: "rgba(225,29,72,0.30)",
      pill: "rgba(255,255,255,0.7)",
    },
  },
  mono: {
    dark: {
      bg: "#0a0a0a", text: "#fafafa", muted: "#a3a3a3",
      accent: "#d4d4d4", accent2: "#737373",
      chip: "rgba(212,212,212,0.08)", border: "rgba(212,212,212,0.28)",
      pill: "rgba(10,10,10,0.6)",
    },
    light: {
      bg: "#fafafa", text: "#0a0a0a", muted: "#525252",
      accent: "#262626", accent2: "#525252",
      chip: "rgba(10,10,10,0.06)", border: "rgba(10,10,10,0.22)",
      pill: "rgba(255,255,255,0.7)",
    },
  },
};

// ─── Sizes ────────────────────────────────────────────────────────────

const SIZES = {
  og:       { w: 1200, h: 630,  pad: 72, headlinePx: 96  },
  twitter:  { w: 1200, h: 675,  pad: 72, headlinePx: 96  },
  linkedin: { w: 1200, h: 627,  pad: 72, headlinePx: 96  },
  square:   { w: 1080, h: 1080, pad: 88, headlinePx: 104 },
};

function resolveSize(spec) {
  if (typeof spec === "string" && SIZES[spec]) return SIZES[spec];
  if (typeof spec === "string") {
    const m = spec.match(/^(\d+)x(\d+)$/i);
    if (m) {
      const w = Math.max(600, Math.min(2400, parseInt(m[1], 10)));
      const h = Math.max(600, Math.min(2400, parseInt(m[2], 10)));
      const minDim = Math.min(w, h);
      return {
        w, h,
        pad: Math.max(40, Math.round(minDim * 0.07)),
        headlinePx: Math.max(48, Math.round(minDim * 0.12)),
      };
    }
  }
  return SIZES.og;
}

// Scale UI font sizes against the size's diagonal-ish reference. The
// 1200×630 og canvas is the baseline (scale = 1.0).
function scale(s, basePx) {
  const k = Math.min(s.w / 1200, s.h / 630);
  return Math.max(10, Math.round(basePx * k));
}

function resolvePalette(cfg) {
  const fam = PALETTES[cfg.palette] || PALETTES.green;
  const base = fam[cfg.theme] || fam.dark;
  const overrides = {};
  if (cfg.colors) {
    for (const k of ["bg", "text", "muted", "accent", "accent2"]) {
      if (typeof cfg.colors[k] === "string" && /^#([0-9a-f]{3,8})$/i.test(cfg.colors[k])) {
        overrides[k] = cfg.colors[k];
      }
    }
  }
  return { ...base, ...overrides };
}

// ─── Backgrounds ──────────────────────────────────────────────────────
//
// Each entry returns ONLY `backgroundColor` (always) + optional
// `backgroundImage` / `backgroundSize`. Never the `background` shorthand
// when a gradient is involved — Satori rejects mixed solid+gradient
// values (see CHANGELOG for the v1 regression that taught us this).

// Deterministic noise dot positions (pre-computed pseudo-random). Kept
// outside the function so the gradient string is stable across renders.
const NOISE_OFFSETS = [
  [7, 11, 0.06],  [22, 4, 0.04],  [41, 17, 0.05], [58, 8, 0.05],
  [71, 14, 0.04], [87, 21, 0.05], [11, 33, 0.05], [27, 41, 0.04],
  [44, 32, 0.06], [61, 38, 0.04], [78, 31, 0.05], [93, 44, 0.04],
  [5, 58, 0.04],  [19, 67, 0.05], [35, 54, 0.04], [51, 63, 0.06],
  [68, 71, 0.04], [84, 59, 0.05], [14, 82, 0.05], [31, 91, 0.04],
  [47, 78, 0.05], [64, 87, 0.04], [81, 83, 0.06], [97, 75, 0.04],
];

const BACKGROUNDS = {
  blobs: (p) => ({
    backgroundColor: p.bg,
    backgroundImage:
      `radial-gradient(circle at 20% 25%, ${p.accent}55, transparent 55%),` +
      `radial-gradient(circle at 85% 30%, ${p.accent2}33, transparent 60%),` +
      `radial-gradient(circle at 35% 100%, ${p.accent2}22, transparent 60%)`,
  }),
  linear: (p, opts) => {
    const ang = Number.isFinite(opts.bgAngle) ? opts.bgAngle : 135;
    return {
      backgroundColor: p.bg,
      backgroundImage: `linear-gradient(${ang}deg, ${p.accent}aa, ${p.accent2}55)`,
    };
  },
  solid: (p) => ({
    backgroundColor: p.bg,
  }),
  dots: (p) => ({
    backgroundColor: p.bg,
    backgroundImage: `radial-gradient(circle, ${p.accent}66 1.5px, transparent 2px)`,
    backgroundSize: "24px 24px",
  }),
  noise: (p) => ({
    backgroundColor: p.bg,
    backgroundImage: NOISE_OFFSETS.map(([x, y, op]) =>
      `radial-gradient(circle at ${x}% ${y}%, ${p.accent}${alphaHex(op)} 1px, transparent 2px)`
    ).join(","),
  }),
};

function alphaHex(op) {
  const v = Math.max(0, Math.min(255, Math.round(op * 255)));
  return v.toString(16).padStart(2, "0");
}

// ─── Element helper ───────────────────────────────────────────────────
//
// el(tag, props, ...children) — tiny createElement-like that returns
// Satori-compatible POJOs. Omits `children` entirely when none are
// passed: Satori treats `children: []` as "multiple children" and
// demands `display: flex` on the parent div (see CHANGELOG).

function el(type, props, ...children) {
  const out = { type, props: { ...(props || {}) } };
  const kept = children.filter((c) => c !== null && c !== undefined && c !== false);
  if (kept.length === 1) out.props.children = kept[0];
  else if (kept.length > 1) out.props.children = kept;
  return out;
}

function clamp(s, n) {
  s = String(s == null ? "" : s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ─── Slot builders ────────────────────────────────────────────────────
//
// Each takes (cfg, palette, size) and returns one element or null
// when the slot is hidden. Callers compose with null-filtering so we
// never end up emitting children: [].

function brandChip(cfg, p, s) {
  if (!cfg.brand || cfg.brand.show === false) return null;
  const tilePx = scale(s, 44);
  const iconPx = scale(s, 26);
  const namePx = scale(s, 22);
  return el(
    "div",
    { style: { display: "flex", alignItems: "center", gap: scale(s, 16) + "px" } },
    el(
      "div",
      {
        style: {
          width: tilePx + "px",
          height: tilePx + "px",
          borderRadius: "8px",
          backgroundColor: p.chip,
          border: `1px solid ${p.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: p.accent,
          fontSize: iconPx + "px",
          fontWeight: 700,
          fontFamily: "sans-serif",
        },
      },
      String(cfg.brand.icon || "A").slice(0, 2),
    ),
    el(
      "div",
      { style: { display: "flex", fontSize: namePx + "px", fontWeight: 600 } },
      el("span", { style: { color: p.text } }, cfg.brand.name || "ranzlappen"),
      el("span", { style: { color: p.muted } }, cfg.brand.sub || " / tools"),
    ),
  );
}

function eyebrow(cfg, p, s) {
  if (!cfg.eyebrow || cfg.eyebrow.show === false) return null;
  const text = clamp(cfg.eyebrow.text || "", 32);
  if (!text) return null;
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        padding: `${scale(s, 8)}px ${scale(s, 18)}px`,
        borderRadius: "999px",
        backgroundColor: p.chip,
        border: `1px solid ${p.border}`,
        color: p.accent,
        fontFamily: "monospace",
        fontSize: scale(s, 14) + "px",
        letterSpacing: "2px",
        alignSelf: "flex-start",
      },
    },
    text,
  );
}

function headlineFontFamily(font) {
  if (font === "serif") return "serif";
  if (font === "mono") return "monospace";
  return "sans-serif";
}

function headline(cfg, p, s) {
  const text = (cfg.title || "").trim();
  if (!text) return null;
  // Shrink for longer titles so they don't blow past the canvas.
  let fontPx = s.headlinePx;
  if (text.length > 24) fontPx = Math.round(fontPx * 0.80);
  if (text.length > 48) fontPx = Math.round(fontPx * 0.78);
  const wrapStyle = {
    display: "flex",
    flexWrap: "wrap",
    fontSize: fontPx + "px",
    fontWeight: 700,
    letterSpacing: "-3px",
    lineHeight: 1.08,
    color: p.text,
    fontFamily: headlineFontFamily(cfg.font),
  };
  const idx = Number.isInteger(cfg.accentTitleWord) ? cfg.accentTitleWord : -1;
  if (idx >= 0) {
    const words = text.split(/\s+/);
    if (idx < words.length) {
      // Satori collapses whitespace between adjacent <span>s under flex,
      // so use explicit per-word marginRight instead of trailing spaces.
      const spans = words.map((w, i) => {
        return el(
          "span",
          {
            style: {
              color: i === idx ? p.accent : p.text,
              marginRight: i < words.length - 1 ? "0.28em" : "0",
            },
          },
          w,
        );
      });
      return el("div", { style: wrapStyle }, ...spans);
    }
  }
  return el("div", { style: wrapStyle }, text);
}

function divider(cfg, p, s) {
  if (cfg.divider === false) return null;
  return el("div", {
    style: {
      height: "2px",
      width: scale(s, 160) + "px",
      backgroundImage: `linear-gradient(90deg, ${p.accent}, transparent)`,
    },
  });
}

function subtitle(cfg, p, s) {
  const text = (cfg.subtitle || "").trim();
  if (!text) return null;
  return el(
    "div",
    {
      style: {
        color: p.muted,
        fontSize: scale(s, 26) + "px",
        marginTop: scale(s, 12) + "px",
        lineHeight: 1.3,
      },
    },
    text,
  );
}

function urlPill(cfg, p, s) {
  if (!cfg.url || cfg.url.show === false) return null;
  const text = clamp(cfg.url.text || "", 48);
  if (!text) return null;
  return el(
    "div",
    {
      style: {
        padding: `${scale(s, 10)}px ${scale(s, 22)}px`,
        borderRadius: "999px",
        backgroundColor: p.pill,
        border: `1px solid ${p.border}`,
        color: p.text,
        fontFamily: "monospace",
        fontSize: scale(s, 16) + "px",
        alignSelf: "flex-start",
      },
    },
    text,
  );
}

// ─── Layouts ──────────────────────────────────────────────────────────

function rootStyle(p, s, bgStyle) {
  return {
    width: s.w + "px",
    height: s.h + "px",
    display: "flex",
    padding: s.pad + "px",
    color: p.text,
    fontFamily: "sans-serif",
    ...bgStyle,
  };
}

const LAYOUTS = {
  classic: (cfg, p, s, parts, bgStyle) => {
    const middleKids = [parts.eyebrow, parts.headline, parts.divider, parts.subtitle].filter(Boolean);
    const middle = middleKids.length
      ? el("div", { style: { display: "flex", flexDirection: "column", gap: scale(s, 16) + "px" } }, ...middleKids)
      : null;
    const bottom = parts.url
      ? el("div", { style: { display: "flex", justifyContent: "flex-end" } }, parts.url)
      : null;
    return el(
      "div",
      { style: { ...rootStyle(p, s, bgStyle), flexDirection: "column", justifyContent: "space-between" } },
      parts.brand, middle, bottom,
    );
  },

  centered: (cfg, p, s, parts, bgStyle) => {
    const middleKids = [parts.eyebrow, parts.headline, parts.divider, parts.subtitle].filter(Boolean);
    const middle = middleKids.length
      ? el(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: scale(s, 16) + "px",
              maxWidth: (s.w - s.pad * 2) + "px",
            },
          },
          ...middleKids,
        )
      : null;
    const top = parts.brand
      ? el("div", { style: { display: "flex", justifyContent: "center" } }, parts.brand)
      : null;
    const bottom = parts.url
      ? el("div", { style: { display: "flex", justifyContent: "center" } }, parts.url)
      : null;
    return el(
      "div",
      {
        style: {
          ...rootStyle(p, s, bgStyle),
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
        },
      },
      top, middle, bottom,
    );
  },

  hero: (cfg, p, s, parts, bgStyle) => {
    // XL headline, eyebrow + divider always off, subtitle below.
    let h = parts.headline;
    if (h && h.props && h.props.style) {
      const cur = parseInt(h.props.style.fontSize, 10) || s.headlinePx;
      h = { ...h, props: { ...h.props, style: { ...h.props.style, fontSize: Math.round(cur * 1.25) + "px", letterSpacing: "-3px" } } };
    }
    const middleKids = [h, parts.subtitle].filter(Boolean);
    const middle = middleKids.length
      ? el("div", { style: { display: "flex", flexDirection: "column", gap: scale(s, 20) + "px" } }, ...middleKids)
      : null;
    const bottom = parts.url
      ? el("div", { style: { display: "flex", justifyContent: "flex-end" } }, parts.url)
      : null;
    return el(
      "div",
      { style: { ...rootStyle(p, s, bgStyle), flexDirection: "column", justifyContent: "space-between" } },
      parts.brand, middle, bottom,
    );
  },

  minimal: (cfg, p, s, parts, bgStyle) => {
    const middle = parts.headline
      ? el(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: "1",
              maxWidth: (s.w - s.pad * 2) + "px",
            },
          },
          parts.headline,
        )
      : null;
    const bottom = parts.url
      ? el("div", { style: { display: "flex", justifyContent: "flex-end" } }, parts.url)
      : null;
    return el(
      "div",
      { style: { ...rootStyle(p, s, bgStyle), flexDirection: "column", justifyContent: "space-between" } },
      middle, bottom,
    );
  },

  split: (cfg, p, s, parts, bgStyle) => {
    // Left column: brand chip pinned top, headline + divider + subtitle
    // grouped at the bottom. Right column: eyebrow pinned top-right, URL
    // pill pinned bottom-right.
    const leftBottomKids = [parts.headline, parts.divider, parts.subtitle].filter(Boolean);
    const leftBottom = leftBottomKids.length
      ? el("div", { style: { display: "flex", flexDirection: "column", gap: scale(s, 12) + "px" } }, ...leftBottomKids)
      : null;
    const leftKids = [parts.brand, leftBottom].filter(Boolean);
    const left = leftKids.length
      ? el(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: leftKids.length > 1 ? "space-between" : "center",
              flex: "1",
              minWidth: "0",
              paddingRight: scale(s, 32) + "px",
            },
          },
          ...leftKids,
        )
      : null;
    const rightKids = [parts.eyebrow, parts.url].filter(Boolean);
    const right = rightKids.length
      ? el(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: rightKids.length > 1 ? "space-between" : "flex-end",
              alignItems: "flex-end",
              flex: "0 0 auto",
            },
          },
          ...rightKids,
        )
      : null;
    return el(
      "div",
      { style: { ...rootStyle(p, s, bgStyle), flexDirection: "row", alignItems: "stretch" } },
      left, right,
    );
  },
};

// ─── Presets ──────────────────────────────────────────────────────────

const PRESETS = {
  "tools-default": {
    layout: "classic",
    palette: "green",
    bg: "blobs",
    theme: "dark",
    title: "Small tools, sharp edges.",
    accentTitleWord: 1,
    subtitle: "Open-source, client-only utilities.",
    eyebrow: { text: "LIVE · TOOLS", show: true },
    url: { text: "tools.ranzlappen.com", show: true },
    brand: { icon: "A", name: "ranzlappen", sub: " / tools", show: true },
    divider: true,
  },
  "hero": {
    layout: "hero",
    palette: "slate",
    bg: "linear",
    bgAngle: 135,
    theme: "dark",
    title: "Ship the next big thing.",
    subtitle: "A bold announcement card for launches and headlines.",
    eyebrow: { show: false },
    url: { show: false },
    divider: false,
  },
  "minimal": {
    layout: "minimal",
    palette: "mono",
    bg: "solid",
    theme: "dark",
    title: "Less, but better.",
    subtitle: "",
    brand: { show: false },
    eyebrow: { show: false },
    divider: false,
    url: { text: "tools.ranzlappen.com", show: true },
  },
  "twitter-banner": {
    layout: "split",
    palette: "amber",
    bg: "dots",
    size: "twitter",
    theme: "dark",
    title: "Sharp edges. Wide canvas.",
    subtitle: "A wider format for header cards and feature posts.",
    eyebrow: { text: "FEATURED", show: true },
    url: { text: "tools.ranzlappen.com", show: true },
  },
  "square-post": {
    layout: "centered",
    palette: "violet",
    bg: "noise",
    size: "square",
    theme: "dark",
    font: "serif",
    title: "Quiet, deliberate work.",
    accentTitleWord: -1,
    subtitle: "A square card built for social feeds.",
    eyebrow: { text: "ESSAY", show: true },
    url: { text: "tools.ranzlappen.com", show: true },
  },
};

// ─── Defaults + config parsing ────────────────────────────────────────

const DEFAULTS = {
  layout: "classic",
  palette: "green",
  bg: "blobs",
  bgAngle: 135,
  size: "og",
  theme: "dark",
  font: "sans",
  title: "Small tools, sharp edges.",
  subtitle: "Open-source, client-only utilities.",
  // -1 = no per-word accent. The brand-card highlight on "tools" lives
  // in the tools-default preset and the v1 backward-compat shim below.
  accentTitleWord: -1,
  divider: true,
  brand: { icon: "A", name: "ranzlappen", sub: " / tools", show: true },
  eyebrow: { text: "LIVE · TOOLS", show: true },
  url: { text: "tools.ranzlappen.com", show: true },
};

const ALLOWED_LAYOUTS = new Set(Object.keys(LAYOUTS));
const ALLOWED_PALETTES = new Set(Object.keys(PALETTES));
const ALLOWED_BG = new Set(Object.keys(BACKGROUNDS));
const ALLOWED_FONTS = new Set(["sans", "serif", "mono"]);
const ALLOWED_THEMES = new Set(["dark", "light"]);

class BadRequest extends Error {}

function decodeCfg(raw) {
  // base64url → base64 → decoded JSON object
  let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  b64 = b64 + "=".repeat(pad);
  let json;
  try {
    json = atob(b64);
  } catch (e) {
    throw new BadRequest("cfg is not valid base64url");
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new BadRequest("cfg is not valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BadRequest("cfg must be a JSON object");
  }
  return parsed;
}

function deepMerge(base, over) {
  if (!over || typeof over !== "object") return { ...base };
  const out = { ...base };
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") {
      out[k] = { ...base[k], ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function normalizeConfig(searchParams) {
  let cfg = { ...DEFAULTS };

  const cfgParam = searchParams.get("cfg");
  if (cfgParam) {
    const decoded = decodeCfg(cfgParam);
    if (decoded.preset && PRESETS[decoded.preset]) {
      cfg = deepMerge(cfg, PRESETS[decoded.preset]);
    }
    cfg = deepMerge(cfg, decoded);
  }

  // Flat params (legacy, highest priority — so existing `?title=&theme=`
  // links keep behaving exactly as before).
  const flatTitle    = searchParams.get("title");
  const flatSubtitle = searchParams.get("subtitle");
  const flatTheme    = searchParams.get("theme");
  if (flatTitle != null)    cfg.title = flatTitle;
  if (flatSubtitle != null) cfg.subtitle = flatSubtitle;
  if (flatTheme && ALLOWED_THEMES.has(flatTheme)) cfg.theme = flatTheme;

  // v1 backward-compat: the literal flat default `?title=tools · ranzlappen`
  // was used by older OG meta tags. Map it onto the brand-card preset so
  // historical links keep rendering the ranzlappen card.
  if (cfg.title === "tools · ranzlappen") {
    cfg.title = "Small tools, sharp edges.";
    cfg.accentTitleWord = 1;
    if (!flatSubtitle) cfg.subtitle = "Open-source, client-only utilities.";
  }

  // Validate enums (fall back to default rather than 400 — be forgiving).
  if (!ALLOWED_LAYOUTS.has(cfg.layout))   cfg.layout   = DEFAULTS.layout;
  if (!ALLOWED_PALETTES.has(cfg.palette)) cfg.palette  = DEFAULTS.palette;
  if (!ALLOWED_BG.has(cfg.bg))            cfg.bg       = DEFAULTS.bg;
  if (!ALLOWED_FONTS.has(cfg.font))       cfg.font     = DEFAULTS.font;
  if (!ALLOWED_THEMES.has(cfg.theme))     cfg.theme    = DEFAULTS.theme;

  // Clamp / sanitize content.
  cfg.title    = clamp(cfg.title,    80);
  cfg.subtitle = clamp(cfg.subtitle, 120);
  cfg.bgAngle  = Number.isFinite(+cfg.bgAngle) ? ((+cfg.bgAngle) % 360 + 360) % 360 : 135;
  cfg.accentTitleWord = Number.isInteger(+cfg.accentTitleWord) ? +cfg.accentTitleWord : -1;
  cfg.divider  = cfg.divider !== false;

  return cfg;
}

// ─── Handler ──────────────────────────────────────────────────────────

export default function handler(req) {
  let cfg;
  try {
    cfg = normalizeConfig(new URL(req.url).searchParams);
  } catch (e) {
    const msg = e instanceof BadRequest ? e.message : "bad request";
    return new Response(`OG: ${msg}`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const palette = resolvePalette(cfg);
  const size    = resolveSize(cfg.size);
  const bgFn    = BACKGROUNDS[cfg.bg] || BACKGROUNDS.blobs;
  const bgStyle = bgFn(palette, cfg);

  const parts = {
    brand:    brandChip(cfg, palette, size),
    eyebrow:  eyebrow(cfg, palette, size),
    headline: headline(cfg, palette, size),
    divider:  divider(cfg, palette, size),
    subtitle: subtitle(cfg, palette, size),
    url:      urlPill(cfg, palette, size),
  };

  const layoutFn = LAYOUTS[cfg.layout] || LAYOUTS.classic;
  const root = layoutFn(cfg, palette, size, parts, bgStyle);

  return new ImageResponse(root, {
    width: size.w,
    height: size.h,
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
