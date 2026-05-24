/* File → Markdown conversion for the Markdown Preview tool.

   Self-contained ES module: detects a dropped file's type and converts it
   to Markdown. Heavy parser libraries lazy-load from jsDelivr only when a
   matching file is imported, so the tool's first-paint budget is untouched.

   Pipelines:
     html        → Turndown
     csv / tsv   → native parser → GFM table
     json        → pretty-printed ```json fence
     txt / md    → passed through as-is
     docx        → mammoth (→ HTML) → Turndown
     xlsx        → SheetJS → per-sheet GFM tables
     pdf         → pdf.js text extraction (text only, lossy)
     pptx        → JSZip + DOMParser slide text (text only, lossy) */

// ─── pinned CDN versions ───────────────────────────────────────────────
// SRI for the publisher-static UMD scripts; ESM (pdf.js) is import()-loaded
// without SRI, matching the repo precedent (metadata-studio). The turndown
// builds use the non-minified dist/*.js originals — jsDelivr's on-the-fly
// *.min.js are flagged "do not use SRI" because their hash can change.
const CDN = {
  turndown:    { src: "https://cdn.jsdelivr.net/npm/turndown@7.2.4/dist/turndown.js",
                 sri: "sha384-VRHmZZ8b5mH5yknWcg48OJS6RmXZmlgvsqhOXJqY0rwvwirs1M12xd+49c3NpW6a" },
  turndownGfm: { src: "https://cdn.jsdelivr.net/npm/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js",
                 sri: "sha384-2TroN1N6OfLQ+K4qttptnIfMREzUlMa3hW/nZqDZXv7Sm9BkESfGEupDEqCbzyRl" },
  mammoth:     { src: "https://cdn.jsdelivr.net/npm/mammoth@1.12.0/mammoth.browser.min.js",
                 sri: "sha384-fWLn06AIo00H32MDcWUZTT+4Ru3OuoYn1DRH0o6JkhDl89YFSF4tJ4odze9bI+4r" },
  xlsx:        { src: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
                 sri: "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw" },
  jszip:       { src: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
                 sri: "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG" },
  pdfjsEsm:    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs",
  pdfjsWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs",
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

function loadModule(src) {
  if (libCache.has(src)) return libCache.get(src);
  const p = import(/* @vite-ignore */ src);
  libCache.set(src, p);
  return p;
}

// new Worker() rejects a cross-origin CDN URL directly; wrap it in a
// same-origin module-worker blob that imports the real worker (jsDelivr
// sends CORS so its own relative imports resolve). Same trick as the
// Video Studio tool.
function workerBlobURL(srcURL) {
  const shim = `import ${JSON.stringify(srcURL)};`;
  return URL.createObjectURL(new Blob([shim], { type: "text/javascript" }));
}

async function ensureTurndown() {
  if (window.TurndownService && window.turndownPluginGfm) return;
  await loadScript(CDN.turndown);
  await loadScript(CDN.turndownGfm);
}
async function ensureMammoth() {
  if (window.mammoth) return window.mammoth;
  await loadScript(CDN.mammoth);
  return window.mammoth;
}
async function ensureXLSX() {
  if (window.XLSX) return window.XLSX;
  await loadScript(CDN.xlsx);
  return window.XLSX;
}
async function ensureJSZip() {
  if (window.JSZip) return window.JSZip;
  await loadScript(CDN.jszip);
  return window.JSZip;
}
let pdfjsPromise = null;
function ensurePdfjs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    const pdfjs = await loadModule(CDN.pdfjsEsm);
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = workerBlobURL(CDN.pdfjsWorker);
    } catch (_) {
      // leave workerSrc unset; pdf.js falls back to a main-thread fake worker
    }
    return pdfjs;
  })();
  return pdfjsPromise;
}

function makeTurndown() {
  const td = new window.TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });
  td.use(window.turndownPluginGfm.gfm); // tables + strikethrough + task lists
  return td;
}

