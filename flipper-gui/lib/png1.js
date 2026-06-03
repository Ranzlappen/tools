/* Minimal 1-bit grayscale PNG encoder (colour type 0, bit depth 1).
 *
 * Flipper's fap_icon / fap_icon_assets pipeline requires 1-bit PNGs; the
 * browser's canvas.toBlob only emits 8-bit RGBA, which the firmware asset
 * compiler rejects. This encoder takes a row-major 0/1 pixel array
 * (1 = pixel ON = black, matching the XBM convention in lib/xbm.js) and
 * produces a valid 1-bit grayscale PNG.
 *
 * The image data is tiny (a 10x10 launcher icon, or small XBM glyphs), so
 * DEFLATE uses a single stored (uncompressed) block — no compressor needed.
 */

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(type, data) {
  const body = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)].concat(data);
  const crc = crc32(Uint8Array.from(body));
  return u32(data.length).concat(body, u32(crc));
}

/* zlib stream wrapping a single stored (BTYPE=00, final) DEFLATE block. */
function zlibStore(raw) {
  const out = [0x78, 0x01]; // zlib header: CM=8, CINFO=7, FLEVEL=0, FCHECK ok
  const len = raw.length;
  out.push(0x01, len & 0xff, (len >>> 8) & 0xff, (~len) & 0xff, ((~len) >>> 8) & 0xff);
  for (let i = 0; i < len; i++) out.push(raw[i]);
  return out.concat(u32(adler32(raw)));
}

/* pixels: row-major array of 0/1 (1 = ON = black). Returns Uint8Array PNG. */
export function encodePng1(pixels, w, h) {
  const stride = Math.ceil(w / 8);
  // Grayscale ct0/bd1: sample 0 = black, 1 = white. An ON pixel is black,
  // so it stays 0; OFF pixels set their bit to 1 (white), MSB-first.
  const raw = new Uint8Array(h * (1 + stride));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      if (!pixels[y * w + x]) raw[rowStart + 1 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const ihdr = u32(w).concat(u32(h), [1, 0, 0, 0, 0]); // bd=1, ct=0, comp=0, filt=0, interlace=0
  const bytes = SIG.concat(chunk("IHDR", ihdr), chunk("IDAT", zlibStore(raw)), chunk("IEND", []));
  return Uint8Array.from(bytes);
}

export function png1Blob(pixels, w, h) {
  return new Blob([encodePng1(pixels, w, h)], { type: "image/png" });
}
