/* Pure 1-bit scene renderer — shared by the editor canvas (tool.js) and
 * the exported JS bundle (render.js). No DOM or editor state: the icon
 * list is passed in explicitly so the same code renders identically in
 * both contexts.
 *
 * Pixels are drawn black (PIXEL_ON) on the caller's surface. Inverted
 * regions (button "invert", selected menu row) paint text in PAPER, the
 * Flipper LCD "off" colour — so render onto a PAPER-filled canvas.
 */

import { getFont } from "./font-metrics.js";
import { blitText, measureText } from "./font-render.js";
import { renderXbm, b64ToBytes } from "./xbm.js";

export const PIXEL_ON = "#000000";
export const PAPER = "#f0f0d0";

function drawText(ctx, x, y, text, fontKey) {
  if (blitText(ctx, x, y, text, fontKey) !== null) return;
  const f = getFont(fontKey);
  ctx.font = `${f.cap}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textBaseline = "top";
  ctx.fillText(text || "", x, y);
}

/* Draw `text` clipped to `clipW`, side-scrolling when it overflows — the
 * editor-side approximation of Flipper's elements_scrollable_text_line.
 * Static (frozen at offset 0) when opts.now is absent (reduced-motion or a
 * one-shot render). The motion: pause at the start, step left, loop with a
 * blank gap, drawing a second copy as the tail wraps in. */
function drawScrollText(ctx, x, y, text, fontKey, clipW, opts = {}) {
  if (clipW <= 0) return;
  const full = measureText(text, fontKey).w;
  ctx.save();
  ctx.beginPath();
  // Clip horizontally only (full 64px canvas height): glyphs render up to a
  // pixel above `y` (Primary's ascent 7 < its 8px cell), so a lineH-tall clip
  // would shave their top row. This mirrors the unclipped non-scroll path.
  ctx.rect(x, 0, clipW, 64);
  ctx.clip();
  if (full <= clipW || opts.now == null) {
    drawText(ctx, x, y, text, fontKey);
  } else {
    const SPEED = 16;       // px/sec
    const PAUSE = 1200;     // ms hold at the start of each cycle
    const GAP = clipW;      // blank gap before the text repeats
    const span = full + GAP;
    const cycle = PAUSE + (span / SPEED) * 1000;
    const t = opts.now % cycle;
    const moved = t < PAUSE ? 0 : ((t - PAUSE) / 1000) * SPEED;
    const off = Math.floor(moved) % span;
    drawText(ctx, x - off, y, text, fontKey);
    if (off > full) drawText(ctx, x - off + span, y, text, fontKey);
  }
  ctx.restore();
}

function drawFrame(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function drawLine(ctx, x0, y0, x1, y1) {
  // Bresenham — pixel-perfect, matches canvas_draw_line.
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function drawWidget(ctx, w, icons = [], opts = {}) {
  ctx.fillStyle = PIXEL_ON;
  switch (w.type) {
    case "text": {
      const fontKey = w.font || "primary";
      if (w.scroll) {
        const clipW = Math.max(8, Math.min(128, w.scrollW ?? 64));
        drawScrollText(ctx, w.x, w.y, w.text || "", fontKey, clipW, opts);
      } else {
        drawText(ctx, w.x, w.y, w.text || "", fontKey);
      }
      break;
    }
    case "box":
      ctx.fillRect(w.x, w.y, w.w, w.h);
      break;
    case "frame":
      drawFrame(ctx, w.x, w.y, w.w, w.h);
      break;
    case "line":
      drawLine(ctx, w.x, w.y, w.x2, w.y2);
      break;
    case "dot":
      ctx.fillRect(w.x, w.y, 1, 1);
      break;
    case "bitmap":
      // Free-draw paint layer — inline base64 XBM, drawn like an icon.
      if (w.bits) renderXbm(ctx, w.x, w.y, w.w, w.h, b64ToBytes(w.bits), 1);
      break;
    case "icon": {
      const icon = icons.find((i) => i.id === w.iconId);
      if (icon) {
        renderXbm(ctx, w.x, w.y, icon.w, icon.h, b64ToBytes(icon.bits), 1);
      } else {
        // Placeholder X for a missing icon ref.
        ctx.fillRect(w.x, w.y, 8, 1);
        ctx.fillRect(w.x, w.y, 1, 8);
        ctx.fillRect(w.x + 7, w.y, 1, 8);
        ctx.fillRect(w.x, w.y + 7, 8, 1);
        drawLine(ctx, w.x, w.y, w.x + 7, w.y + 7);
        drawLine(ctx, w.x, w.y + 7, w.x + 7, w.y);
      }
      break;
    }
    case "button": {
      if (w.style === "invert") {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = PAPER;
      } else if (w.style === "framed") {
        drawFrame(ctx, w.x, w.y, w.w, w.h);
      }
      const fontKey = w.font || "secondary";
      const f = getFont(fontKey);
      const text = w.label || "";
      const ty = w.y + Math.floor((w.h - f.cap) / 2);
      if (w.scroll) {
        drawScrollText(ctx, w.x + 2, ty, text, fontKey, w.w - 4, opts);
      } else {
        const textW = measureText(text, fontKey).w;
        const tx = w.x + Math.max(0, Math.floor((w.w - textW) / 2));
        drawText(ctx, tx, ty, text, fontKey);
      }
      ctx.fillStyle = PIXEL_ON;
      break;
    }
    case "progress": {
      drawFrame(ctx, w.x, w.y, w.w, w.h);
      const val = typeof w.value === "string" ? 50 : (w.value | 0);
      const inner = Math.max(0, Math.min(w.w - 2, Math.floor((val * (w.w - 2)) / 100)));
      ctx.fillRect(w.x + 1, w.y + 1, inner, w.h - 2);
      break;
    }
    case "menu": {
      const fontKey = w.font || "primary";
      const f = getFont(fontKey);
      const lineH = w.lineH || (f.lineH + 2);
      const selected = 0; // preview highlights the first row.
      const items = w.items || [];
      for (let i = 0; i < items.length; i++) {
        const iy = w.y + i * lineH;
        if (i === selected) {
          ctx.fillRect(w.x, iy, w.w, lineH);
          ctx.fillStyle = PAPER;
          if (w.scroll) drawScrollText(ctx, w.x + 2, iy + 1, items[i].label || "", fontKey, w.w - 4, opts);
          else drawText(ctx, w.x + 2, iy + 1, items[i].label || "", fontKey);
          ctx.fillStyle = PIXEL_ON;
        } else {
          drawText(ctx, w.x + 2, iy + 1, items[i].label || "", fontKey);
        }
      }
      break;
    }
    case "toggle": {
      const fontKey = w.font || "secondary";
      const box = 7;
      drawFrame(ctx, w.x, w.y, box, box);
      const on = typeof w.state === "string" ? true : !!w.state;
      if (on) ctx.fillRect(w.x + 2, w.y + 2, box - 4, box - 4);
      const labelX = w.x + box + 3;
      if (w.scroll) drawScrollText(ctx, labelX, w.y, w.label || "", fontKey, 128 - labelX, opts);
      else drawText(ctx, labelX, w.y, w.label || "", fontKey);
      break;
    }
  }
}

export function drawScene(ctx, widgets, icons = [], opts = {}) {
  for (const w of widgets) drawWidget(ctx, w, icons, opts);
}
