/* api/og.js — dynamic Open Graph image generator (1200×630).
 *
 * Query params:
 *   title    — main headline (default: "tools · ranzlappen")
 *   subtitle — tagline below (default: "Small tools, sharp edges.")
 *   theme    — "dark" (default) or "light"
 *
 * Examples:
 *   /api/og
 *   /api/og?title=JSON%20Formatter&subtitle=Pretty-print%2C%20minify%2C%20validate
 *
 * Uses @vercel/og with the edge runtime. We hand-build the element tree
 * (no JSX) so this file works as plain JS without a transpile step.
 */

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const PALETTES = {
  dark: {
    bg:     "#0b1210",
    text:   "#dce8e2",
    muted:  "#7e948a",
    accent: "#4ade80",
    accent2: "#a7f3d0",
    chip:   "rgba(74,222,128,0.10)",
    border: "rgba(74,222,128,0.30)",
  },
  light: {
    bg:     "#f5f9f7",
    text:   "#1a2a22",
    muted:  "#5a7068",
    accent: "#16a34a",
    accent2: "#15803d",
    chip:   "rgba(22,163,74,0.08)",
    border: "rgba(22,163,74,0.30)",
  },
};

// el(tag, style, ...children) — tiny createElement-like helper that
// produces objects @vercel/og / satori accept directly.
function el(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: children.length === 1 ? children[0] : children,
    },
  };
}

function clamp(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const title    = clamp(searchParams.get("title")    || "tools · ranzlappen", 60);
  const subtitle = clamp(searchParams.get("subtitle") || "Small tools, sharp edges.", 96);
  const theme    = searchParams.get("theme") === "light" ? "light" : "dark";
  const p = PALETTES[theme];

  const root = el(
    "div",
    {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background:
          `radial-gradient(circle at 20% 25%, ${p.accent}55, transparent 55%),` +
          `radial-gradient(circle at 85% 30%, ${p.accent2}33, transparent 60%),` +
          `radial-gradient(circle at 35% 100%, ${p.accent2}22, transparent 60%),` +
          `${p.bg}`,
        color: p.text,
        fontFamily: "sans-serif",
      },
    },
    // Top row: brand chip
    el(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "16px" } },
      el("div", {
        style: {
          width: "44px", height: "44px",
          borderRadius: "8px",
          background: p.chip,
          border: `1px solid ${p.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: p.accent,
          fontSize: "26px",
          fontWeight: 700,
          fontFamily: "sans-serif",
        },
      }, "A"),
      el(
        "div",
        { style: { display: "flex", fontSize: "22px", fontWeight: 600 } },
        el("span", { style: { color: p.text } }, "ranzlappen"),
        el("span", { style: { color: p.muted } }, " / tools"),
      ),
    ),

    // Middle: eyebrow + headline
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "16px" } },
      el("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 18px",
          borderRadius: "999px",
          background: p.chip,
          border: `1px solid ${p.border}`,
          color: p.accent,
          fontFamily: "monospace",
          fontSize: "14px",
          letterSpacing: "2px",
          alignSelf: "flex-start",
        },
      }, "LIVE · TOOLS"),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            fontSize: "96px",
            fontWeight: 700,
            letterSpacing: "-3px",
            lineHeight: 1.05,
            color: p.text,
          },
        },
        el(
          "div",
          { style: { display: "flex" } },
          el("span", null, "Small "),
          el("span", { style: { color: p.accent } }, "tools"),
          el("span", null, ","),
        ),
        el("div", null, "sharp edges."),
      ),
      el("div", {
        style: {
          height: "2px",
          width: "160px",
          background: `linear-gradient(90deg, ${p.accent}, transparent)`,
        },
      }),
      el("div", {
        style: {
          color: p.muted,
          fontSize: "26px",
          marginTop: "12px",
        },
      }, subtitle),
    ),

    // Bottom: URL pill
    el(
      "div",
      { style: { display: "flex", justifyContent: "flex-end" } },
      el("div", {
        style: {
          padding: "10px 22px",
          borderRadius: "999px",
          background: theme === "dark" ? "rgba(11,18,16,0.55)" : "rgba(255,255,255,0.65)",
          border: `1px solid ${p.border}`,
          color: p.text,
          fontFamily: "monospace",
          fontSize: "16px",
        },
      }, "tools.ranzlappen.com"),
    ),
  );

  // Override title rendering — replace the hard-coded headline with the
  // provided title when caller passed one explicitly. Done by patching
  // the tree post-hoc to keep the el() chain compact.
  if (title !== "tools · ranzlappen") {
    root.props.children[1].props.children[1] = el(
      "div",
      {
        style: {
          fontSize: title.length > 24 ? "72px" : "96px",
          fontWeight: 700,
          letterSpacing: "-3px",
          lineHeight: 1.05,
          color: p.text,
        },
      },
      title,
    );
  }

  return new ImageResponse(root, {
    width: 1200,
    height: 630,
    headers: {
      // Cache for 1h at the edge; long enough to feel fast, short
      // enough that copy fixes propagate quickly.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
