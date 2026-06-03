/* Metadata Studio — universal client-side metadata viewer / editor /
   stripper for any file the browser can lift. Format-handler registry
   with magic-byte detection; libraries lazy-load from jsDelivr only
   after a file is dropped. */

// ─── pinned CDN versions ───────────────────────────────────────────────
const CDN = {
  piexif:    { src: "https://cdn.jsdelivr.net/npm/piexifjs@1.0.6/piexif.js",
               sri: "sha384-yk/k1j9hKtYh4LJRX0d6o3pO9c8h4lp2IMnWdamQhThRA2Z9B0YNDeGKyDmPXnnJ" },
  pdfLib:    { src: "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
               sri: "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI" },
  jszip:     { src: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
               sri: "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG" },
  id3Writer: { src: "https://cdn.jsdelivr.net/npm/browser-id3-writer@4.4.0/dist/browser-id3-writer.min.js",
               sri: "sha384-20uQYYNQgtOnqu3J79uflttNLoQuexHbq2reGOD+H1RLozXfD/VRqqLDXCq/PzSL" },
  exifrEsm:  "https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.esm.js",
  mmEsm:     "https://cdn.jsdelivr.net/npm/music-metadata-browser@2.5.10/+esm",
};

// ─── lazy CDN loaders ──────────────────────────────────────────────────
const libCache = new Map();

function loadScript({ src, sri }) {
  if (libCache.has(src)) return libCache.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    if (sri) {
      s.integrity = sri;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
    }
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
  libCache.set(src, p);
  return p;
}

async function loadModule(src) {
  if (libCache.has(src)) return libCache.get(src);
  const p = import(/* @vite-ignore */ src);
  libCache.set(src, p);
  return p;
}

// ─── DOM ───────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const dropEl = $("#drop");
const fileEl = $("#file");
const statusEl = $("#status");
const statusTextEl = $("#status-text");
const engineTagEl = $("#engine-tag");
const fileMetaEl = $("#file-meta");
const capsRowEl = $("#caps-row");
const capChipEl = $("#cap-chip");
const resultsPanelEl = $("#results-panel");
const metaBodyEl = $("#meta-body");
const actionPanelEl = $("#action-panel");
const btnApply = $("#btn-apply");
const btnStripAll = $("#btn-strip-all");
const btnReset = $("#btn-reset");
const btnNew = $("#btn-new");
const btnAddCustom = $("#btn-add-custom");
const customAddEl = $("#custom-add");
const customKeyEl = $("#custom-key");
const customValueEl = $("#custom-value");
const customHintEl = $("#custom-hint");
const pendingCountEl = $("#pending-count");

// ─── helpers ───────────────────────────────────────────────────────────
function setStatus(kind, msg) {
  statusEl.classList.remove("banner--info", "banner--warn", "banner--error", "is-hidden");
  statusEl.classList.add("banner--" + kind);
  statusTextEl.textContent = msg;
}
function clearStatus() {
  statusEl.classList.add("is-hidden");
  statusTextEl.textContent = "";
}
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(2)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}
function safeBlobUrl(url) {
  try { return new URL(url).protocol === "blob:" ? url : ""; }
  catch (_) { return ""; }
}
async function fileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}
function latin1Decode(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}
function latin1Encode(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
function bytesToBinaryString(bytes) {
  // For libraries (piexifjs) that want a binary string.
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return s;
}
function binaryStringToBytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = safeBlobUrl(url);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function cleanName(file, suffix = "_clean", forceExt) {
  const base = file.name.replace(/\.[^.]+$/, "") || "file";
  const ext = forceExt || file.name.match(/\.[^.]+$/)?.[0]?.slice(1) || "bin";
  return `${base}${suffix}.${ext}`;
}

// ─── CRC32 (for PNG chunks) ────────────────────────────────────────────
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(...parts) {
  let c = 0xffffffff;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) c = CRC32_TABLE[(c ^ part[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ─── format detection ──────────────────────────────────────────────────
async function detectFormat(file) {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const h = (i) => head[i];
  const ascii = (start, len) => latin1Decode(head.subarray(start, start + len));

  // JPEG
  if (h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return "jpeg";
  // PNG
  if (h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47 &&
      h(4) === 0x0d && h(5) === 0x0a && h(6) === 0x1a && h(7) === 0x0a) return "png";
  // GIF
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "gif";
  // RIFF (WebP / WAV)
  if (ascii(0, 4) === "RIFF") {
    const tag = ascii(8, 4);
    if (tag === "WEBP") return "webp";
    if (tag === "WAVE") return "wav";
  }
  // TIFF
  if ((h(0) === 0x49 && h(1) === 0x49 && h(2) === 0x2a && h(3) === 0x00) ||
      (h(0) === 0x4d && h(1) === 0x4d && h(2) === 0x00 && h(3) === 0x2a)) return "tiff";
  // HEIC (ftyp at offset 4 with heic/heix/mif1/heif brands)
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heif)/.test(brand)) return "heic";
    if (/^(mp4|isom|iso2|m4a|M4V|M4A|avc1|qt  |dash)/i.test(brand) || brand.startsWith("mp4")) return "mp4";
    return "mp4"; // fallback for any ftyp brand
  }
  // PDF
  if (ascii(0, 5) === "%PDF-") return "pdf";
  // ZIP (and Office docs which are ZIPs)
  if (h(0) === 0x50 && h(1) === 0x4b && (h(2) === 0x03 || h(2) === 0x05) && (h(3) === 0x04 || h(3) === 0x06)) {
    // peek inside via jszip to distinguish docx/xlsx/pptx/zip
    try {
      const JSZip = await ensureJSZip();
      const zip = await JSZip.loadAsync(file);
      if (zip.file("word/document.xml")) return "docx";
      if (zip.file("xl/workbook.xml")) return "xlsx";
      if (zip.file("ppt/presentation.xml")) return "pptx";
      return "zip";
    } catch (_) {
      return "zip";
    }
  }
  // FLAC
  if (ascii(0, 4) === "fLaC") return "flac";
  // OGG
  if (ascii(0, 4) === "OggS") return "ogg";
  // ID3v2 (MP3) — also raw MP3 sync FFFx, FFEx
  if (ascii(0, 3) === "ID3") return "mp3";
  if (h(0) === 0xff && (h(1) & 0xe0) === 0xe0) return "mp3";
  // SVG (XML or root element)
  const start = ascii(0, 64).trim();
  if (/^<\?xml/.test(start) || /^<svg[\s>]/i.test(start)) {
    // confirm by reading a bit more — SVG should contain "<svg" near top
    if (/<svg[\s>]/i.test(ascii(0, 64)) || file.name.toLowerCase().endsWith(".svg")) return "svg";
    return "xml";
  }

  return "unknown";
}

// ─── recommended fields per format ─────────────────────────────────────
const RECOMMENDED = {
  jpeg: new Set([
    "Make", "Model", "Software", "DateTime", "DateTimeOriginal",
    "Orientation", "Artist", "Copyright", "ImageDescription",
    "UserComment", "XPTitle", "XPAuthor", "XPComment", "XPKeywords",
    "GPSLatitude", "GPSLongitude", "GPSAltitude", "GPSDateStamp",
    "dc:title", "dc:creator", "dc:subject", "dc:rights",
  ]),
  png: new Set([
    "Title", "Author", "Description", "Copyright", "Creation Time",
    "Software", "Disclaimer", "Warning", "Source", "Comment",
    "parameters", "prompt", "workflow",
  ]),
  pdf: new Set([
    "Title", "Author", "Subject", "Keywords", "Creator", "Producer",
    "CreationDate", "ModificationDate",
  ]),
  docx: new Set([
    "dc:title", "dc:creator", "dc:subject", "dc:description",
    "cp:keywords", "cp:lastModifiedBy", "cp:revision",
    "dcterms:created", "dcterms:modified", "cp:category",
    "Application", "Company", "Manager",
  ]),
  xlsx: null, // alias to docx
  pptx: null, // alias to docx
  svg: new Set(["title", "desc", "dc:title", "dc:creator", "dc:rights", "dc:date", "cc:license"]),
  mp3: new Set([
    "title", "artist", "album", "year", "genre", "track", "disc",
    "comment", "composer", "publisher", "copyright", "albumArtist",
    "TIT2", "TPE1", "TALB", "TYER", "TDRC", "TCON", "TRCK", "TPOS",
    "COMM", "TCOM", "TPUB", "TCOP",
  ]),
  zip: new Set(["comment"]),
  webp: new Set(["Make", "Model", "Software", "DateTime", "Artist", "Copyright"]),
  gif: new Set(["dc:title", "dc:creator", "xmp:CreatorTool"]),
  wav: new Set(["INAM", "IART", "ICRD", "ICMT", "ICOP", "ISFT"]),
};
RECOMMENDED.xlsx = RECOMMENDED.docx;
RECOMMENDED.pptx = RECOMMENDED.docx;

const FORMAT_LABEL = {
  jpeg: "JPEG image", png: "PNG image", gif: "GIF image", webp: "WebP image",
  tiff: "TIFF image", heic: "HEIC / HEIF image", svg: "SVG image",
  pdf: "PDF document", docx: "Word document (DOCX)",
  xlsx: "Excel workbook (XLSX)", pptx: "PowerPoint deck (PPTX)",
  zip: "ZIP archive", mp3: "MP3 audio", wav: "WAV audio",
  flac: "FLAC audio", ogg: "OGG audio",
  mp4: "MP4 / MOV / M4A media", xml: "XML document", unknown: "Unknown format",
};

// ─── library ensurers ──────────────────────────────────────────────────
async function ensurePiexif() {
  if (window.piexif) return window.piexif;
  await loadScript(CDN.piexif);
  return window.piexif;
}
async function ensurePdfLib() {
  if (window.PDFLib) return window.PDFLib;
  await loadScript(CDN.pdfLib);
  return window.PDFLib;
}
async function ensureJSZip() {
  if (window.JSZip) return window.JSZip;
  await loadScript(CDN.jszip);
  return window.JSZip;
}
async function ensureId3Writer() {
  if (window.ID3Writer) return window.ID3Writer;
  await loadScript(CDN.id3Writer);
  return window.ID3Writer;
}
async function ensureExifr() {
  return await loadModule(CDN.exifrEsm);
}
async function ensureMM() {
  return await loadModule(CDN.mmEsm);
}

// ─── handler base helpers ──────────────────────────────────────────────
function field(group, key, value, opts = {}) {
  return {
    group,
    key,
    value: value == null ? "" : String(value),
    editable: !!opts.editable,
    recommended: !!opts.recommended,
    meta: opts.meta || null,
  };
}
function isRecommended(fmt, key) {
  const set = RECOMMENDED[fmt];
  return set ? set.has(key) : false;
}

// ─── JPEG handler ──────────────────────────────────────────────────────
function* iterJpegSegments(bytes) {
  let i = 2;
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) return;
    let marker = bytes[i + 1];
    while (marker === 0xff && i + 2 < bytes.length) { i++; marker = bytes[i + 1]; }
    if (marker === 0xda) { yield { offset: i, marker, length: bytes.length - i, data: null, sos: true }; return; }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    yield { offset: i, marker, length: 2 + len, data: bytes.subarray(i + 4, i + 2 + len) };
    i += 2 + len;
  }
}
function jpegStripNonEssential(bytes) {
  // Keep SOI (FFD8), JFIF APP0, quant tables, frame, huffman, SOS+image, EOI.
  // Drop EXIF (APP1), XMP (APP1), IPTC (APP13), Photoshop (APP13), comments,
  // and other APP markers.
  const out = [0xff, 0xd8];
  for (const seg of iterJpegSegments(bytes)) {
    if (seg.sos) {
      for (let j = seg.offset; j < bytes.length; j++) out.push(bytes[j]);
      break;
    }
    const m = seg.marker;
    // Keep APP0 (JFIF), and core baseline markers.
    const keep =
      m === 0xe0 || // APP0 / JFIF
      (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) || // SOF
      m === 0xc4 || // DHT
      m === 0xdb || // DQT
      m === 0xdd;   // DRI
    if (keep) {
      for (let j = seg.offset; j < seg.offset + seg.length; j++) out.push(bytes[j]);
    }
  }
  return new Uint8Array(out);
}

