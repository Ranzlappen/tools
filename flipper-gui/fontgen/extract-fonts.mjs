#!/usr/bin/env node
/* Font data extractor for Flipper GUI Studio.
 *
 * Inputs (fontgen/src/, gitignored — see fontgen/README.md to fetch):
 *   helvB08.bdf      → FontPrimary      (pixel-exact)
 *   profont11.bdf    → FontKeyboard     (pixel-exact)
 *   profont22.bdf    → FontBigNumbers   (pixel-exact, digits/punct only)
 *   haxrcorp4089_tr.c→ FontSecondary    (advance widths only)
 *
 * Output: tools/flipper-gui/lib/fonts/<key>.js — ES modules consumed by
 * lib/font-render.js. Bitmap rows are stored MSB-first, ceil(w/8) bytes
 * per row, concatenated and base64-encoded.
 *
 * Run from the flipper-gui dir: `node fontgen/extract-fonts.mjs`.
 * Regenerate whenever the source fonts or coverage ranges change.
 *
 * Coverage: the canonical Flipper firmware fonts are Latin-only — none of
 * helvB08 / profont / haxrcorp4089_tr ship Cyrillic glyphs (Cyrillic on
 * Flipper comes from Momentum's separately-patched font variants, not
 * these). So we cover ASCII + Latin-1 where present; Cyrillic is out of
 * scope until those variants are sourced.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "src");
const OUT = join(here, "..", "lib", "fonts");
mkdirSync(OUT, { recursive: true });

// Tuned metrics (baseline offset from top, descent, line height) copied
// from lib/font-metrics.js so the editor preview and the C export share
// one baseline. Using these — not the BDF's design ascent — keeps the
// blitter pixel-aligned with canvas_draw_str on the device.
const METRICS = {
  primary:     { name: "FontPrimary",    ascent: 7,  descent: 1, lineHeight: 8 },
  secondary:   { name: "FontSecondary",  ascent: 6,  descent: 1, lineHeight: 7 },
  keyboard:    { name: "FontKeyboard",   ascent: 7,  descent: 2, lineHeight: 9 },
  big_numbers: { name: "FontBigNumbers", ascent: 12, descent: 1, lineHeight: 13 },
};

// Codepoint ranges to keep per font.
const ASCII = [0x20, 0x7e];
const LATIN1 = [0xa0, 0xff];
const NUM = [0x20, 0x3a]; // space..colon — matches u8g2 _tn subset

function inRanges(code, ranges) {
  return ranges.some(([lo, hi]) => code >= lo && code <= hi);
}

// ── BDF parser ─────────────────────────────────────────────────────
// Returns { [code]: { dx, w, h, ox, oy, rows:[byte,...] } }.

function parseBdf(text, ranges) {
  const lines = text.replace(/\r/g, "").split("\n");
  const glyphs = {};
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("STARTCHAR")) {
      let code = -1, dx = 0, bbx = null, rows = [];
      let j = i + 1;
      for (; j < lines.length && !lines[j].startsWith("ENDCHAR"); j++) {
        const ln = lines[j];
        if (ln.startsWith("ENCODING")) code = parseInt(ln.split(/\s+/)[1], 10);
        else if (ln.startsWith("DWIDTH")) dx = parseInt(ln.split(/\s+/)[1], 10);
        else if (ln.startsWith("BBX")) {
          const p = ln.split(/\s+/);
          bbx = { w: +p[1], h: +p[2], ox: +p[3], oy: +p[4] };
        } else if (ln === "BITMAP") {
          for (j++; j < lines.length && !lines[j].startsWith("ENDCHAR"); j++) {
            const hex = lines[j].trim();
            if (!hex) continue;
            const stride = Math.ceil((bbx ? bbx.w : 0) / 8);
            for (let b = 0; b < stride; b++) {
              rows.push(parseInt(hex.substr(b * 2, 2) || "0", 16));
            }
          }
          break;
        }
      }
      if (code >= 0 && inRanges(code, ranges) && bbx) {
        glyphs[code] = { dx, w: bbx.w, h: bbx.h, ox: bbx.ox, oy: bbx.oy, rows };
      }
      i = j + 1;
    } else i++;
  }
  return glyphs;
}

// ── u8g2 binary font: advance-width-only partial decoder ───────────
// Reproduces enough of u8g2's font format to read each glyph's delta-x
// (advance). The bitmap RLE itself is skipped via the per-glyph jump
// byte, so we never decode pixels. Format reference:
// https://github.com/olikraus/u8g2/wiki/u8g2fontformat

function cStringToBytes(src) {
  // Extract the first "...";-terminated string literal group after '='.
  const eq = src.indexOf("=");
  const body = src.slice(eq + 1);
  const out = [];
  let i = 0;
  const n = body.length;
  // Walk only inside double-quoted chunks; u8g2 splits the blob across
  // many adjacent "..." literals.
  while (i < n) {
    if (body[i] === '"') {
      i++;
      while (i < n && body[i] !== '"') {
        if (body[i] === "\\") {
          const c = body[i + 1];
          if (c >= "0" && c <= "7") {
            let oct = "";
            i++;
            while (oct.length < 3 && body[i] >= "0" && body[i] <= "7") { oct += body[i]; i++; }
            out.push(parseInt(oct, 8) & 0xff);
          } else {
            const map = { n: 10, r: 13, t: 9, "\\": 92, '"': 34, "0": 0 };
            out.push(map[c] ?? c.charCodeAt(0));
            i += 2;
          }
        } else {
          out.push(body.charCodeAt(i) & 0xff);
          i++;
        }
      }
      i++; // closing quote
    } else if (body[i] === ";") {
      break;
    } else i++;
  }
  return Uint8Array.from(out);
}

class BitReader {
  constructor(bytes, bitPos) { this.b = bytes; this.p = bitPos; }
  read(n) {
    let v = 0;
    for (let k = 0; k < n; k++) {
      const byte = this.b[this.p >> 3];
      const bit = (byte >> (this.p & 7)) & 1; // LSB-first within byte
      v |= bit << k;
      this.p++;
    }
    return v;
  }
  readSigned(n) {
    // u8g2 stores signed fields biased by 2^(n-1), not two's complement:
    // value = raw - 2^(n-1). (See u8g2_font_decode_get_signed_bits.)
    return this.read(n) - (1 << (n - 1));
  }
}

function parseU8g2Widths(src) {
  const d = cStringToBytes(src);
  const h = {
    glyphCnt: d[0],
    bbxMode: d[1],
    bits0: d[2],
    bits1: d[3],
    bitsW: d[4],
    bitsH: d[5],
    bitsX: d[6],
    bitsY: d[7],
    bitsDX: d[8],
  };
  // Glyph table starts at byte 23 for u8g2 fonts.
  const widths = {};
  let pos = 23;
  while (pos < d.length) {
    const enc = d[pos];
    if (enc === 0) break; // end marker
    const jump = d[pos + 1];
    if (jump === 0) break;
    // Bit-unpack glyph header: W, H, X, Y, DX (skip the bitmap RLE).
    const br = new BitReader(d, (pos + 2) * 8);
    br.read(h.bitsW); // width
    br.read(h.bitsH); // height
    br.readSigned(h.bitsX); // x offset
    br.readSigned(h.bitsY); // y offset
    const dx = br.readSigned(h.bitsDX);
    widths[enc] = dx;
    pos += jump; // jump is offset from the encoding byte to next glyph
  }
  return { meta: h, widths };
}

// ── Emit ───────────────────────────────────────────────────────────

function b64(bytes) {
  return Buffer.from(Uint8Array.from(bytes)).toString("base64");
}

function emitPixelFont(key, glyphs) {
  const m = METRICS[key];
  const entries = Object.keys(glyphs)
    .map(Number).sort((a, b) => a - b)
    .map((code) => {
      const g = glyphs[code];
      return `  ${code}:{dx:${g.dx},w:${g.w},h:${g.h},ox:${g.ox},oy:${g.oy},b:"${b64(g.rows)}"}`;
    });
  const body = `/* Generated by build/extract-fonts.mjs — do not edit by hand. */
