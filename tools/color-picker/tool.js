/* Color Picker — HEX/RGB/HSL/OKLCH/HSV conversions + WCAG contrast. */

const $ = (s) => document.querySelector(s);

const fgPicker = $("#fg-input");
const fgText = $("#fg-text");
const fgPreview = $("#fg-preview");
const fgFormats = $("#fg-formats");
const bgPicker = $("#bg-input");
const cPreview = $("#contrast-preview");
const cRatio = $("#contrast-ratio");
const cBadges = $("#contrast-badges");

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function hexToRgb(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const hex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return "#" + hex(r) + hex(g) + hex(b);
}

function rgbToHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case R: h = (G - B) / d + (G < B ? 6 : 0); break;
      case G: h = (B - R) / d + 2; break;
      case B: h = (R - G) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function rgbToHsv({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case R: h = ((G - B) / d) % 6; break;
      case G: h = (B - R) / d + 2; break;
      case B: h = (R - G) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s: s * 100, v: max * 100 };
}

/* sRGB → linear → OKLab → OKLCH (Björn Ottosson). */
function rgbToOklch({ r, g, b }) {
  const srgbToLin = (c) => {
    const u = c / 255;
    return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  const lr = srgbToLin(r), lg = srgbToLin(g), lb = srgbToLin(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: L * 100, C, H };
}

function relativeLuminance({ r, g, b }) {
  const toLin = (c) => {
    const u = c / 255;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrast(rgb1, rgb2) {
  const L1 = relativeLuminance(rgb1);
  const L2 = relativeLuminance(rgb2);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

function makeFormatRow(label, value) {
  const row = document.createElement("div");
  row.className = "format-row";
  row.innerHTML =
    `<span class="label">${label}</span>` +
    `<input class="input input--single input--mono" readonly value="${value}" aria-label="${label}" />` +
    `<button class="btn btn--ghost btn--copy" data-copy="${value.replace(/"/g, "&quot;")}">Copy</button>`;
  return row;
}

function render(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;

  fgPreview.style.background = hex;
  fgPicker.value = hex;
  fgText.value = hex;

  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const oklch = rgbToOklch(rgb);

  fgFormats.innerHTML = "";
  fgFormats.appendChild(makeFormatRow("HEX",   hex));
  fgFormats.appendChild(makeFormatRow("RGB",   `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`));
  fgFormats.appendChild(makeFormatRow(
    "HSL",
    `hsl(${hsl.h.toFixed(0)}, ${hsl.s.toFixed(1)}%, ${hsl.l.toFixed(1)}%)`
  ));
  fgFormats.appendChild(makeFormatRow(
    "HSV",
    `hsv(${hsv.h.toFixed(0)}, ${hsv.s.toFixed(1)}%, ${hsv.v.toFixed(1)}%)`
  ));
  fgFormats.appendChild(makeFormatRow(
    "OKLCH",
    `oklch(${oklch.L.toFixed(1)}% ${oklch.C.toFixed(3)} ${oklch.H.toFixed(0)})`
  ));

  renderContrast(hex, bgPicker.value);
}

function renderContrast(fg, bg) {
  const rgbFg = hexToRgb(fg);
  const rgbBg = hexToRgb(bg);
  if (!rgbFg || !rgbBg) return;
  const ratio = contrast(rgbFg, rgbBg);
  cRatio.textContent = ratio.toFixed(2) + " : 1";
  cPreview.style.background = bg;
  cPreview.style.color = fg;
  cPreview.style.borderColor = "rgba(255,255,255,0.06)";

  const lines = [
    { name: "AA normal", req: 4.5 },
    { name: "AA large",  req: 3.0 },
    { name: "AAA normal", req: 7.0 },
    { name: "AAA large",  req: 4.5 },
  ];
  cBadges.innerHTML = lines
    .map(
      (l) =>
        `<span class="badge ${ratio >= l.req ? "is-pass" : "is-fail"}">${l.name}</span>`
    )
    .join("");
}

fgPicker.addEventListener("input", () => render(fgPicker.value));
fgText.addEventListener("input", () => {
  const h = fgText.value.startsWith("#") ? fgText.value : "#" + fgText.value;
  if (hexToRgb(h)) render(h);
});
bgPicker.addEventListener("input", () => renderContrast(fgPicker.value, bgPicker.value));

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  navigator.clipboard.writeText(btn.dataset.copy).catch(() => {});
  const orig = btn.textContent;
  btn.textContent = "✓";
  setTimeout(() => (btn.textContent = orig), 1000);
});

render(fgPicker.value);