// ─── limits ────────────────────────────────────────────────────────────
const WARN_LIMIT = 25 * 1024 * 1024;
const HARD_LIMIT = 100 * 1024 * 1024;
const MAX_TABLE_ROWS = 5000;

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

// ─── format detection ──────────────────────────────────────────────────
const EXT_KIND = {
  html: "html", htm: "html", xhtml: "html",
  csv: "csv", tsv: "csv",
  json: "json",
  txt: "txt", text: "txt", log: "txt", md: "txt", markdown: "txt",
  docx: "docx", xlsx: "xlsx", pdf: "pdf", pptx: "pptx",
};

async function detectKind(file) {
  const ext = (file.name.match(/\.([^.\s]+)\s*$/)?.[1] || "").toLowerCase();
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const h = (i) => head[i];

  // %PDF-
  if (h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46) return "pdf";

  // ZIP container (PK\x03\x04 / PK\x05\x06) → OOXML disambiguation by peeking
  // for the format's marker file (authoritative; extension can lie).
  if (h(0) === 0x50 && h(1) === 0x4b && (h(2) === 0x03 || h(2) === 0x05) && (h(3) === 0x04 || h(3) === 0x06)) {
    try {
      const JSZip = await ensureJSZip();
      const zip = await JSZip.loadAsync(file);
      if (zip.file("word/document.xml")) return "docx";
      if (zip.file("xl/workbook.xml")) return "xlsx";
      if (zip.file("ppt/presentation.xml")) return "pptx";
    } catch (_) {
      /* not a readable zip */
    }
    if (["docx", "xlsx", "pptx"].includes(EXT_KIND[ext])) return EXT_KIND[ext];
    return "unsupported";
  }

  // Known text extension wins outright.
  if (EXT_KIND[ext]) return EXT_KIND[ext];

  // No/unknown extension → sniff a leading slice.
  const sniff = (await file.slice(0, 4096).text()).trim();
  if ([...sniff].some((ch) => ch.charCodeAt(0) < 9)) return "unsupported"; // control byte = binary file
  if (/^<(!doctype|html|[a-z!])/i.test(sniff)) return "html";
  if (sniff.startsWith("{") || sniff.startsWith("[")) {
    try {
      JSON.parse(await file.text());
      return "json";
    } catch (_) {
      /* not JSON */
    }
  }
  if (sniff) return "txt";
  return "unsupported";
}

// ─── table helpers (shared by CSV and XLSX) ────────────────────────────
function parseDelimited(text, delim) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function aoaToMdTable(rows, warnings) {
  rows = rows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  if (!rows.length) return "";
  if (rows.length > MAX_TABLE_ROWS) {
    if (warnings) warnings.push(`Table truncated to ${MAX_TABLE_ROWS} rows.`);
    rows = rows.slice(0, MAX_TABLE_ROWS);
  }
  const cols = Math.max(...rows.map((r) => r.length));
  const esc = (c) => String(c ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  const pad = (r) => { const a = r.slice(); while (a.length < cols) a.push(""); return a; };
  const head = `| ${pad(rows[0]).map(esc).join(" | ")} |`;
  const sep = `| ${Array(cols).fill("---").join(" | ")} |`;
  const body = rows.slice(1).map((r) => `| ${pad(r).map(esc).join(" | ")} |`).join("\n");
  return body ? `${head}\n${sep}\n${body}` : `${head}\n${sep}`;
}

// ─── per-format converters ─────────────────────────────────────────────
async function convertHtml(file) {
  await ensureTurndown();
  return makeTurndown().turndown(await file.text());
}

async function convertCsv(file, warnings) {
  const delim = /\.tsv$/i.test(file.name) ? "\t" : ",";
  return aoaToMdTable(parseDelimited(await file.text(), delim), warnings);
}

function convertJson(text, warnings) {
  try {
    return "```json\n" + JSON.stringify(JSON.parse(text), null, 2) + "\n```";
  } catch (_) {
    warnings.push("Not valid JSON — imported as a plain code block.");
    return "```\n" + text + "\n```";
  }
}

async function convertDocx(file, warnings) {
  const mammoth = await ensureMammoth();
  await ensureTurndown();
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  if (result.messages && result.messages.length) {
    warnings.push(`${result.messages.length} formatting note(s) from the document were skipped.`);
  }
  return makeTurndown().turndown(result.value || "");
}

async function convertXlsx(file, warnings) {
  const XLSX = await ensureXLSX();
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const parts = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) continue; // empty sheet
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
    const table = aoaToMdTable(aoa, warnings);
    if (table) parts.push(`## ${name}\n\n${table}`);
  }
  if (!parts.length) {
    warnings.push("No tabular data found in the workbook.");
    return "";
  }
  return parts.join("\n\n");
}