const JpegHandler = {
  label: FORMAT_LABEL.jpeg,
  caps: { read: true, edit: true, strip: true, custom: false },
  customHint: "JPEG accepts edits to standard EXIF tags. Custom keys aren't supported (use IPTC/XMP tooling for that).",

  async read(file) {
    const piexif = await ensurePiexif();
    const bytes = await fileBytes(file);
    const bin = bytesToBinaryString(bytes);

    let exif = {};
    try { exif = piexif.load(bin); }
    catch (_) { exif = {}; }

    const groups = [];
    const ifdMap = { "0th": "0th", "Exif": "Exif", "GPS": "GPS", "Interop": "Interop", "1st": "1st" };
    for (const ifdName of Object.keys(ifdMap)) {
      const ifdKey = ifdMap[ifdName];
      const ifd = exif[ifdKey] || {};
      const fields = [];
      for (const tagId of Object.keys(ifd)) {
        const tagInfo = piexif.TAGS[ifdName] && piexif.TAGS[ifdName][tagId];
        const name = (tagInfo && tagInfo.name) || `Tag ${tagId}`;
        const val = ifd[tagId];
        const display = Array.isArray(val) ? val.join(", ") : String(val);
        fields.push(field(`EXIF · ${ifdName}`, name, display, {
          editable: true,
          recommended: isRecommended("jpeg", name),
          meta: { ifdName, tagId: Number(tagId), tagInfo },
        }));
      }
      if (fields.length) groups.push({ name: `EXIF · ${ifdName}`, fields });
    }

    // XMP / IPTC discovery via segment walker — read-only here.
    for (const seg of iterJpegSegments(bytes)) {
      if (seg.sos) break;
      if (seg.marker === 0xe1 && seg.data) {
        const head = latin1Decode(seg.data.subarray(0, 29));
        if (head.startsWith("http://ns.adobe.com/xap/1.0/")) {
          const xmpXml = new TextDecoder("utf-8").decode(seg.data.subarray(29));
          const xmpFields = parseXmpPacket(xmpXml);
          if (xmpFields.length) groups.push({ name: "XMP", fields: xmpFields.map((f) =>
            field("XMP", f.key, f.value, { editable: false, recommended: isRecommended("jpeg", f.key) })) });
        }
      }
      if (seg.marker === 0xed && seg.data) {
        const head = latin1Decode(seg.data.subarray(0, 14));
        if (head.startsWith("Photoshop 3.0")) {
          // IPTC IIM dataset — opaque to us in v1. Surface its presence.
          groups.push({ name: "IPTC / Photoshop", fields: [
            field("IPTC / Photoshop", "(present)", `${seg.data.length} bytes`, { editable: false }),
          ]});
        }
      }
      if (seg.marker === 0xfe && seg.data) {
        groups.push({ name: "JPEG Comment", fields: [
          field("JPEG Comment", "Comment", latin1Decode(seg.data), { editable: false }),
        ]});
      }
    }

    return { groups, raw: { bytes, exif } };
  },

  async write(file, ops, raw) {
    const piexif = await ensurePiexif();
    const bytes = raw?.bytes || (await fileBytes(file));
    const stripAll = ops.stripAll;

    // Strip-all path: drop every non-essential segment.
    if (stripAll) {
      return new Blob([jpegStripNonEssential(bytes)], { type: "image/jpeg" });
    }

    // Rebuild exif object with edits / per-row strips applied.
    const exif = raw?.exif ? JSON.parse(JSON.stringify(raw.exif)) : {};
    const ifdMap = { "0th": "0th", "Exif": "Exif", "GPS": "GPS", "Interop": "Interop", "1st": "1st" };
    for (const stripped of ops.stripKeys) {
      const m = stripped.meta;
      if (!m) continue;
      const ifdKey = ifdMap[m.ifdName];
      if (exif[ifdKey]) delete exif[ifdKey][m.tagId];
    }
    for (const [k, v] of ops.edits) {
      const m = k.meta;
      if (!m) continue;
      const ifdKey = ifdMap[m.ifdName];
      if (!exif[ifdKey]) exif[ifdKey] = {};
      exif[ifdKey][m.tagId] = coerceExifValue(m.tagInfo, v);
    }

    let outBin;
    try {
      // piexif.remove first to clear existing EXIF, then insert the new one.
      const bin = bytesToBinaryString(bytes);
      const clean = piexif.remove(bin);
      const exifBin = piexif.dump(exif);
      outBin = piexif.insert(exifBin, clean);
    } catch (e) {
      throw new Error("Failed to write EXIF: " + (e.message || e));
    }
    const outBytes = binaryStringToBytes(outBin);

    // Apply XMP / IPTC strips if requested (group-level strip via stripKeys
    // touching those rows). For v1 we only strip-all those segments when the
    // user uses Strip all (handled above).
    return new Blob([outBytes], { type: "image/jpeg" });
  },
};

function coerceExifValue(tagInfo, value) {
  const t = tagInfo?.type;
  if (!t) return value;
  if (t === "Ascii") return String(value);
  if (t === "Byte" || t === "Short" || t === "Long" || t === "SShort" || t === "SLong") {
    const parts = String(value).split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
    return parts.length === 1 ? parts[0] : parts;
  }
  if (t === "Rational" || t === "SRational") {
    const parts = String(value).split(",").map((s) => s.trim());
    if (parts.length === 2 && /^-?\d+$/.test(parts[0]) && /^-?\d+$/.test(parts[1])) {
      return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
    }
    return value;
  }
  return value;
}

