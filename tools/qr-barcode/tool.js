/* QR & Barcode Generator
 *
 * Two engines:
 *   - qr-code-styling (UMD global: QRCodeStyling) for the `qr` symbology
 *     — gives gradient fills, dot/rounded/classy shapes, logo overlay.
 *   - bwip-js (UMD global: bwipjs) for every other symbology
 *     — 1D, 2D, GS1, postal, pharmacode, etc. ~100 types.
 *
 * Exports go through:
 *   - qr-code-styling's own SVG/PNG/JPG getRawData() for the QR symbology
 *   - bwipjs.toSVG / toCanvas → blob URL for everything else
 *   - jsPDF for PDF
 *   - navigator.clipboard.write for clipboard
 *   - navigator.share for the Share API
 */

const $ = (s) => document.querySelector(s);

// ---------- symbology registry ----------
// `bwip` is the bwip-js symbology id. Sentinel `'qr-fancy'` routes to
// qr-code-styling instead of bwip-js. `group` is the optgroup label,
// `is2D` controls whether the design panel is visible, `requires` is
// a human-readable hint about input constraints.

const SYMBOLOGIES = [
  // QR & 2D
  { id: "qr-fancy",     label: "QR Code",                  group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "qrcode", requires: "Any text up to ~2,953 bytes (ECC L)." },
  { id: "datamatrix",   label: "Data Matrix",              group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "datamatrix", requires: "Any text up to 2,335 alphanumeric chars." },
  { id: "datamatrixrectangular", label: "Data Matrix (rectangular)", group: "QR & 2D", is2D: true, badge: "2D",
    bwip: "datamatrixrectangular", requires: "Same as Data Matrix; rectangular form factors." },
  { id: "azteccode",    label: "Aztec Code",               group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "azteccode", requires: "Any text. ECC 5–95% configurable." },
  { id: "azteccodecompact", label: "Aztec Code (compact)", group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "azteccodecompact", requires: "Compact Aztec for small payloads." },
  { id: "pdf417",       label: "PDF417",                   group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "pdf417", requires: "Up to ~1,800 alphanumeric chars." },
  { id: "pdf417compact",label: "PDF417 (compact)",         group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "pdf417compact", requires: "Truncated PDF417 for narrow labels." },
  { id: "micropdf417",  label: "MicroPDF417",              group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "micropdf417", requires: "Small PDF417 variant for limited space." },
  { id: "microqrcode",  label: "Micro QR Code",            group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "microqrcode", requires: "Up to 35 numeric chars; smaller than QR." },
  { id: "maxicode",     label: "MaxiCode",                 group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "maxicode", requires: "UPS shipping label format. 93 chars max." },
  { id: "hanxin",       label: "Han Xin Code",             group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "hanxin", requires: "Chinese national 2D standard. UTF-8 friendly." },
  { id: "codeone",      label: "Code One",                 group: "QR & 2D",    is2D: true,  badge: "2D",
    bwip: "codeone", requires: "Industrial 2D matrix code." },

  // Retail / EAN
  { id: "ean13",        label: "EAN-13",                   group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "ean13", requires: "Exactly 12 digits (check digit auto-added)." },
  { id: "ean8",         label: "EAN-8",                    group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "ean8", requires: "Exactly 7 digits (check digit auto-added)." },
  { id: "ean5",         label: "EAN-5 supplement",         group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "ean5", requires: "Exactly 5 digits. Supplemental code." },
  { id: "ean2",         label: "EAN-2 supplement",         group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "ean2", requires: "Exactly 2 digits. Supplemental code." },
  { id: "upca",         label: "UPC-A",                    group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "upca", requires: "Exactly 11 digits (check digit auto-added)." },
  { id: "upce",         label: "UPC-E",                    group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "upce", requires: "6 digits. Compact UPC variant." },
  { id: "isbn",         label: "ISBN",                     group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "isbn", requires: "ISBN-13 (12 digits + auto checksum)." },
  { id: "ismn",         label: "ISMN",                     group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "ismn", requires: "Music publication number." },
  { id: "issn",         label: "ISSN",                     group: "Retail (EAN/UPC)", is2D: false, badge: "1D",
    bwip: "issn", requires: "Serial publication number." },

  // Industrial
  { id: "code128",      label: "Code 128",                 group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "code128", requires: "Any ASCII. Most common shipping barcode." },
  { id: "code39",       label: "Code 39",                  group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "code39", requires: "A–Z, 0–9, and -.$/+%*. Industrial standard." },
  { id: "code39ext",    label: "Code 39 (extended)",       group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "code39ext", requires: "Full ASCII via shift encoding." },
  { id: "code93",       label: "Code 93",                  group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "code93", requires: "A–Z, 0–9, symbols. Denser than Code 39." },
  { id: "code93ext",    label: "Code 93 (extended)",       group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "code93ext", requires: "Full ASCII via shift encoding." },
  { id: "code11",       label: "Code 11",                  group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "code11", requires: "0–9 and dash. Telecom equipment." },
  { id: "codabar",      label: "Codabar",                  group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "rationalizedCodabar", requires: "0–9 and -$:/.+. Library / blood bank." },
  { id: "interleaved2of5", label: "Interleaved 2 of 5 (ITF)", group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "interleaved2of5", requires: "Even number of digits." },
  { id: "itf14",        label: "ITF-14",                   group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "itf14", requires: "Exactly 13 digits. Shipping cartons." },
  { id: "msi",          label: "MSI Plessey",              group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "msi", requires: "0–9. Inventory / shelf marking." },
  { id: "plessey",      label: "Plessey",                  group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "plessey", requires: "0–9 and A–F. Library shelving." },
  { id: "telepen",      label: "Telepen",                  group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "telepen", requires: "Full ASCII. UK libraries." },
  { id: "channelcode",  label: "Channel Code",             group: "Industrial 1D", is2D: false, badge: "1D",
    bwip: "channelcode", requires: "Up to 7-digit numeric. High density." },

  // Pharmacode
  { id: "pharmacode",   label: "Pharmacode (One-track)",   group: "Pharmaceutical", is2D: false, badge: "1D",
    bwip: "pharmacode", requires: "Integer 3 to 131,070." },
  { id: "pharmacode2",  label: "Pharmacode (Two-track)",   group: "Pharmaceutical", is2D: false, badge: "1D",
    bwip: "pharmacode2", requires: "Integer 4 to 64,570." },
  { id: "code32",       label: "Code 32 (Italian pharma)", group: "Pharmaceutical", is2D: false, badge: "1D",
    bwip: "code32", requires: "Italian pharmaceutical code." },
  { id: "pzn",          label: "PZN (German pharma)",      group: "Pharmaceutical", is2D: false, badge: "1D",
    bwip: "pzn", requires: "PZN-8 (7 digits + check digit)." },
  { id: "hibccode128",  label: "HIBC Code 128",            group: "Pharmaceutical", is2D: false, badge: "1D",
    bwip: "hibccode128", requires: "Healthcare barcode standard." },
  { id: "hibcdatamatrix", label: "HIBC Data Matrix",       group: "Pharmaceutical", is2D: true, badge: "2D",
    bwip: "hibcdatamatrix", requires: "HIBC payload in Data Matrix." },

  // GS1
  { id: "gs1-128",      label: "GS1-128",                  group: "GS1",            is2D: false, badge: "1D",
    bwip: "gs1-128", requires: "GS1 Application Identifiers. e.g. (01)07614141000012" },
  { id: "gs1datamatrix",label: "GS1 Data Matrix",          group: "GS1",            is2D: true,  badge: "2D",
    bwip: "gs1datamatrix", requires: "GS1 AI payload in Data Matrix." },
  { id: "gs1qrcode",    label: "GS1 QR Code",              group: "GS1",            is2D: true,  badge: "2D",
    bwip: "gs1qrcode", requires: "GS1 AI payload in QR." },
  { id: "databarexpanded", label: "GS1 DataBar Expanded",  group: "GS1",            is2D: false, badge: "1D",
    bwip: "databarexpanded", requires: "GS1 AI compressed payload." },
  { id: "databaromni",  label: "GS1 DataBar Omnidirectional", group: "GS1",        is2D: false, badge: "1D",
    bwip: "databaromni", requires: "14-digit GTIN." },
  { id: "databarstacked", label: "GS1 DataBar Stacked",    group: "GS1",            is2D: false, badge: "1D",
    bwip: "databarstacked", requires: "14-digit GTIN, stacked." },
  { id: "databarlimited", label: "GS1 DataBar Limited",    group: "GS1",            is2D: false, badge: "1D",
    bwip: "databarlimited", requires: "14-digit GTIN, smaller form." },

  // Postal
  { id: "auspost",      label: "Australia Post 4-state",   group: "Postal",         is2D: false, badge: "1D",
    bwip: "auspost", requires: "Australia Post Customer Barcode." },
  { id: "japanpost",    label: "Japan Post 4-state",       group: "Postal",         is2D: false, badge: "1D",
    bwip: "japanpost", requires: "Japan Post Customer Barcode." },
  { id: "kix",          label: "Royal Mail KIX",           group: "Postal",         is2D: false, badge: "1D",
    bwip: "kix", requires: "Netherlands KIX / Royal Mail RM4SCC." },
  { id: "royalmail",    label: "Royal Mail 4-state (RM4SCC)", group: "Postal",      is2D: false, badge: "1D",
    bwip: "royalmail", requires: "UK Royal Mail customer barcode." },
  { id: "onecode",      label: "USPS Intelligent Mail",    group: "Postal",         is2D: false, badge: "1D",
    bwip: "onecode", requires: "20–31 digit USPS payload." },
  { id: "postnet",      label: "USPS POSTNET",             group: "Postal",         is2D: false, badge: "1D",
    bwip: "postnet", requires: "5, 9, or 11 digit ZIP." },
  { id: "planet",       label: "USPS PLANET",              group: "Postal",         is2D: false, badge: "1D",
    bwip: "planet", requires: "USPS PLANET tracking code." },
  { id: "identcode",    label: "Deutsche Post Identcode",  group: "Postal",         is2D: false, badge: "1D",
    bwip: "identcode", requires: "11 digits." },
  { id: "leitcode",     label: "Deutsche Post Leitcode",   group: "Postal",         is2D: false, badge: "1D",
    bwip: "leitcode", requires: "13 digits." },

  // Other niche
  { id: "ultracode",    label: "Ultracode (colour)",       group: "Other",          is2D: true,  badge: "2D",
    bwip: "ultracode", requires: "Colour 2D matrix." },
  { id: "dotcode",      label: "DotCode",                  group: "Other",          is2D: true,  badge: "2D",
    bwip: "dotcode", requires: "High-speed printing 2D code." },
  { id: "raw",          label: "Raw bit pattern",          group: "Other",          is2D: false, badge: "1D",
    bwip: "raw", requires: "Custom bit pattern as bars." },
];

