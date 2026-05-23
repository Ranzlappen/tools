/* Icon source definitions for Flipper GUI Studio's predefined library.
 *
 * Every glyph here is ORIGINAL artwork authored for this repo (MIT) — no
 * third-party icon sets are vendored, so there are no upstream licensing
 * constraints on the generated bitmaps.
 *
 * Each entry is a 24×24 viewBox of solid black shapes on a transparent
 * background. Solid/filled shapes (not thin outlines) are used on purpose:
 * they threshold to legible 1-bit glyphs even at 16 px. White (#fff) fills
 * punch holes (they become OFF pixels after thresholding).
 *
 * Consumed by generate-icons.mjs, which rasterizes each glyph at 16/32/64
 * and packs it through ../lib/xbm.js into lib/icons/library.js.
 */

export const VIEWBOX = 24;

export const CATEGORIES = [
  { id: "system", label: "System" },
  { id: "nav", label: "Navigation" },
  { id: "media", label: "Media" },
  { id: "flipper", label: "Flipper" },
];

export const ICONS = [
  // ── system ────────────────────────────────────────────────────────
  { category: "system", name: "battery",
    inner: `<rect x="2" y="8" width="16" height="8" rx="1.5"/><rect x="18.5" y="10.5" width="3" height="3"/>` },
  { category: "system", name: "lock",
    inner: `<path d="M7 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="#000" stroke-width="2.5"/><rect x="4" y="10" width="16" height="11" rx="2"/>` },
  { category: "system", name: "gear",
    inner: `<path d="M12 1.5l1.7 2.4 2.8-.9.6 2.9 2.9.6-.9 2.8L21.5 12l-2.4 1.7.9 2.8-2.9.6-.6 2.9-2.8-.9L12 22.5l-1.7-2.4-2.8.9-.6-2.9-2.9-.6.9-2.8L2.5 12l2.4-1.7-.9-2.8 2.9-.6.6-2.9 2.8.9z"/><circle cx="12" cy="12" r="3.4" fill="#fff"/>` },
  { category: "system", name: "sd-card",
    inner: `<path d="M6 2h8l4 4v16H6z"/><rect x="8" y="3.4" width="1.4" height="3" fill="#fff"/><rect x="10.4" y="3.4" width="1.4" height="3" fill="#fff"/><rect x="12.8" y="3.4" width="1.4" height="3" fill="#fff"/>` },
  { category: "system", name: "signal",
    inner: `<rect x="3" y="14" width="3" height="6"/><rect x="8" y="10" width="3" height="10"/><rect x="13" y="6" width="3" height="14"/><rect x="18" y="2" width="3" height="18"/>` },
  { category: "system", name: "bluetooth",
    inner: `<path d="M8 8l8 8-4 3V5l4 3-8 8" fill="none" stroke="#000" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` },
  { category: "system", name: "power",
    inner: `<path d="M12 3v9" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round"/><path d="M6.5 6.5a8 8 0 1 0 11 0" fill="none" stroke="#000" stroke-width="2.6"/>` },
  { category: "system", name: "warning",
    inner: `<path d="M12 2l11 19H1z"/><rect x="10.8" y="9" width="2.4" height="6" fill="#fff"/><rect x="10.8" y="16.5" width="2.4" height="2.4" fill="#fff"/>` },

  // ── nav ───────────────────────────────────────────────────────────
  { category: "nav", name: "arrow-up",
    inner: `<path d="M12 4l8 9h-5v7H9v-7H4z"/>` },
  { category: "nav", name: "arrow-down",
    inner: `<path d="M12 20l8-9h-5V4H9v7H4z"/>` },
  { category: "nav", name: "arrow-left",
    inner: `<path d="M4 12l9-8v5h7v6h-7v5z"/>` },
  { category: "nav", name: "arrow-right",
    inner: `<path d="M20 12l-9-8v5H4v6h7v5z"/>` },
  { category: "nav", name: "check",
    inner: `<path d="M5 13l5 5L20 6" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` },
  { category: "nav", name: "close",
    inner: `<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>` },
  { category: "nav", name: "home",
    inner: `<path d="M12 3l9 8h-3v9h-4v-5h-4v5H6v-9H3z"/>` },
  { category: "nav", name: "menu",
    inner: `<rect x="3" y="5" width="18" height="2.6"/><rect x="3" y="11" width="18" height="2.6"/><rect x="3" y="17" width="18" height="2.6"/>` },
  { category: "nav", name: "plus",
    inner: `<path d="M12 4v16M4 12h16" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>` },
  { category: "nav", name: "minus",
    inner: `<path d="M4 12h16" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>` },

  // ── media ─────────────────────────────────────────────────────────
  { category: "media", name: "play",
    inner: `<path d="M6 4l14 8-14 8z"/>` },
  { category: "media", name: "pause",
    inner: `<rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/>` },
  { category: "media", name: "stop",
    inner: `<rect x="5" y="5" width="14" height="14"/>` },
  { category: "media", name: "record",
    inner: `<circle cx="12" cy="12" r="7"/>` },
  { category: "media", name: "next",
    inner: `<path d="M5 4l9 8-9 8z"/><rect x="16" y="4" width="3.5" height="16"/>` },
  { category: "media", name: "prev",
    inner: `<path d="M19 4l-9 8 9 8z"/><rect x="4.5" y="4" width="3.5" height="16"/>` },

  // ── flipper ───────────────────────────────────────────────────────
  { category: "flipper", name: "dolphin",
    inner: `<path d="M2 15c2-8 10-10 15-7.5 3 1.5 5 4.5 5 4.5s-3.5-.5-4.5 2c-1.5 3.5-6 5.5-10.5 4C3 16.5 2 15 2 15z"/><circle cx="8.5" cy="11.5" r="1.4" fill="#fff"/>` },
  { category: "flipper", name: "chip",
    inner: `<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="9.2" y="9.2" width="5.6" height="5.6" fill="#fff"/><rect x="9" y="2.2" width="1.6" height="3"/><rect x="13.4" y="2.2" width="1.6" height="3"/><rect x="9" y="18.8" width="1.6" height="3"/><rect x="13.4" y="18.8" width="1.6" height="3"/><rect x="2.2" y="9" width="3" height="1.6"/><rect x="2.2" y="13.4" width="3" height="1.6"/><rect x="18.8" y="9" width="3" height="1.6"/><rect x="18.8" y="13.4" width="3" height="1.6"/>` },
  { category: "flipper", name: "gpio",
    inner: `<rect x="2" y="9" width="20" height="6" rx="1.5"/><circle cx="6" cy="12" r="1.3" fill="#fff"/><circle cx="10" cy="12" r="1.3" fill="#fff"/><circle cx="14" cy="12" r="1.3" fill="#fff"/><circle cx="18" cy="12" r="1.3" fill="#fff"/>` },
  { category: "flipper", name: "nfc",
    inner: `<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#000" stroke-width="2.2"/><path d="M9.5 9a5 5 0 0 1 0 6" fill="none" stroke="#000" stroke-width="2.2"/><path d="M13 6.5a9 9 0 0 1 0 11" fill="none" stroke="#000" stroke-width="2.2"/>` },
  { category: "flipper", name: "antenna",
    inner: `<rect x="11" y="8" width="2" height="13"/><circle cx="12" cy="5.5" r="2.4"/><path d="M6.5 11a8 8 0 0 1 0-10" fill="none" stroke="#000" stroke-width="2.2"/><path d="M17.5 11a8 8 0 0 0 0-10" fill="none" stroke="#000" stroke-width="2.2"/>` },
  { category: "flipper", name: "key",
    inner: `<circle cx="8" cy="12" r="5"/><circle cx="8" cy="12" r="2" fill="#fff"/><rect x="12" y="10.8" width="9" height="2.4"/><rect x="18.6" y="10.8" width="2.4" height="5"/>` },
];