// ─── tiny XMP packet parser (read-only, surface RDF descriptions) ──────
function parseXmpPacket(xml) {
  const fields = [];
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const all = doc.getElementsByTagName("*");
    for (const el of all) {
      const local = el.localName || el.nodeName;
      const prefix = el.prefix || "";
      const qname = prefix ? `${prefix}:${local}` : local;
      // Skip wrapper elements.
      if (/^(xmpmeta|RDF|Description|Bag|Seq|Alt|li)$/i.test(local)) continue;
      const text = (el.textContent || "").trim();
      if (text && text.length < 500) fields.push({ key: qname, value: text });
    }
    // Attributes on rdf:Description carry many XMP fields too.
    const descs = doc.getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "Description");
    for (const d of descs) {
      for (const attr of d.attributes) {
        const ns = attr.namespaceURI;
        if (ns && ns !== "http://www.w3.org/1999/02/22-rdf-syntax-ns#") {
          fields.push({ key: attr.name, value: attr.value });
        }
      }
    }
  } catch (_) {}
  return fields;
}

// ─── PNG handler ───────────────────────────────────────────────────────
function pngParseChunks(bytes) {
  const chunks = [];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const len = (bytes[i] * 0x1000000) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
    const type = latin1Decode(bytes.subarray(i + 4, i + 8));
    if (i + 12 + len > bytes.length) break;
    const data = bytes.subarray(i + 8, i + 8 + len);
    chunks.push({ type, data });
    i += 12 + len;
    if (type === "IEND") break;
  }
  return chunks;
}
function pngBuild(chunks) {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let total = 8;
  for (const c of chunks) total += 12 + c.data.length;
  const out = new Uint8Array(total);
  out.set(sig, 0);
  let i = 8;
  for (const c of chunks) {
    const len = c.data.length;
    out[i] = (len >>> 24) & 0xff;
    out[i + 1] = (len >>> 16) & 0xff;
    out[i + 2] = (len >>> 8) & 0xff;
    out[i + 3] = len & 0xff;
    const typeBytes = latin1Encode(c.type);
    out.set(typeBytes, i + 4);
    out.set(c.data, i + 8);
    const crc = crc32(typeBytes, c.data);
    out[i + 8 + len] = (crc >>> 24) & 0xff;
    out[i + 9 + len] = (crc >>> 16) & 0xff;
    out[i + 10 + len] = (crc >>> 8) & 0xff;
    out[i + 11 + len] = crc & 0xff;
    i += 12 + len;
  }
  return out;
}
async function pngDecodeChunkText(chunk) {
  const data = chunk.data;
  if (chunk.type === "tEXt") {
    const nul = data.indexOf(0);
    if (nul < 0) return null;
    return { keyword: latin1Decode(data.subarray(0, nul)), text: latin1Decode(data.subarray(nul + 1)), source: "tEXt" };
  }
  if (chunk.type === "iTXt") {
    let p = data.indexOf(0);
    if (p < 0) return null;
    const keyword = latin1Decode(data.subarray(0, p));
    const compFlag = data[p + 1];
    // const compMethod = data[p + 2];
    let p2 = data.indexOf(0, p + 3);
    // const lang = latin1Decode(data.subarray(p + 3, p2));
    let p3 = data.indexOf(0, p2 + 1);
    // const translated = new TextDecoder("utf-8").decode(data.subarray(p2 + 1, p3));
    const txtBytes = data.subarray(p3 + 1);
    let text;
    if (compFlag === 1) {
      try {
        const ds = new DecompressionStream("deflate");
        const decompressed = await new Response(new Blob([txtBytes]).stream().pipeThrough(ds)).arrayBuffer();
        text = new TextDecoder("utf-8").decode(new Uint8Array(decompressed));
      } catch (_) {
        text = "(compressed iTXt — could not decompress)";
      }
    } else {
      text = new TextDecoder("utf-8").decode(txtBytes);
    }
    return { keyword, text, source: "iTXt" };
  }
  if (chunk.type === "zTXt") {
    const nul = data.indexOf(0);
    if (nul < 0) return null;
    const keyword = latin1Decode(data.subarray(0, nul));
    const compBytes = data.subarray(nul + 2);
    let text;
    try {
      const ds = new DecompressionStream("deflate");
      const decompressed = await new Response(new Blob([compBytes]).stream().pipeThrough(ds)).arrayBuffer();
      text = latin1Decode(new Uint8Array(decompressed));
    } catch (_) {
      text = "(compressed zTXt — could not decompress)";
    }
    return { keyword, text, source: "zTXt" };
  }
  return null;
}
function makeTextChunk(keyword, text) {
  // Use iTXt for UTF-8 safety unless the value is pure ASCII and the keyword is too.
  const isAscii = /^[\x00-\x7f]*$/.test(keyword + text);
  if (isAscii) {
    const kw = latin1Encode(keyword);
    const tx = latin1Encode(text);
    const data = new Uint8Array(kw.length + 1 + tx.length);
    data.set(kw, 0);
    data[kw.length] = 0;
    data.set(tx, kw.length + 1);
    return { type: "tEXt", data };
  }
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  const tx = enc.encode(text);
  const data = new Uint8Array(kw.length + 5 + tx.length);
  data.set(kw, 0);
  data[kw.length] = 0;     // null separator
  data[kw.length + 1] = 0; // comp flag
  data[kw.length + 2] = 0; // comp method
  data[kw.length + 3] = 0; // lang null
  data[kw.length + 4] = 0; // translated null
  data.set(tx, kw.length + 5);
  return { type: "iTXt", data };
}

const PngHandler = {
  label: FORMAT_LABEL.png,
  caps: { read: true, edit: true, strip: true, custom: true },
  customHint: "PNG accepts arbitrary keyword/value text pairs via tEXt (ASCII) or iTXt (UTF-8) chunks.",

  async read(file) {
    const bytes = await fileBytes(file);
    const chunks = pngParseChunks(bytes);
    const groups = [];
    const textFields = [];
    const otherFields = [];

    for (let idx = 0; idx < chunks.length; idx++) {
      const c = chunks[idx];
      if (c.type === "tEXt" || c.type === "iTXt" || c.type === "zTXt") {
        const decoded = await pngDecodeChunkText(c);
        if (decoded) {
          textFields.push(field("Text", decoded.keyword, decoded.text, {
            editable: true,
            recommended: isRecommended("png", decoded.keyword),
            meta: { idx, source: decoded.source, keyword: decoded.keyword },
          }));
        }
      } else if (c.type === "tIME") {
        const d = c.data;
        const y = (d[0] << 8) | d[1];
        const stamp = `${y}-${String(d[2]).padStart(2, "0")}-${String(d[3]).padStart(2, "0")} ${String(d[4]).padStart(2, "0")}:${String(d[5]).padStart(2, "0")}:${String(d[6]).padStart(2, "0")}`;
        otherFields.push(field("Other PNG chunks", "tIME", stamp, { editable: false, meta: { idx, chunkType: "tIME" } }));
      } else if (c.type === "eXIf") {
        otherFields.push(field("Other PNG chunks", "eXIf", `${c.data.length} bytes (embedded EXIF)`, { editable: false, meta: { idx, chunkType: "eXIf" } }));
      } else if (!/^(IHDR|IDAT|IEND|PLTE|tRNS|gAMA|cHRM|sRGB|iCCP|bKGD|pHYs|sBIT|hIST|sPLT)$/.test(c.type)) {
        otherFields.push(field("Other PNG chunks", c.type, `${c.data.length} bytes`, { editable: false, meta: { idx, chunkType: c.type } }));
      }
    }

    if (textFields.length) groups.push({ name: "Text", fields: textFields });
    if (otherFields.length) groups.push({ name: "Other PNG chunks", fields: otherFields });

    return { groups, raw: { bytes, chunks } };
  },

  async write(file, ops, raw) {
    let chunks = raw?.chunks ? [...raw.chunks] : pngParseChunks(await fileBytes(file));
    const stripAll = ops.stripAll;
    const keepCore = /^(IHDR|IDAT|IEND|PLTE|tRNS|gAMA|cHRM|sRGB|iCCP|bKGD|pHYs|sBIT|hIST|sPLT|acTL|fcTL|fdAT)$/;

    if (stripAll) {
      chunks = chunks.filter((c) => keepCore.test(c.type));
    } else {
      // Apply per-row strips by chunk index.
      const stripIdx = new Set();
      for (const sk of ops.stripKeys) {
        if (sk.meta && typeof sk.meta.idx === "number") stripIdx.add(sk.meta.idx);
      }
      // Apply per-row edits — replace text chunks in-place.
      const edits = new Map();
      for (const [k, v] of ops.edits) {
        if (k.meta && typeof k.meta.idx === "number") edits.set(k.meta.idx, { keyword: k.meta.keyword, text: v });
      }
      chunks = chunks
        .map((c, i) => {
          if (stripIdx.has(i)) return null;
          if (edits.has(i)) return makeTextChunk(edits.get(i).keyword, edits.get(i).text);
          return c;
        })
        .filter(Boolean);
      // Add custom new fields just before IDAT.
      if (ops.customFields.length) {
        const idatIdx = chunks.findIndex((c) => c.type === "IDAT");
        const insertAt = idatIdx < 0 ? chunks.length - 1 : idatIdx;
        const newChunks = ops.customFields.map((cf) => makeTextChunk(cf.key, cf.value));
        chunks.splice(insertAt, 0, ...newChunks);
      }
    }
    const out = pngBuild(chunks);
    return new Blob([out], { type: "image/png" });
  },
};