// ---------- presets (QR/2D content templates) ----------

const PRESETS = {
  text: {
    label: "Text",
    fields: [{ id: "text", type: "textarea", label: "Text", placeholder: "Any text", value: "https://tools.ranzlappen.com" }],
    format: (v) => v.text,
  },
  url: {
    label: "URL",
    fields: [{ id: "url", type: "text", label: "URL", placeholder: "https://example.com", value: "https://tools.ranzlappen.com" }],
    format: (v) => {
      let u = (v.url || "").trim();
      if (!u) return "";
      if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(u)) u = "https://" + u;
      return u;
    },
  },
  wifi: {
    label: "WiFi",
    fields: [
      { id: "ssid", type: "text", label: "Network name (SSID)", placeholder: "MyNetwork", value: "" },
      { id: "auth", type: "select", label: "Security", value: "WPA",
        options: [["WPA", "WPA / WPA2"], ["WEP", "WEP"], ["nopass", "Open (no password)"]] },
      { id: "pass", type: "text", label: "Password", placeholder: "(leave blank for open)", value: "" },
      { id: "hidden", type: "checkbox", label: "Hidden network", value: false },
    ],
    format: (v) => {
      const esc = (s) => String(s || "").replace(/([\\;,":])/g, "\\$1");
      const parts = [`T:${v.auth || "nopass"}`, `S:${esc(v.ssid)}`];
      if (v.auth !== "nopass") parts.push(`P:${esc(v.pass)}`);
      if (v.hidden) parts.push("H:true");
      return `WIFI:${parts.join(";")};;`;
    },
  },
  vcard: {
    label: "vCard",
    fields: [
      { id: "name",  type: "text", label: "Full name", placeholder: "Ada Lovelace", value: "" },
      { id: "org",   type: "text", label: "Organization", placeholder: "Analytical Engine Co.", value: "" },
      { id: "title", type: "text", label: "Title", placeholder: "Mathematician", value: "" },
      { id: "tel",   type: "text", label: "Phone", placeholder: "+1 555 0100", value: "" },
      { id: "email", type: "text", label: "Email", placeholder: "ada@example.com", value: "" },
      { id: "url",   type: "text", label: "Website", placeholder: "https://example.com", value: "" },
    ],
    format: (v) => {
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      if (v.name)  lines.push(`FN:${v.name}`);
      if (v.org)   lines.push(`ORG:${v.org}`);
      if (v.title) lines.push(`TITLE:${v.title}`);
      if (v.tel)   lines.push(`TEL:${v.tel}`);
      if (v.email) lines.push(`EMAIL:${v.email}`);
      if (v.url)   lines.push(`URL:${v.url}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    },
  },
  sms: {
    label: "SMS",
    fields: [
      { id: "number", type: "text", label: "Phone", placeholder: "+15550100", value: "" },
      { id: "body",   type: "textarea", label: "Message", placeholder: "Hello!", value: "" },
    ],
    format: (v) => `SMSTO:${v.number || ""}:${v.body || ""}`,
  },
  email: {
    label: "Email",
    fields: [
      { id: "to",      type: "text",     label: "To",      placeholder: "ada@example.com", value: "" },
      { id: "subject", type: "text",     label: "Subject", placeholder: "Hello",            value: "" },
      { id: "body",    type: "textarea", label: "Body",    placeholder: "…",                value: "" },
    ],
    format: (v) => {
      if (!v.to) return "";
      const q = new URLSearchParams();
      if (v.subject) q.set("subject", v.subject);
      if (v.body)    q.set("body", v.body);
      const qs = q.toString();
      return `mailto:${v.to}${qs ? "?" + qs : ""}`;
    },
  },
  geo: {
    label: "Geo",
    fields: [
      { id: "lat", type: "text", label: "Latitude",  placeholder: "37.7749",   value: "" },
      { id: "lon", type: "text", label: "Longitude", placeholder: "-122.4194", value: "" },
      { id: "q",   type: "text", label: "Label (optional)", placeholder: "Office", value: "" },
    ],
    format: (v) => {
      if (!v.lat || !v.lon) return "";
      const base = `geo:${v.lat},${v.lon}`;
      return v.q ? `${base}?q=${encodeURIComponent(v.q)}` : base;
    },
  },
  event: {
    label: "Event",
    fields: [
      { id: "summary",   type: "text",     label: "Title", placeholder: "Coffee with Ada", value: "" },
      { id: "location",  type: "text",     label: "Location", placeholder: "Café",       value: "" },
      { id: "dtstart",   type: "datetime-local", label: "Start", value: "" },
      { id: "dtend",     type: "datetime-local", label: "End",   value: "" },
      { id: "description", type: "textarea", label: "Description", placeholder: "…",     value: "" },
    ],
    format: (v) => {
      const fmt = (s) => {
        if (!s) return "";
        const d = new Date(s);
        if (isNaN(+d)) return "";
        // YYYYMMDDTHHmmssZ (UTC)
        return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      };
      const lines = ["BEGIN:VEVENT"];
      if (v.summary)     lines.push(`SUMMARY:${v.summary}`);
      if (v.location)    lines.push(`LOCATION:${v.location}`);
      const s = fmt(v.dtstart);
      const e = fmt(v.dtend);
      if (s) lines.push(`DTSTART:${s}`);
      if (e) lines.push(`DTEND:${e}`);
      if (v.description) lines.push(`DESCRIPTION:${v.description.replace(/\n/g, "\\n")}`);
      lines.push("END:VEVENT");
      return lines.join("\n");
    },
  },
};

// ---------- state ----------

const state = {
  symId: "qr-fancy",
  preset: "url",
  presetValues: {},   // per-preset { fieldId: value }
  payload: "https://tools.ranzlappen.com",
  payloadDirty: false, // user typed in the payload box directly?
  // size/ecc
  modSize: 8,
  quietZone: 4,
  qrEcc: "Q",
  pdf417Ecc: 3,
  aztecEcc: 23,
  hri: true,
  // design
  fgColor: "#0b1210",
  bgColor: "#ffffff",
  dotsStyle: "square",
  eyeStyle: "square",
  eyeInnerStyle: "square",
  gradOn: false,
  gradStop: "#22c55e",
  logoDataUrl: null,
};

// ---------- DOM refs ----------
const symSelect = $("#sym-select");
const symSearch = $("#sym-search");
const symBadge = $("#sym-badge");
const symDescription = $("#sym-description");
const presetTabs = $("#preset-tabs");
const presetFields = $("#preset-fields");
const payloadEl = $("#payload");
const contentHint = $("#content-hint");
const eccControls = $("#ecc-controls");
const designPanel = $("#design-panel");
const previewEl = $("#preview");
const previewInfo = $("#preview-info");
const libErrorEl = $("#lib-error");
const libErrorText = $("#lib-error-text");

// ---------- helpers ----------

function getSymbology() {
  return SYMBOLOGIES.find((s) => s.id === state.symId);
}

function setLibError(message) {
  if (message) {
    libErrorEl.classList.remove("is-hidden");
    libErrorText.textContent = message;
  } else {
    libErrorEl.classList.add("is-hidden");
  }
}

function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function sanitizeFilename(s) {
  return (s || "")
    .toString()
    .slice(0, 24)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "untitled";
}

function currentFilenameStem() {
  const sym = getSymbology();
  const slug = sanitizeFilename(state.payload || "");
  return `${sym.id}-${slug}`;
}

// ---------- symbology select population ----------

function buildSymbologySelect(filter = "") {
  const q = filter.trim().toLowerCase();
  const grouped = {};
  for (const s of SYMBOLOGIES) {
    if (q && !s.label.toLowerCase().includes(q) && !s.id.includes(q)) continue;
    (grouped[s.group] ||= []).push(s);
  }
  symSelect.innerHTML = "";
  for (const [group, items] of Object.entries(grouped)) {
    const og = document.createElement("optgroup");
    og.label = group;
    for (const s of items) {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.label;
      og.appendChild(o);
    }
    symSelect.appendChild(og);
  }
  // If current symId isn't in the filtered list, switch to the first.
  if (![...symSelect.querySelectorAll("option")].some((o) => o.value === state.symId)) {
    const first = symSelect.querySelector("option");
    if (first) state.symId = first.value;
  }
  symSelect.value = state.symId;
  syncSymbologyUI();
}

function syncSymbologyUI() {
  const s = getSymbology();
  if (!s) return;
  symBadge.textContent = s.badge;
  symDescription.textContent = s.requires;

  // Show/hide preset tabs — only for QR / 2D where structured payloads matter
  const showPresets = s.is2D;
  presetTabs.parentElement.style.display = ""; // panel always visible

  // Toggle design panel — only meaningful for QR (fancy styling)
  designPanel.style.display = s.id === "qr-fancy" ? "" : "none";

  // Rebuild ECC controls per symbology
  buildEccControls(s);
  rebuildPresetTabs(s);
  if (!state.payloadDirty) applyPresetToPayload();
}

// ---------- preset tabs + fields ----------

function rebuildPresetTabs(sym) {
  presetTabs.innerHTML = "";
  // Only QR family + GS1 QR / GS1 Data Matrix get the full preset set
  const fullPresets = (sym.id === "qr-fancy" || sym.id === "gs1qrcode");
  const visible = fullPresets
    ? Object.keys(PRESETS)
    : ["text", "url"];
  for (const key of visible) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset-tab";
    btn.dataset.preset = key;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-pressed", state.preset === key ? "true" : "false");
    btn.textContent = PRESETS[key].label;
    presetTabs.appendChild(btn);
  }
  if (!visible.includes(state.preset)) state.preset = visible[0];
  buildPresetFields();
}

function buildPresetFields() {
  const preset = PRESETS[state.preset];
  presetFields.innerHTML = "";
  if (!preset) return;
  presetFields.className = "form-grid";

  for (const f of preset.fields) {
    const wrap = document.createElement("div");
    if (f.type === "textarea") wrap.classList.add("full");
    const lab = document.createElement("label");
    lab.className = "field-label";
    lab.textContent = f.label;
    lab.htmlFor = `pf-${f.id}`;
    wrap.appendChild(lab);

    const stored = state.presetValues[state.preset]?.[f.id];

    let el;
    if (f.type === "textarea") {
      el = document.createElement("textarea");
      el.className = "textarea";
      el.style.minHeight = "80px";
      el.placeholder = f.placeholder || "";
      el.value = stored !== undefined ? stored : (f.value || "");
    } else if (f.type === "select") {
      el = document.createElement("select");
      el.className = "input input--single";
      for (const [val, label] of f.options) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        el.appendChild(opt);
      }
      el.value = stored !== undefined ? stored : (f.value || f.options[0][0]);
    } else if (f.type === "checkbox") {
      el = document.createElement("input");
      el.type = "checkbox";
      el.checked = stored !== undefined ? stored : !!f.value;
      lab.style.cursor = "pointer";
      lab.style.display = "flex";
      lab.style.alignItems = "center";
      lab.style.gap = "8px";
      lab.textContent = "";
      lab.appendChild(el);
      lab.appendChild(document.createTextNode(" " + f.label));
      // For checkbox layout we put the label content inline; don't append separately.
      el = null;
    } else {
      el = document.createElement("input");
      el.type = f.type || "text";
      el.className = "input input--single";
      el.placeholder = f.placeholder || "";
      el.value = stored !== undefined ? stored : (f.value || "");
    }
    if (el) {
      el.id = `pf-${f.id}`;
      el.dataset.field = f.id;
      wrap.appendChild(el);
    } else {
      // Checkbox path: rewire the input that lives inside the label
      const cb = lab.querySelector('input[type="checkbox"]');
      if (cb) {
        cb.id = `pf-${f.id}`;
        cb.dataset.field = f.id;
      }
    }
    presetFields.appendChild(wrap);
  }
}

function collectPresetValues() {
  const v = {};
  for (const el of presetFields.querySelectorAll("[data-field]")) {
    if (el.type === "checkbox") v[el.dataset.field] = el.checked;
    else v[el.dataset.field] = el.value;
  }
  return v;
}

function applyPresetToPayload() {
  const preset = PRESETS[state.preset];
  if (!preset) return;
  const v = collectPresetValues();
  state.presetValues[state.preset] = v;
  const out = preset.format(v);
  state.payload = out;
  state.payloadDirty = false;
  payloadEl.value = out;
}

// ---------- ECC + size controls ----------

function buildEccControls(sym) {
  eccControls.innerHTML = "";

  if (sym.id === "qr-fancy" || sym.id === "qrcode" || sym.id === "gs1qrcode") {
    const wrap = document.createElement("div");
    wrap.className = "full";
    wrap.innerHTML = `
      <label class="field-label">Error correction</label>
      <div class="chips" role="radiogroup" aria-label="QR error correction">
        ${["L", "M", "Q", "H"].map((l) => `
          <button class="chip" data-qr-ecc="${l}" aria-pressed="${state.qrEcc === l}">
            ${l} · ${({L:"7%",M:"15%",Q:"25%",H:"30%"})[l]}
          </button>
        `).join("")}
      </div>`;
    eccControls.appendChild(wrap);
  } else if (sym.id === "pdf417" || sym.id === "pdf417compact" || sym.id === "micropdf417") {
    const wrap = document.createElement("div");
    wrap.className = "full";
    wrap.innerHTML = `
      <label for="pdf-ecc" class="field-label">PDF417 ECC level (0–8)</label>
      <div class="range-row">
        <input id="pdf-ecc" type="range" min="0" max="8" step="1" value="${state.pdf417Ecc}" />
        <span class="val" id="pdf-ecc-val">${state.pdf417Ecc}</span>
      </div>`;
    eccControls.appendChild(wrap);
  } else if (sym.id === "azteccode" || sym.id === "azteccodecompact") {
    const wrap = document.createElement("div");
    wrap.className = "full";
    wrap.innerHTML = `
      <label for="aztec-ecc" class="field-label">Aztec ECC (% redundancy)</label>
      <div class="range-row">
        <input id="aztec-ecc" type="range" min="5" max="95" step="5" value="${state.aztecEcc}" />
        <span class="val" id="aztec-ecc-val">${state.aztecEcc}%</span>
      </div>`;
    eccControls.appendChild(wrap);
  } else {
    const wrap = document.createElement("div");
    wrap.className = "full muted tiny";
    wrap.textContent = sym.is2D
      ? "Reed-Solomon error correction is automatic for this symbology."
      : "1D barcode: optional check digit handled per the symbology spec.";
    eccControls.appendChild(wrap);
  }
}

// ---------- engines ----------

let qrInstance = null;

function libsReady() {
  return typeof window.bwipjs !== "undefined" && typeof window.QRCodeStyling !== "undefined";
}

async function renderQrFancy() {
  // (Re)create the QR styling instance with current state.
  const opts = {
    width: 360,
    height: 360,
    data: state.payload || " ",
    margin: state.quietZone * 2,
    qrOptions: { errorCorrectionLevel: state.qrEcc },
    dotsOptions: {
      color: state.fgColor,
      type: state.dotsStyle,
    },
    backgroundOptions: { color: state.bgColor },
    cornersSquareOptions: { type: state.eyeStyle, color: state.fgColor },
    cornersDotOptions:    { type: state.eyeInnerStyle, color: state.fgColor },
  };
  if (state.gradOn) {
    opts.dotsOptions.gradient = {
      type: "linear",
      rotation: Math.PI / 4,
      colorStops: [
        { offset: 0, color: state.fgColor },
        { offset: 1, color: state.gradStop },
      ],
    };
  }
  if (state.logoDataUrl) {
    opts.image = state.logoDataUrl;
    opts.imageOptions = { crossOrigin: "anonymous", margin: 4, imageSize: 0.28 };
    // Boost ECC to Q if it was L/M (logo carves out modules).
    if (state.qrEcc === "L" || state.qrEcc === "M") {
      opts.qrOptions.errorCorrectionLevel = "Q";
    }
  }

  qrInstance = new window.QRCodeStyling(opts);
  previewEl.innerHTML = "";
  qrInstance.append(previewEl);
  previewInfo.textContent = `QR · ECC ${opts.qrOptions.errorCorrectionLevel} · ${opts.width}×${opts.height} px`;
}

async function renderBwip() {
  qrInstance = null;
  const sym = getSymbology();
  const canvas = document.createElement("canvas");
  const opts = {
    bcid: sym.bwip,
    text: state.payload || " ",
    scale: state.modSize,
    padding: state.quietZone * 2,
    includetext: state.hri && !sym.is2D,
    textxalign: "center",
    backgroundcolor: state.bgColor.replace("#", ""),
    barcolor: state.fgColor.replace("#", ""),
  };
  // Symbology-specific ECC routing
  if (sym.id === "pdf417" || sym.id === "pdf417compact" || sym.id === "micropdf417") {
    opts.eclevel = state.pdf417Ecc;
  } else if (sym.id === "azteccode" || sym.id === "azteccodecompact") {
    opts.eclevel = state.aztecEcc;
  }

  try {
    window.bwipjs.toCanvas(canvas, opts);
  } catch (err) {
    previewEl.innerHTML = `<div class="banner banner--error" style="margin:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg><span>${(err && err.message) || err}</span></div>`;
    previewInfo.textContent = "Error";
    return;
  }
  previewEl.innerHTML = "";
  previewEl.appendChild(canvas);
  previewInfo.textContent = `${sym.label} · ${canvas.width}×${canvas.height} px`;
}

const render = debounce(async function () {
  if (!libsReady()) {
    setLibError("Rendering libraries failed to load. Check your network / SRI; reload the page to retry.");
    return;
  }
  setLibError(null);
  const sym = getSymbology();
  if (sym.id === "qr-fancy") {
    await renderQrFancy();
  } else {
    await renderBwip();
  }
}, 80);

// ---------- exports ----------

async function getQrBlob(kind) {
  // kind: "svg" | "png" | "jpeg"
  return qrInstance.getRawData(kind);
}

async function getBwipSvgString() {
  const sym = getSymbology();
  return window.bwipjs.toSVG({
    bcid: sym.bwip,
    text: state.payload || " ",
    scale: state.modSize,
    padding: state.quietZone * 2,
    includetext: state.hri && !sym.is2D,
    textxalign: "center",
    backgroundcolor: state.bgColor.replace("#", ""),
    barcolor: state.fgColor.replace("#", ""),
    ...(sym.id.startsWith("pdf417") && { eclevel: state.pdf417Ecc }),
    ...(sym.id.startsWith("aztec")  && { eclevel: state.aztecEcc }),
  });
}

function previewCanvas() {
  return previewEl.querySelector("canvas");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

async function rasterScale(srcCanvas, multiplier) {
  const c = document.createElement("canvas");
  c.width = srcCanvas.width * multiplier;
  c.height = srcCanvas.height * multiplier;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, 0, 0, c.width, c.height);
  return c;
}

async function getPreviewCanvasFromAnything(multiplier = 1) {
  const sym = getSymbology();
  if (sym.id === "qr-fancy" && qrInstance) {
    // qr-code-styling has its own canvas via getRawData(png)
    const blob = await qrInstance.getRawData("png");
    const img = await blobToImage(blob);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth * multiplier;
    c.height = img.naturalHeight * multiplier;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  const src = previewCanvas();
  if (!src) throw new Error("No rendered output to export.");
  return multiplier === 1 ? src : rasterScale(src, multiplier);
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
    img.onerror = (e) => { reject(e); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

async function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function exportSVG() {
  const sym = getSymbology();
  let blob;
  if (sym.id === "qr-fancy" && qrInstance) {
    blob = await qrInstance.getRawData("svg");
    if (typeof blob === "string") blob = new Blob([blob], { type: "image/svg+xml" });
  } else {
    const svg = await getBwipSvgString();
    blob = new Blob([svg], { type: "image/svg+xml" });
  }
  downloadBlob(blob, `${currentFilenameStem()}.svg`);
}

async function exportPNG(mult) {
  const canvas = await getPreviewCanvasFromAnything(mult);
  const blob = await canvasToBlob(canvas, "image/png");
  downloadBlob(blob, `${currentFilenameStem()}@${mult}x.png`);
}

async function exportJPG() {
  // Flatten onto a white background since JPEG has no alpha.
  const canvas = await getPreviewCanvasFromAnything(2);
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d");
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  const blob = await canvasToBlob(flat, "image/jpeg", 0.92);
  downloadBlob(blob, `${currentFilenameStem()}.jpg`);
}

async function exportPDF() {
  if (typeof window.jspdf === "undefined") {
    setLibError("PDF export library failed to load.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const canvas = await getPreviewCanvasFromAnything(2);
  const png = canvas.toDataURL("image/png");

  // Fit the barcode on an A4 portrait page with a small margin and label.
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - 24;
  const aspect = canvas.width / canvas.height;
  let drawW = maxW;
  let drawH = drawW / aspect;
  if (drawH > maxH) { drawH = maxH; drawW = drawH * aspect; }
  const x = (pageW - drawW) / 2;
  const y = margin;
  pdf.addImage(png, "PNG", x, y, drawW, drawH);
  // Caption: symbology + payload preview
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  const sym = getSymbology();
  pdf.text(`${sym.label} · ${(state.payload || "").slice(0, 80)}`, pageW / 2, y + drawH + 8, { align: "center" });
  pdf.save(`${currentFilenameStem()}.pdf`);
}

async function exportCopy() {
  const canvas = await getPreviewCanvasFromAnything(2);
  const blob = await canvasToBlob(canvas, "image/png");
  if (!navigator.clipboard || !window.ClipboardItem) {
    setLibError("Clipboard API not available in this browser.");
    return;
  }
  try {
    await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
    setLibError(null);
    previewInfo.textContent = "Copied to clipboard ✓";
    setTimeout(render, 1200);
  } catch (e) {
    setLibError("Clipboard write failed: " + e.message);
  }
}

async function exportShare() {
  if (!navigator.share || !navigator.canShare) {
    setLibError("Web Share API not available in this browser.");
    return;
  }
  const canvas = await getPreviewCanvasFromAnything(2);
  const blob = await canvasToBlob(canvas, "image/png");
  const file = new File([blob], `${currentFilenameStem()}.png`, { type: "image/png" });
  if (!navigator.canShare({ files: [file] })) {
    setLibError("This browser can't share image files.");
    return;
  }
  try {
    await navigator.share({ files: [file], title: getSymbology().label, text: state.payload });
    setLibError(null);
  } catch (e) {
    if (e && e.name !== "AbortError") setLibError("Share failed: " + e.message);
  }
}

// ---------- event wiring ----------

symSearch.addEventListener("input", (e) => buildSymbologySelect(e.target.value));
symSelect.addEventListener("change", (e) => {
  state.symId = e.target.value;
  state.payloadDirty = false; // Re-derive from preset on symbology change
  syncSymbologyUI();
  render();
});

presetTabs.addEventListener("click", (e) => {
  const tab = e.target.closest("[data-preset]");
  if (!tab) return;
  state.preset = tab.dataset.preset;
  presetTabs.querySelectorAll(".preset-tab").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.preset === state.preset ? "true" : "false")
  );
  buildPresetFields();
  applyPresetToPayload();
  render();
});

presetFields.addEventListener("input", () => {
  applyPresetToPayload();
  render();
});

payloadEl.addEventListener("input", (e) => {
  state.payload = e.target.value;
  state.payloadDirty = true;
  render();
});

eccControls.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-qr-ecc]");
  if (chip) {
    state.qrEcc = chip.dataset.qrEcc;
    eccControls.querySelectorAll("[data-qr-ecc]").forEach((c) =>
      c.setAttribute("aria-pressed", c.dataset.qrEcc === state.qrEcc ? "true" : "false")
    );
    render();
  }
});

eccControls.addEventListener("input", (e) => {
  if (e.target.id === "pdf-ecc") {
    state.pdf417Ecc = parseInt(e.target.value, 10);
    document.getElementById("pdf-ecc-val").textContent = state.pdf417Ecc;
    render();
  } else if (e.target.id === "aztec-ecc") {
    state.aztecEcc = parseInt(e.target.value, 10);
    document.getElementById("aztec-ecc-val").textContent = state.aztecEcc + "%";
    render();
  }
});

$("#mod-size").addEventListener("input", (e) => {
  state.modSize = parseInt(e.target.value, 10);
  $("#mod-size-val").textContent = state.modSize;
  render();
});
$("#quiet-zone").addEventListener("input", (e) => {
  state.quietZone = parseInt(e.target.value, 10);
  $("#quiet-zone-val").textContent = state.quietZone;
  render();
});
$("#hri-on").addEventListener("change", (e) => {
  state.hri = e.target.checked;
  render();
});

// Design panel (QR only)
const wireSwatch = (colorId, hexId, stateKey) => {
  const color = $(colorId), hex = $(hexId);
  color.addEventListener("input", () => {
    state[stateKey] = color.value;
    hex.value = color.value;
    render();
  });
  hex.addEventListener("input", () => {
    const v = hex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      state[stateKey] = v;
      color.value = v;
      render();
    }
  });
};
wireSwatch("#fg-color", "#fg-hex", "fgColor");
wireSwatch("#bg-color", "#bg-hex", "bgColor");

$("#dots-style").addEventListener("change", (e) => { state.dotsStyle = e.target.value; render(); });
$("#eye-style").addEventListener("change", (e) => { state.eyeStyle = e.target.value; render(); });
$("#eye-inner-style").addEventListener("change", (e) => { state.eyeInnerStyle = e.target.value; render(); });
$("#grad-on").addEventListener("change", (e) => { state.gradOn = e.target.checked; render(); });
$("#grad-stop").addEventListener("input", (e) => { state.gradStop = e.target.value; render(); });

$("#logo-file").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { state.logoDataUrl = reader.result; render(); };
  reader.readAsDataURL(f);
});

document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]");
  if (a && a.dataset.action === "logo-clear") {
    state.logoDataUrl = null;
    const f = $("#logo-file");
    if (f) f.value = "";
    render();
  }
  const x = e.target.closest("[data-export]");
  if (!x) return;
  const k = x.dataset.export;
  if (k === "svg") exportSVG();
  else if (k === "png-1") exportPNG(1);
  else if (k === "png-2") exportPNG(2);
  else if (k === "png-4") exportPNG(4);
  else if (k === "jpg") exportJPG();
  else if (k === "pdf") exportPDF();
  else if (k === "copy") exportCopy();
  else if (k === "share") exportShare();
});

// ---------- boot ----------

function boot() {
  buildSymbologySelect();
  if (!libsReady()) {
    // The CDN scripts use `defer` so they may not be ready on DOMContentLoaded.
    // Poll briefly.
    setLibError("Loading rendering libraries…");
    const start = Date.now();
    const tick = () => {
      if (libsReady()) { setLibError(null); render(); return; }
      if (Date.now() - start > 8000) {
        setLibError("Rendering libraries failed to load within 8s. Check network / SRI.");
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  } else {
    render();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
