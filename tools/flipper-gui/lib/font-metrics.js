/* Flipper font metrics — best-effort monospaced approximation.
 *
 * Flipper's bitmap fonts are not strictly monospaced. These tables are
 * used by the editor preview only (the device renders pixel-perfect
 * from the actual bitmap fonts). Cap height / line height drive
 * widget bounding boxes; charWidth gates layout in the editor.
 *
 * If you find drift between editor preview and device output, the
 * fix is here.
 */

export const FONTS = {
  primary: {
    name: "FontPrimary",
    label: "Primary",
    charW: 6,
    lineH: 8,
    cap: 7,
    descent: 1,
    // y in canvas_draw_str is the baseline; this offsets from top-of-bbox.
    baseline: 7,
  },
  secondary: {
    name: "FontSecondary",
    label: "Secondary",
    charW: 5,
    lineH: 7,
    cap: 6,
    descent: 1,
    baseline: 6,
  },
  keyboard: {
    name: "FontKeyboard",
    label: "Keyboard",
    charW: 6,
    lineH: 9,
    cap: 7,
    descent: 2,
    baseline: 7,
  },
  big_numbers: {
    name: "FontBigNumbers",
    label: "BigNumbers",
    charW: 8,
    lineH: 13,
    cap: 12,
    descent: 1,
    baseline: 12,
  },
};

export const FONT_KEYS = Object.keys(FONTS);

export function measureText(text, fontKey) {
  const f = FONTS[fontKey] || FONTS.primary;
  return { w: (text || "").length * f.charW, h: f.lineH };
}

export function getFont(fontKey) {
  return FONTS[fontKey] || FONTS.primary;
}