// ─── PDF handler (pdf-lib) ─────────────────────────────────────────────
const PDF_FIELDS = [
  ["Title", "getTitle", "setTitle"],
  ["Author", "getAuthor", "setAuthor"],
  ["Subject", "getSubject", "setSubject"],
  ["Keywords", "getKeywords", "setKeywords"],
  ["Creator", "getCreator", "setCreator"],
  ["Producer", "getProducer", "setProducer"],
  ["CreationDate", "getCreationDate", "setCreationDate"],
  ["ModificationDate", "getModificationDate", "setModificationDate"],
];
const PdfHandler = {
  label: FORMAT_LABEL.pdf,
  caps: { read: true, edit: true, strip: true, custom: false },
  customHint: "PDF custom info-dict keys aren't supported by pdf-lib's high-level API.",

  async read(file) {
    const { PDFDocument } = await ensurePdfLib();
    const bytes = await fileBytes(file);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const fields = [];
    for (const [name, getter] of PDF_FIELDS) {
      let v;
      try { v = doc[getter](); } catch (_) { v = undefined; }
      if (v instanceof Date) v = v.toISOString();
      if (Array.isArray(v)) v = v.join(", ");
      fields.push(field("PDF Info", name, v ?? "", {
        editable: true,
        recommended: isRecommended("pdf", name),
        meta: { pdfKey: name },
      }));
    }
    return { groups: [{ name: "PDF Info", fields }], raw: { bytes } };
  },

  async write(file, ops, raw) {
    const { PDFDocument } = await ensurePdfLib();
    const bytes = raw?.bytes || (await fileBytes(file));
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });

    const setField = (name, value) => {
      const entry = PDF_FIELDS.find(([n]) => n === name);
      if (!entry) return;
      const [, , setter] = entry;
      try {
        if (setter === "setKeywords") {
          if (value === "" || value == null) doc.setKeywords([]);
          else doc.setKeywords(String(value).split(",").map((s) => s.trim()).filter(Boolean));
        } else if (setter === "setCreationDate" || setter === "setModificationDate") {
          if (value === "" || value == null) doc[setter](new Date(0));
          else {
            const d = new Date(value);
            doc[setter](isNaN(d.getTime()) ? new Date() : d);
          }
        } else {
          doc[setter](value == null ? "" : String(value));
        }
      } catch (_) {}
    };

    if (ops.stripAll) {
      for (const [name] of PDF_FIELDS) setField(name, "");
    } else {
      for (const sk of ops.stripKeys) {
        if (sk.meta?.pdfKey) setField(sk.meta.pdfKey, "");
      }
      for (const [k, v] of ops.edits) {
        if (k.meta?.pdfKey) setField(k.meta.pdfKey, v);
      }
    }
    const out = await doc.save({ useObjectStreams: false });
    return new Blob([out], { type: "application/pdf" });
  },
};

// ─── Office (DOCX / XLSX / PPTX) handler — jszip + DOMParser ───────────
const OOXML_CORE_PATH = "docProps/core.xml";
const OOXML_APP_PATH = "docProps/app.xml";

const OOXML_NS = {
  cp: "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
  dc: "http://purl.org/dc/elements/1.1/",
  dcterms: "http://purl.org/dc/terms/",
  dcmitype: "http://purl.org/dc/dcmitype/",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
};

const OOXML_CORE_FIELDS = [
  { name: "dc:title", ns: "dc", local: "title" },
  { name: "dc:subject", ns: "dc", local: "subject" },
  { name: "dc:creator", ns: "dc", local: "creator" },
  { name: "dc:description", ns: "dc", local: "description" },
  { name: "cp:keywords", ns: "cp", local: "keywords" },
  { name: "cp:lastModifiedBy", ns: "cp", local: "lastModifiedBy" },
  { name: "cp:revision", ns: "cp", local: "revision" },
  { name: "cp:category", ns: "cp", local: "category" },
  { name: "cp:contentStatus", ns: "cp", local: "contentStatus" },
  { name: "dcterms:created", ns: "dcterms", local: "created" },
  { name: "dcterms:modified", ns: "dcterms", local: "modified" },
];

function makeOoxmlOffice(formatLabel, mime, fileExt) {
  return {
    label: formatLabel,
    caps: { read: true, edit: true, strip: true, custom: false },
    customHint: "Office documents use a fixed core-properties schema.",
    mime,
    fileExt,

    async read(file) {
      const JSZip = await ensureJSZip();
      const zip = await JSZip.loadAsync(file);
      const groups = [];

      // core.xml
      const coreFields = [];
      let coreDoc = null;
      const core = zip.file(OOXML_CORE_PATH);
      if (core) {
        const xml = await core.async("string");
        coreDoc = new DOMParser().parseFromString(xml, "application/xml");
        for (const cf of OOXML_CORE_FIELDS) {
          const el = coreDoc.getElementsByTagNameNS(OOXML_NS[cf.ns], cf.local)[0];
          const val = el ? (el.textContent || "") : "";
          coreFields.push(field("Core Properties", cf.name, val, {
            editable: true,
            recommended: isRecommended("docx", cf.name),
            meta: { source: "core", ns: cf.ns, local: cf.local, fieldName: cf.name },
          }));
        }
      }
      if (coreFields.length) groups.push({ name: "Core Properties", fields: coreFields });

      // app.xml
      const appFields = [];
      let appDoc = null;
      const app = zip.file(OOXML_APP_PATH);
      if (app) {
        const xml = await app.async("string");
        appDoc = new DOMParser().parseFromString(xml, "application/xml");
        const props = appDoc.documentElement;
        if (props) {
          for (const child of Array.from(props.children)) {
            const name = child.localName;
            const val = child.textContent || "";
            // Only surface scalar string/number children.
            if (child.children.length === 0) {
              appFields.push(field("App Properties", name, val, {
                editable: true,
                recommended: isRecommended("docx", name),
                meta: { source: "app", local: name, fieldName: name },
              }));
            }
          }
        }
      }
      if (appFields.length) groups.push({ name: "App Properties", fields: appFields });

      return { groups, raw: { zip, coreDoc, appDoc } };
    },

    async write(file, ops, raw) {
      const JSZip = await ensureJSZip();
      const zip = raw?.zip || await JSZip.loadAsync(file);
      const editsBySource = { core: new Map(), app: new Map() };
      const stripBySource = { core: new Set(), app: new Set() };

      if (ops.stripAll) {
        for (const cf of OOXML_CORE_FIELDS) stripBySource.core.add(cf.name);
        // App: collect from the existing doc.
        if (raw?.appDoc) {
          for (const c of Array.from(raw.appDoc.documentElement?.children || [])) {
            stripBySource.app.add(c.localName);
          }
        }
      } else {
        for (const sk of ops.stripKeys) {
          if (sk.meta?.source) stripBySource[sk.meta.source].add(sk.meta.fieldName);
        }
        for (const [k, v] of ops.edits) {
          if (k.meta?.source) editsBySource[k.meta.source].set(k.meta.fieldName, v);
        }
      }

      // core.xml rewrite
      if (raw?.coreDoc || zip.file(OOXML_CORE_PATH)) {
        const coreDoc = raw?.coreDoc || new DOMParser().parseFromString(await zip.file(OOXML_CORE_PATH).async("string"), "application/xml");
        for (const cf of OOXML_CORE_FIELDS) {
          let el = coreDoc.getElementsByTagNameNS(OOXML_NS[cf.ns], cf.local)[0];
          const stripped = stripBySource.core.has(cf.name);
          const editedVal = editsBySource.core.get(cf.name);
          if (stripped) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          } else if (editedVal !== undefined) {
            if (!el) {
              el = coreDoc.createElementNS(OOXML_NS[cf.ns], cf.name);
              if (cf.ns === "dcterms") el.setAttributeNS(OOXML_NS.xsi, "xsi:type", "dcterms:W3CDTF");
              coreDoc.documentElement.appendChild(el);
            }
            el.textContent = editedVal == null ? "" : String(editedVal);
          }
        }
        const out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new XMLSerializer().serializeToString(coreDoc.documentElement);
        zip.file(OOXML_CORE_PATH, out);
      }

      // app.xml rewrite
      if (raw?.appDoc || zip.file(OOXML_APP_PATH)) {
        const appDoc = raw?.appDoc || new DOMParser().parseFromString(await zip.file(OOXML_APP_PATH).async("string"), "application/xml");
        const root = appDoc.documentElement;
        for (const child of Array.from(root.children)) {
          const local = child.localName;
          if (stripBySource.app.has(local)) {
            root.removeChild(child);
            continue;
          }
          if (editsBySource.app.has(local)) {
            child.textContent = String(editsBySource.app.get(local) ?? "");
          }
        }
        const out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new XMLSerializer().serializeToString(root);
        zip.file(OOXML_APP_PATH, out);
      }

      const blob = await zip.generateAsync({ type: "blob", mimeType: mime, compression: "DEFLATE" });
      return blob;
    },
  };
}