export default {
 name:"${m.name}",ascent:${m.ascent},descent:${m.descent},lineHeight:${m.lineHeight},
 glyphs:{
${entries.join(",\n")}
 }
};
`;
  writeFileSync(join(OUT, `${key}.js`), body);
  return entries.length;
}

function emitWidthFont(key, widths) {
  const m = METRICS[key];
  const entries = Object.keys(widths)
    .map(Number).sort((a, b) => a - b)
    .map((code) => `  ${code}:${widths[code]}`);
  const body = `/* Generated by build/extract-fonts.mjs — advance widths only.
 * FontSecondary (haxrcorp4089) ships no upstream BDF, so the editor
 * approximates its glyphs with fillText but uses these real per-glyph
 * advances for layout/centering. */
export default {
 name:"${m.name}",ascent:${m.ascent},descent:${m.descent},lineHeight:${m.lineHeight},
 widthsOnly:true,
 widths:{
${entries.join(",\n")}
 }
};
`;
  writeFileSync(join(OUT, `${key}.js`), body);
  return entries.length;
}

// ── Run ────────────────────────────────────────────────────────────

const primary = parseBdf(readFileSync(join(SRC, "helvB08.bdf"), "latin1"), [ASCII, LATIN1]);
const keyboard = parseBdf(readFileSync(join(SRC, "profont11.bdf"), "latin1"), [ASCII, LATIN1]);
const bignum = parseBdf(readFileSync(join(SRC, "profont22.bdf"), "latin1"), [NUM]);
const hax = parseU8g2Widths(readFileSync(join(SRC, "haxrcorp4089_tr.c"), "latin1"));

const np = emitPixelFont("primary", primary);
const nk = emitPixelFont("keyboard", keyboard);
const nb = emitPixelFont("big_numbers", bignum);
const ns = emitWidthFont("secondary", hax.widths);

console.log("haxrcorp header:", JSON.stringify(hax.meta));
console.log(`primary(helvB08):     ${np} glyphs`);
console.log(`keyboard(profont11):  ${nk} glyphs`);
console.log(`big_numbers(profont22): ${nb} glyphs`);
console.log(`secondary(haxrcorp):  ${ns} widths`);
