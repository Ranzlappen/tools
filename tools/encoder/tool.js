/* Multi-Encoder — UTF-8 safe round-trips between plaintext, base64, hex,
   URL, binary, and ASCII. Editing any field updates every other field. */

const $ = (s) => document.querySelector(s);
const plain = $("#enc-plain");
const b64 = $("#enc-b64");
const hex = $("#enc-hex");
const url = $("#enc-url");
const bin = $("#enc-bin");
const asc = $("#enc-asc");

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

let updating = false;

// ---------- helpers ----------

function bytesToB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(str) {
  const clean = str.replace(/\s+/g, "");
  const raw = atob(clean);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(str) {
  const clean = str.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2 !== 0) throw new Error("Hex length must be even");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
function bytesToBin(bytes) {
  return Array.from(bytes, (b) => b.toString(2).padStart(8, "0")).join(" ");
}
function binToBytes(str) {
  const tokens = str.trim().split(/\s+/).filter(Boolean);
  return new Uint8Array(tokens.map((t) => {
    if (!/^[01]+$/.test(t)) throw new Error("Non-binary token: " + t);
    return parseInt(t, 2);
  }));
}
function bytesToAsc(bytes) {
  return Array.from(bytes, (b) => b.toString()).join(" ");
}
function ascToBytes(str) {
  const tokens = str.trim().split(/\s+/).filter(Boolean);
  return new Uint8Array(tokens.map((t) => {
    const n = parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0 || n > 255) throw new Error("Out-of-range byte: " + t);
    return n;
  }));
}

// ---------- distribute ----------

function fromPlain(text) {
  const bytes = enc.encode(text);
  b64.value = bytesToB64(bytes);
  hex.value = bytesToHex(bytes);
  url.value = encodeURIComponent(text);
  bin.value = bytesToBin(bytes);
  asc.value = bytesToAsc(bytes);
}

function setPlainFromBytes(bytes) {
  plain.value = dec.decode(bytes);
  // Also refresh every OTHER field besides the one being edited.
  b64.value = bytesToB64(bytes);
  hex.value = bytesToHex(bytes);
  url.value = encodeURIComponent(plain.value);
  bin.value = bytesToBin(bytes);
  asc.value = bytesToAsc(bytes);
}

function wire(el, parse) {
  el.addEventListener("input", () => {
    if (updating) return;
    updating = true;
    try {
      const bytes = parse(el.value);
      // Don't re-write the field the user is editing.
      const userVal = el.value;
      setPlainFromBytes(bytes);
      el.value = userVal;
    } catch {
      // Bad input — leave other fields alone.
    } finally {
      updating = false;
    }
  });
}

plain.addEventListener("input", () => {
  if (updating) return;
  updating = true;
  fromPlain(plain.value);
  updating = false;
});

wire(b64, (s) => b64ToBytes(s));
wire(hex, (s) => hexToBytes(s));
wire(url, (s) => enc.encode(decodeURIComponent(s)));
wire(bin, (s) => binToBytes(s));
wire(asc, (s) => ascToBytes(s));

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "sample") {
    plain.value = "héllo 🌍";
    fromPlain(plain.value);
  } else if (btn.dataset.action === "clear") {
    [plain, b64, hex, url, bin, asc].forEach((el) => (el.value = ""));
    plain.focus();
  }
});

plain.value = "Hello, ranzlappen!";
fromPlain(plain.value);