const DocxHandler = makeOoxmlOffice(FORMAT_LABEL.docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx");
const XlsxHandler = makeOoxmlOffice(FORMAT_LABEL.xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
const PptxHandler = makeOoxmlOffice(FORMAT_LABEL.pptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx");

// ─── ZIP handler (entries + archive comment) ───────────────────────────
const ZipHandler = {
  label: FORMAT_LABEL.zip,
  caps: { read: true, edit: true, strip: true, custom: false },
  customHint: "ZIP custom metadata isn't supported — edit per-entry comments above.",

  async read(file) {
    const JSZip = await ensureJSZip();
    const zip = await JSZip.loadAsync(file);
    const groups = [];

    const archiveFields = [];
    archiveFields.push(field("Archive", "comment", zip.comment || "", {
      editable: true,
      recommended: true,
      meta: { kind: "archiveComment" },
    }));
    archiveFields.push(field("Archive", "entries", String(Object.keys(zip.files).length), { editable: false }));
    groups.push({ name: "Archive", fields: archiveFields });

    const entryFields = [];
    let i = 0;
    for (const name of Object.keys(zip.files)) {
      if (i++ > 200) {
        entryFields.push(field("Entries", "(truncated)", `${Object.keys(zip.files).length - 200} more entries…`, { editable: false }));
        break;
      }
      const entry = zip.files[name];
      const date = entry.date ? entry.date.toISOString() : "";
      entryFields.push(field("Entries", name, `${date}${entry.comment ? "  // " + entry.comment : ""}`, {
        editable: !entry.dir,
        meta: { kind: "entry", name },
      }));
    }
    if (entryFields.length) groups.push({ name: "Entries", fields: entryFields });

    return { groups, raw: { zip } };
  },

  async write(file, ops, raw) {
    const JSZip = await ensureJSZip();
    const zip = raw?.zip || await JSZip.loadAsync(file);

    if (ops.stripAll) {
      zip.comment = "";
      for (const name of Object.keys(zip.files)) {
        const entry = zip.files[name];
        entry.comment = "";
      }
    } else {
      for (const sk of ops.stripKeys) {
        if (sk.meta?.kind === "archiveComment") zip.comment = "";
        if (sk.meta?.kind === "entry" && zip.files[sk.meta.name]) zip.files[sk.meta.name].comment = "";
      }
      for (const [k, v] of ops.edits) {
        if (k.meta?.kind === "archiveComment") zip.comment = String(v ?? "");
        if (k.meta?.kind === "entry" && zip.files[k.meta.name]) {
          // Value is "<date>  // <comment>"; only let users edit the comment portion.
          const sep = v.indexOf("//");
          zip.files[k.meta.name].comment = sep >= 0 ? v.slice(sep + 2).trim() : v;
        }
      }
    }

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return blob;
  },
};

// ─── SVG handler — native DOMParser ────────────────────────────────────
const SvgHandler = {
  label: FORMAT_LABEL.svg,
  caps: { read: true, edit: true, strip: true, custom: true },
  customHint: "Custom keys add child elements under <metadata> (key becomes the element name, value the text content).",

  async read(file) {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "image/svg+xml");
    const fields = [];

    const titleEl = doc.querySelector("svg > title");
    fields.push(field("SVG", "title", titleEl ? titleEl.textContent : "", {
      editable: true, recommended: true, meta: { kind: "title" },
    }));
    const descEl = doc.querySelector("svg > desc");
    fields.push(field("SVG", "desc", descEl ? descEl.textContent : "", {
      editable: true, recommended: true, meta: { kind: "desc" },
    }));

    const metaEl = doc.querySelector("svg > metadata");
    if (metaEl) {
      for (const node of Array.from(metaEl.getElementsByTagName("*"))) {
        if (node.children.length === 0) {
          const prefix = node.prefix ? node.prefix + ":" : "";
          fields.push(field("SVG metadata", prefix + node.localName, (node.textContent || "").trim(), {
            editable: true,
            recommended: isRecommended("svg", prefix + node.localName),
            meta: { kind: "metadata-child", localName: node.localName, prefix: node.prefix || "" },
          }));
        }
      }
    }

    // Editor-injected attributes / namespaces
    const root = doc.documentElement;
    for (const attr of Array.from(root.attributes)) {
      if (/inkscape|sodipodi/.test(attr.name) && attr.name !== "xmlns:inkscape" && attr.name !== "xmlns:sodipodi") {
        fields.push(field("SVG editor", attr.name, attr.value, {
          editable: false, meta: { kind: "root-attr", name: attr.name },
        }));
      }
    }

    return { groups: [{ name: "SVG", fields }], raw: { doc, text } };
  },

  async write(file, ops, raw) {
    const doc = raw?.doc || new DOMParser().parseFromString(await file.text(), "image/svg+xml");
    const root = doc.documentElement;
    const svgNs = "http://www.w3.org/2000/svg";

    function setOrCreate(tagName, value) {
      let el = doc.querySelector(`svg > ${tagName}`);
      if (value === "" && el) {
        el.parentNode.removeChild(el);
        return;
      }
      if (!el) {
        el = doc.createElementNS(svgNs, tagName);
        root.insertBefore(el, root.firstChild);
      }
      el.textContent = value;
    }

    if (ops.stripAll) {
      for (const tag of ["title", "desc", "metadata"]) {
        const el = doc.querySelector(`svg > ${tag}`);
        if (el) el.parentNode.removeChild(el);
      }
      // Strip inkscape/sodipodi attrs on the root.
      for (const attr of Array.from(root.attributes)) {
        if (/^(inkscape|sodipodi):/.test(attr.name)) root.removeAttribute(attr.name);
      }
    } else {
      for (const sk of ops.stripKeys) {
        const m = sk.meta;
        if (!m) continue;
        if (m.kind === "title" || m.kind === "desc") {
          const el = doc.querySelector(`svg > ${m.kind}`);
          if (el) el.parentNode.removeChild(el);
        } else if (m.kind === "metadata-child") {
          const metaEl = doc.querySelector("svg > metadata");
          if (metaEl) {
            for (const c of Array.from(metaEl.getElementsByTagName("*"))) {
              if (c.localName === m.localName) c.parentNode.removeChild(c);
            }
          }
        } else if (m.kind === "root-attr") {
          root.removeAttribute(m.name);
        }
      }
      for (const [k, v] of ops.edits) {
        const m = k.meta;
        if (!m) continue;
        if (m.kind === "title") setOrCreate("title", v);
        else if (m.kind === "desc") setOrCreate("desc", v);
        else if (m.kind === "metadata-child") {
          let metaEl = doc.querySelector("svg > metadata");
          if (!metaEl) {
            metaEl = doc.createElementNS(svgNs, "metadata");
            root.appendChild(metaEl);
          }
          let target;
          for (const c of metaEl.getElementsByTagName("*")) {
            if (c.localName === m.localName) { target = c; break; }
          }
          if (!target) {
            target = doc.createElement(m.prefix ? `${m.prefix}:${m.localName}` : m.localName);
            metaEl.appendChild(target);
          }
          target.textContent = v;
        }
      }
      // Custom additions go into <metadata>.
      if (ops.customFields.length) {
        let metaEl = doc.querySelector("svg > metadata");
        if (!metaEl) {
          metaEl = doc.createElementNS(svgNs, "metadata");
          root.appendChild(metaEl);
        }
        for (const cf of ops.customFields) {
          const el = doc.createElement(cf.key);
          el.textContent = cf.value;
          metaEl.appendChild(el);
        }
      }
    }

    const out = new XMLSerializer().serializeToString(doc);
    return new Blob([out], { type: "image/svg+xml" });
  },
};

// ─── MP3 handler — mm-browser (read) + browser-id3-writer (write) ──────
const MP3_FRAME_FOR_TAG = {
  title: "TIT2", artist: "TPE1", album: "TALB", year: "TYER",
  date: "TDRC", genre: "TCON", track: "TRCK", disc: "TPOS",
  comment: "COMM", composer: "TCOM", publisher: "TPUB",
  copyright: "TCOP", albumArtist: "TPE2", encodedBy: "TENC",
};
const Mp3Handler = {
  label: FORMAT_LABEL.mp3,
  caps: { read: true, edit: true, strip: true, custom: true },
  customHint: "Custom MP3 keys are written as TXXX (user-defined text) frames.",

  async read(file) {
    const mm = await ensureMM();
    const meta = await mm.parseBlob(file);
    const fields = [];
    const common = meta.common || {};
    for (const [k, v] of Object.entries(common)) {
      if (v == null || (Array.isArray(v) && !v.length)) continue;
      const isComplex = typeof v === "object" && !Array.isArray(v);
      if (isComplex) {
        if (k === "picture") {
          fields.push(field("ID3 (common)", "picture", `${v.length || 1} image(s) embedded`, { editable: false }));
          continue;
        }
        fields.push(field("ID3 (common)", k, JSON.stringify(v).slice(0, 200), { editable: false }));
        continue;
      }
      const display = Array.isArray(v) ? v.join(", ") : String(v);
      fields.push(field("ID3 (common)", k, display, {
        editable: !!MP3_FRAME_FOR_TAG[k],
        recommended: isRecommended("mp3", k),
        meta: { commonKey: k, frame: MP3_FRAME_FOR_TAG[k] || null },
      }));
    }

    const groups = [];
    if (fields.length) groups.push({ name: "ID3 (common)", fields });

    // Native (per-tag-format) frames.
    const native = meta.native || {};
    for (const fmt of Object.keys(native)) {
      const list = native[fmt] || [];
      const nativeFields = [];
      for (const item of list) {
        const id = item.id;
        const value = typeof item.value === "object" ? JSON.stringify(item.value).slice(0, 200) : String(item.value || "");
        nativeFields.push(field(`Native · ${fmt}`, id, value, {
          editable: false,
          recommended: isRecommended("mp3", id),
        }));
      }
      if (nativeFields.length) groups.push({ name: `Native · ${fmt}`, fields: nativeFields });
    }

    return { groups, raw: { meta } };
  },

  async write(file, ops, raw) {
    const ID3Writer = await ensureId3Writer();
    const bytes = await fileBytes(file);

    if (ops.stripAll) {
      return new Blob([stripId3v2(bytes)], { type: "audio/mpeg" });
    }

    // ID3Writer constructs a fresh tag — existing frames are NOT preserved.
    // To avoid losing un-edited fields we seed the writer from raw.meta.common.
    const audioOnly = stripId3v2(bytes);
    const buf = audioOnly.buffer.slice(audioOnly.byteOffset, audioOnly.byteOffset + audioOnly.byteLength);
    const writer = new ID3Writer(buf);

    const common = raw?.meta?.common || {};
    const stripFrames = new Set();
    for (const sk of ops.stripKeys) if (sk.meta?.frame) stripFrames.add(sk.meta.frame);
    const editsByFrame = new Map();
    for (const [k, v] of ops.edits) if (k.meta?.frame) editsByFrame.set(k.meta.frame, v);

    for (const [commonKey, frame] of Object.entries(MP3_FRAME_FOR_TAG)) {
      if (stripFrames.has(frame)) continue;
      let value;
      if (editsByFrame.has(frame)) {
        value = editsByFrame.get(frame);
      } else {
        const v = common[commonKey];
        if (v == null || (Array.isArray(v) && !v.length)) continue;
        value = Array.isArray(v) ? v.join(", ") : String(v);
      }
      if (value === "" || value == null) continue;
      try { writer.setFrame(frame, coerceMp3FrameValue(frame, value)); } catch (_) {}
    }

    for (const cf of ops.customFields) {
      try { writer.setFrame("TXXX", { description: cf.key, value: String(cf.value) }); } catch (_) {}
    }

    writer.addTag();
    return new Blob([writer.arrayBuffer], { type: "audio/mpeg" });
  },
};

function coerceMp3FrameValue(frame, v) {
  if (frame === "TYER" || frame === "TDRC") return parseInt(v, 10) || 0;
  if (frame === "COMM") return { description: "", text: String(v), language: "eng" };
  return String(v);
}

function stripId3v2(bytes) {
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    // Synchsafe size at offset 6..9.
    const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    return bytes.subarray(10 + size);
  }
  return bytes;
}

// ─── RIFF walker — used by WebP and WAV ───────────────────────────────
function* iterRiffChunks(bytes) {
  const formId = latin1Decode(bytes.subarray(8, 12));
  let i = 12;
  while (i + 8 <= bytes.length) {
    const id = latin1Decode(bytes.subarray(i, i + 4));
    const size = bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24);
    if (i + 8 + size > bytes.length) break;
    yield { id, size, offset: i, data: bytes.subarray(i + 8, i + 8 + size) };
    i += 8 + size + (size & 1); // pad to even
  }
}
function buildRiff(formId, chunks) {
  let total = 12;
  for (const c of chunks) total += 8 + c.data.length + (c.data.length & 1);
  const out = new Uint8Array(total);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  // size at offset 4 = total - 8
  const size = total - 8;
  out[4] = size & 0xff; out[5] = (size >>> 8) & 0xff; out[6] = (size >>> 16) & 0xff; out[7] = (size >>> 24) & 0xff;
  out.set(latin1Encode(formId), 8);
  let i = 12;
  for (const c of chunks) {
    out.set(latin1Encode(c.id), i);
    const len = c.data.length;
    out[i + 4] = len & 0xff; out[i + 5] = (len >>> 8) & 0xff;
    out[i + 6] = (len >>> 16) & 0xff; out[i + 7] = (len >>> 24) & 0xff;
    out.set(c.data, i + 8);
    i += 8 + len + (len & 1);
  }
  return out;
}