async function convertPdf(file, warnings) {
  const pdfjs = await ensurePdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (e) {
    const msg = (e && (e.name + " " + e.message)) || "";
    if (/password/i.test(msg)) throw new Error("This PDF is password-protected — text can't be extracted.");
    throw new Error("Couldn't read this PDF (it may be corrupt or unsupported).");
  }
  const parts = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = [];
    let line = "", lastY = null;
    for (const it of tc.items) {
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += it.str + (it.hasEOL ? "\n" : " ");
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    parts.push(`## Page ${p}\n\n${text || "_(no extractable text)_"}`);
  }
  const out = parts.join("\n\n");
  if (!/[A-Za-z0-9]/.test(out.replace(/## Page \d+/g, ""))) {
    warnings.push("No selectable text found — the PDF may be scanned images.");
  }
  return out;
}

function slideNum(name) {
  return parseInt(name.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
}

async function convertPptx(file, warnings) {
  const JSZip = await ensureJSZip();
  const zip = await JSZip.loadAsync(file);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNum(a) - slideNum(b));
  if (!slides.length) {
    warnings.push("No slides found in the presentation.");
    return "";
  }
  const parser = new DOMParser();
  const parts = [];
  for (let i = 0; i < slides.length; i++) {
    const xml = await zip.file(slides[i]).async("string");
    const doc = parser.parseFromString(xml, "application/xml");
    const lines = [];
    for (const p of Array.from(doc.getElementsByTagName("a:p"))) {
      const text = Array.from(p.getElementsByTagName("a:t"))
        .map((n) => n.textContent)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push(text);
    }
    const body = lines.length ? lines.join("\n\n") : "_(no text on this slide)_";
    parts.push(`## Slide ${i + 1}\n\n${body}`);
  }
  return parts.join("\n\n");
}

// ─── public API ────────────────────────────────────────────────────────
export async function convertFileToMarkdown(file, { onProgress } = {}) {
  if (file.size > HARD_LIMIT) {
    throw new Error(`File is too large (${fmtSize(file.size)}). The limit is ${fmtSize(HARD_LIMIT)}.`);
  }
  const warnings = [];
  if (file.size > WARN_LIMIT) warnings.push(`Large file (${fmtSize(file.size)}) — this may take a moment.`);
  const note = (m) => { if (onProgress) onProgress(m); };

  note("Detecting format…");
  const kind = await detectKind(file);
  let markdown = "";
  switch (kind) {
    case "html": note("Converting HTML…"); markdown = await convertHtml(file); break;
    case "csv": note("Converting CSV…"); markdown = await convertCsv(file, warnings); break;
    case "json": note("Converting JSON…"); markdown = convertJson(await file.text(), warnings); break;
    case "txt": note("Reading text…"); markdown = await file.text(); break;
    case "docx": note("Converting Word document (loading converter)…"); markdown = await convertDocx(file, warnings); break;
    case "xlsx": note("Converting spreadsheet (loading converter)…"); markdown = await convertXlsx(file, warnings); break;
    case "pdf": note("Extracting PDF text (loading engine)…"); markdown = await convertPdf(file, warnings); break;
    case "pptx": note("Extracting slide text…"); markdown = await convertPptx(file, warnings); break;
    default:
      throw new Error("Unsupported file type. Supported: HTML, CSV, JSON, TXT, DOCX, XLSX, PDF, PPTX.");
  }
  return { markdown, kind, warnings };
}