// ─── WebP — read EXIF/XMP via exifr; strip via RIFF walker ─────────────
const WebpHandler = {
  label: FORMAT_LABEL.webp,
  caps: { read: true, edit: false, strip: true, custom: false },
  customHint: "WebP supports strip-all and read; in-place field edits would require reconstructing VP8X flags and aren't implemented in v1.",

  async read(file) {
    const exifr = await ensureExifr();
    const groups = [];
    try {
      const data = await exifr.parse(file, { tiff: true, xmp: true, ifd0: true, exif: true, gps: true });
      if (data) {
        const fields = [];
        for (const [k, v] of Object.entries(data)) {
          if (v == null) continue;
          fields.push(field("EXIF / XMP", k, fmtAny(v), {
            editable: false,
            recommended: isRecommended("webp", k),
          }));
        }
        if (fields.length) groups.push({ name: "EXIF / XMP", fields });
      }
    } catch (_) {}

    // List RIFF chunks present.
    const bytes = await fileBytes(file);
    const riffFields = [];
    for (const c of iterRiffChunks(bytes)) {
      riffFields.push(field("RIFF chunks", c.id, `${c.size} bytes`, { editable: false, meta: { chunkId: c.id } }));
    }
    if (riffFields.length) groups.push({ name: "RIFF chunks", fields: riffFields });

    return { groups, raw: { bytes } };
  },

  async write(file, ops, raw) {
    const bytes = raw?.bytes || (await fileBytes(file));
    if (!ops.stripAll && !ops.stripKeys.size) return new Blob([bytes], { type: "image/webp" });
    const chunks = [];
    for (const c of iterRiffChunks(bytes)) {
      if (ops.stripAll && (c.id === "EXIF" || c.id === "XMP " || c.id === "ICCP")) continue;
      chunks.push({ id: c.id, data: c.data });
    }
    // Clear EXIF/XMP flag bits in VP8X (bits 3 and 2 respectively) when those chunks are stripped.
    const vp8x = chunks.find((c) => c.id === "VP8X");
    if (vp8x && ops.stripAll) {
      // Bit positions per spec: I=0, L=1, E=2(EXIF), X=3(XMP), A=4(animation), reserved=5, R=6,7. Bits in byte 0 of payload.
      const newData = new Uint8Array(vp8x.data);
      newData[0] &= ~0b00001100; // clear EXIF (bit 3) and XMP (bit 2) per WebP container spec
      vp8x.data = newData;
    }
    const out = buildRiff("WEBP", chunks);
    return new Blob([out], { type: "image/webp" });
  },
};

function fmtAny(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(fmtAny).join(", ");
  if (typeof v === "object") {
    try { return JSON.stringify(v).slice(0, 200); }
    catch (_) { return String(v); }
  }
  return String(v);
}

// ─── WAV — read via mm-browser; strip via RIFF walker ──────────────────
const WavHandler = {
  label: FORMAT_LABEL.wav,
  caps: { read: true, edit: false, strip: true, custom: false },
  customHint: "WAV supports strip-all (drops LIST/INFO and embedded ID3 chunks).",

  async read(file) {
    const groups = [];
    try {
      const mm = await ensureMM();
      const meta = await mm.parseBlob(file);
      const fields = [];
      for (const [k, v] of Object.entries(meta.common || {})) {
        if (v == null || (Array.isArray(v) && !v.length)) continue;
        if (typeof v === "object" && !Array.isArray(v)) continue;
        fields.push(field("WAV metadata", k, Array.isArray(v) ? v.join(", ") : String(v), {
          editable: false,
          recommended: isRecommended("wav", k),
        }));
      }
      if (fields.length) groups.push({ name: "WAV metadata", fields });
    } catch (_) {}

    const bytes = await fileBytes(file);
    const chunkFields = [];
    for (const c of iterRiffChunks(bytes)) {
      chunkFields.push(field("RIFF chunks", c.id, `${c.size} bytes`, { editable: false, meta: { chunkId: c.id } }));
    }
    if (chunkFields.length) groups.push({ name: "RIFF chunks", fields: chunkFields });

    return { groups, raw: { bytes } };
  },

  async write(file, ops, raw) {
    const bytes = raw?.bytes || (await fileBytes(file));
    if (!ops.stripAll) return new Blob([bytes], { type: "audio/wav" });
    const chunks = [];
    for (const c of iterRiffChunks(bytes)) {
      if (c.id === "LIST" || c.id === "ID3 " || c.id === "id3 " || c.id === "bext") continue;
      chunks.push({ id: c.id, data: c.data });
    }
    return new Blob([buildRiff("WAVE", chunks)], { type: "audio/wav" });
  },
};

// ─── read-only handlers (HEIC / TIFF / GIF / MP4 / FLAC / OGG) ─────────
function makeReadOnlyImage(label, fmtKey, mime) {
  return {
    label,
    caps: { read: true, edit: false, strip: false, custom: false },
    customHint: "This format is read-only in the browser today.",
    async read(file) {
      const exifr = await ensureExifr();
      const groups = [];
      try {
        const data = await exifr.parse(file, true);
        if (data) {
          const fields = [];
          for (const [k, v] of Object.entries(data)) {
            if (v == null) continue;
            fields.push(field("Metadata", k, fmtAny(v), {
              editable: false,
              recommended: isRecommended(fmtKey, k),
            }));
          }
          if (fields.length) groups.push({ name: "Metadata", fields });
        }
      } catch (e) {
        groups.push({ name: "Metadata", fields: [field("Metadata", "(parse error)", e.message || String(e))] });
      }
      return { groups, raw: {} };
    },
    async write(file) {
      return new Blob([await file.arrayBuffer()], { type: mime });
    },
  };
}
function makeReadOnlyAudio(label, fmtKey, mime) {
  return {
    label,
    caps: { read: true, edit: false, strip: false, custom: false },
    customHint: "This audio format is read-only in the browser today.",
    async read(file) {
      const mm = await ensureMM();
      const meta = await mm.parseBlob(file);
      const groups = [];
      const fields = [];
      for (const [k, v] of Object.entries(meta.common || {})) {
        if (v == null || (Array.isArray(v) && !v.length)) continue;
        if (typeof v === "object" && !Array.isArray(v)) {
          if (k === "picture") {
            fields.push(field("Common", "picture", `${v.length || 1} image(s) embedded`, { editable: false }));
          }
          continue;
        }
        fields.push(field("Common", k, Array.isArray(v) ? v.join(", ") : String(v), {
          editable: false,
          recommended: isRecommended(fmtKey, k),
        }));
      }
      if (fields.length) groups.push({ name: "Common", fields });
      for (const fmtName of Object.keys(meta.native || {})) {
        const nativeFields = [];
        for (const item of meta.native[fmtName] || []) {
          const value = typeof item.value === "object" ? JSON.stringify(item.value).slice(0, 200) : String(item.value || "");
          nativeFields.push(field(`Native · ${fmtName}`, item.id, value, {
            editable: false,
            recommended: isRecommended(fmtKey, item.id),
          }));
        }
        if (nativeFields.length) groups.push({ name: `Native · ${fmtName}`, fields: nativeFields });
      }
      const fmtFields = [];
      if (meta.format) {
        for (const [k, v] of Object.entries(meta.format)) {
          if (v == null) continue;
          fmtFields.push(field("Format", k, Array.isArray(v) ? v.join(", ") : String(v), { editable: false }));
        }
      }
      if (fmtFields.length) groups.push({ name: "Format", fields: fmtFields });
      return { groups, raw: {} };
    },
    async write(file) {
      return new Blob([await file.arrayBuffer()], { type: mime });
    },
  };
}

const HeicHandler = makeReadOnlyImage(FORMAT_LABEL.heic, "heic", "image/heic");
const TiffHandler = makeReadOnlyImage(FORMAT_LABEL.tiff, "tiff", "image/tiff");
const GifHandler = makeReadOnlyImage(FORMAT_LABEL.gif, "gif", "image/gif");
const FlacHandler = makeReadOnlyAudio(FORMAT_LABEL.flac, "flac", "audio/flac");
const OggHandler = makeReadOnlyAudio(FORMAT_LABEL.ogg, "ogg", "audio/ogg");
const Mp4Handler = makeReadOnlyAudio(FORMAT_LABEL.mp4, "mp4", "video/mp4");

// ─── Unknown / fallback ────────────────────────────────────────────────
const UnknownHandler = {
  label: FORMAT_LABEL.unknown,
  caps: { read: true, edit: false, strip: false, custom: false },
  customHint: "",
  async read(file) {
    const bytes = await fileBytes(file);
    const head = bytes.subarray(0, 32);
    const hex = Array.from(head).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = Array.from(head).map((b) => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : ".").join("");
    return {
      groups: [{ name: "File", fields: [
        field("File", "size", fmtBytes(bytes.length)),
        field("File", "mime (browser)", file.type || "(none)"),
        field("File", "first 32 bytes (hex)", hex),
        field("File", "first 32 bytes (ascii)", ascii),
      ]}],
      raw: {},
    };
  },
  async write(file) {
    return new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
  },
};

// ─── handler registry ──────────────────────────────────────────────────
const HANDLERS = {
  jpeg: JpegHandler, png: PngHandler, gif: GifHandler, webp: WebpHandler,
  tiff: TiffHandler, heic: HeicHandler, svg: SvgHandler, pdf: PdfHandler,
  docx: DocxHandler, xlsx: XlsxHandler, pptx: PptxHandler,
  zip: ZipHandler, mp3: Mp3Handler, wav: WavHandler,
  flac: FlacHandler, ogg: OggHandler, mp4: Mp4Handler,
  xml: UnknownHandler, unknown: UnknownHandler,
};

// ─── UI state ──────────────────────────────────────────────────────────
const state = {
  file: null,
  format: null,
  handler: null,
  groups: [],
  raw: null,
  edits: new Map(),     // key: field obj → new string value
  stripKeys: new Set(), // Set of field objs flagged for strip
  customFields: [],     // [{key, value}]
};

function resetState() {
  state.file = null;
  state.format = null;
  state.handler = null;
  state.groups = [];
  state.raw = null;
  state.edits = new Map();
  state.stripKeys = new Set();
  state.customFields = [];
  metaBodyEl.innerHTML = "";
  resultsPanelEl.classList.add("is-hidden");
  actionPanelEl.classList.add("is-hidden");
  capsRowEl.classList.add("is-hidden");
  fileMetaEl.classList.add("is-hidden");
  customAddEl.classList.add("is-hidden");
  engineTagEl.textContent = "no file";
}

// ─── render ────────────────────────────────────────────────────────────
function renderCapChip(handler) {
  const c = handler.caps;
  capChipEl.classList.remove("is-readonly", "is-unknown");
  if (handler === UnknownHandler) {
    capChipEl.classList.add("is-unknown");
    capChipEl.textContent = "Unknown format";
    return;
  }
  if (c.edit && c.strip) { capChipEl.textContent = "Read + Edit + Strip"; return; }
  if (c.strip) { capChipEl.classList.add("is-readonly"); capChipEl.textContent = "Read + Strip"; return; }
  capChipEl.classList.add("is-readonly");
  capChipEl.textContent = "Read only";
}

function renderResults() {
  metaBodyEl.innerHTML = "";

  // Build a stable list with recommended fields first per group.
  const groups = state.groups;
  if (!groups.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.innerHTML = '<div class="empty-state">No editable metadata found in this file.</div>';
    tr.appendChild(td);
    metaBodyEl.appendChild(tr);
  }

  for (const g of groups) {
    const head = document.createElement("tr");
    head.className = "group-head";
    const headCell = document.createElement("td");
    headCell.colSpan = 3;
    headCell.textContent = g.name;
    head.appendChild(headCell);
    metaBodyEl.appendChild(head);

    // sort: recommended first
    const sorted = [...g.fields].sort((a, b) => Number(b.recommended) - Number(a.recommended));

    for (const f of sorted) {
      const tr = document.createElement("tr");
      if (f.recommended) tr.classList.add("row-recommended");
      if (state.stripKeys.has(f)) tr.classList.add("row-stripped");

      const keyTd = document.createElement("td");
      keyTd.className = "col-key";
      keyTd.textContent = f.key;
      tr.appendChild(keyTd);

      const valTd = document.createElement("td");
      valTd.className = "col-val";
      if (f.editable) {
        const input = document.createElement("input");
        input.type = "text";
        input.value = state.edits.has(f) ? state.edits.get(f) : f.value;
        input.addEventListener("input", () => {
          state.edits.set(f, input.value);
          updatePendingCount();
        });
        valTd.appendChild(input);
      } else {
        valTd.textContent = f.value;
      }
      tr.appendChild(valTd);

      const stripTd = document.createElement("td");
      stripTd.className = "col-strip";
      if (f.editable || state.handler.caps.strip) {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = state.stripKeys.has(f);
        cb.title = "Strip this field on download";
        cb.addEventListener("change", () => {
          if (cb.checked) state.stripKeys.add(f);
          else state.stripKeys.delete(f);
          tr.classList.toggle("row-stripped", cb.checked);
          updatePendingCount();
        });
        stripTd.appendChild(cb);
      }
      tr.appendChild(stripTd);

      metaBodyEl.appendChild(tr);
    }
  }

  // Custom fields rendering as a synthetic group at the end.
  if (state.customFields.length) {
    const head = document.createElement("tr");
    head.className = "group-head";
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "Custom (pending)";
    head.appendChild(cell);
    metaBodyEl.appendChild(head);

    for (let i = 0; i < state.customFields.length; i++) {
      const cf = state.customFields[i];
      const tr = document.createElement("tr");
      const k = document.createElement("td"); k.className = "col-key"; k.textContent = cf.key;
      const v = document.createElement("td"); v.className = "col-val"; v.textContent = cf.value;
      const x = document.createElement("td"); x.className = "col-strip";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--ghost btn--copy";
      btn.textContent = "remove";
      btn.addEventListener("click", () => {
        state.customFields.splice(i, 1);
        renderResults();
        updatePendingCount();
      });
      x.appendChild(btn);
      tr.appendChild(k); tr.appendChild(v); tr.appendChild(x);
      metaBodyEl.appendChild(tr);
    }
  }
}

function updatePendingCount() {
  const edits = state.edits.size;
  const strips = state.stripKeys.size;
  const customs = state.customFields.length;
  const total = edits + strips + customs;
  if (!total) {
    pendingCountEl.textContent = "no changes yet";
    btnApply.disabled = !state.handler?.caps?.edit && !state.handler?.caps?.strip;
  } else {
    const parts = [];
    if (edits) parts.push(`${edits} edit${edits !== 1 ? "s" : ""}`);
    if (strips) parts.push(`${strips} strip${strips !== 1 ? "s" : ""}`);
    if (customs) parts.push(`${customs} custom`);
    pendingCountEl.textContent = parts.join(" · ");
    btnApply.disabled = false;
  }
}

// ─── orchestration ─────────────────────────────────────────────────────
async function onFile(file) {
  if (!file) return;
  resetState();
  state.file = file;
  clearStatus();

  $("#m-name").textContent = file.name || "(unnamed)";
  $("#m-size").textContent = fmtBytes(file.size);
  $("#m-type").textContent = file.type || "(none)";
  $("#m-detect").textContent = "detecting…";
  fileMetaEl.classList.remove("is-hidden");
  engineTagEl.textContent = "detecting…";

  let fmt;
  try {
    fmt = await detectFormat(file);
  } catch (e) {
    fmt = "unknown";
  }

  state.format = fmt;
  state.handler = HANDLERS[fmt] || UnknownHandler;
  $("#m-detect").textContent = state.handler.label;
  capsRowEl.classList.remove("is-hidden");
  renderCapChip(state.handler);
  engineTagEl.textContent = `format: ${fmt}`;

  try {
    engineTagEl.textContent = `format: ${fmt} · reading…`;
    const result = await state.handler.read(file);
    state.groups = result.groups || [];
    state.raw = result.raw || {};
    engineTagEl.textContent = `format: ${fmt} · ready`;
  } catch (e) {
    setStatus("error", "Could not read metadata: " + (e.message || e));
    engineTagEl.textContent = `format: ${fmt} · error`;
    return;
  }

  resultsPanelEl.classList.remove("is-hidden");
  actionPanelEl.classList.remove("is-hidden");
  if (state.handler.caps.custom) {
    customAddEl.classList.remove("is-hidden");
    customHintEl.textContent = state.handler.customHint || "";
  }

  btnApply.disabled = !(state.handler.caps.edit || state.handler.caps.strip);
  btnStripAll.disabled = !state.handler.caps.strip;

  renderResults();
  updatePendingCount();
}

async function onApply() {
  if (!state.file || !state.handler) return;
  btnApply.disabled = true;
  setStatus("info", "Writing…");
  try {
    const ops = {
      edits: state.edits,
      stripKeys: state.stripKeys,
      customFields: state.customFields,
      stripAll: false,
    };
    const blob = await state.handler.write(state.file, ops, state.raw);
    const fname = cleanName(state.file, "_clean", state.handler.fileExt);
    downloadBlob(blob, fname);
    setStatus("info", `Downloaded ${fname} (${fmtBytes(blob.size)}).`);
  } catch (e) {
    setStatus("error", "Failed to write: " + (e.message || e));
  } finally {
    btnApply.disabled = false;
  }
}

async function onStripAll() {
  if (!state.file || !state.handler || !state.handler.caps.strip) return;
  btnStripAll.disabled = true;
  setStatus("info", "Stripping all metadata…");
  try {
    const ops = {
      edits: new Map(),
      stripKeys: new Set(),
      customFields: [],
      stripAll: true,
    };
    const blob = await state.handler.write(state.file, ops, state.raw);
    const fname = cleanName(state.file, "_stripped", state.handler.fileExt);
    downloadBlob(blob, fname);
    setStatus("info", `Downloaded ${fname} (${fmtBytes(blob.size)}). All metadata removed.`);
  } catch (e) {
    setStatus("error", "Strip failed: " + (e.message || e));
  } finally {
    btnStripAll.disabled = false;
  }
}

function onResetEdits() {
  state.edits.clear();
  state.stripKeys.clear();
  state.customFields = [];
  renderResults();
  updatePendingCount();
  clearStatus();
}
function onNewFile() {
  resetState();
  clearStatus();
  fileEl.value = "";
}

function onAddCustom() {
  const key = customKeyEl.value.trim();
  const val = customValueEl.value;
  if (!key) {
    setStatus("warn", "Enter a key for the custom field.");
    return;
  }
  state.customFields.push({ key, value: val });
  customKeyEl.value = "";
  customValueEl.value = "";
  renderResults();
  updatePendingCount();
  clearStatus();
}

// ─── wiring ────────────────────────────────────────────────────────────
dropEl.addEventListener("click", () => fileEl.click());
dropEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileEl.click();
  }
});
["dragenter", "dragover"].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => {
    e.preventDefault();
    dropEl.classList.add("is-hover");
  }),
);
["dragleave"].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => {
    e.preventDefault();
    dropEl.classList.remove("is-hover");
  }),
);
dropEl.addEventListener("drop", (e) => {
  e.preventDefault();
  dropEl.classList.remove("is-hover");
  const f = e.dataTransfer?.files?.[0];
  if (f) onFile(f);
});
fileEl.addEventListener("change", () => {
  const f = fileEl.files?.[0];
  if (f) onFile(f);
});

btnApply.addEventListener("click", onApply);
btnStripAll.addEventListener("click", onStripAll);
btnReset.addEventListener("click", onResetEdits);
btnNew.addEventListener("click", onNewFile);
btnAddCustom.addEventListener("click", onAddCustom);
customValueEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); onAddCustom(); }
});
