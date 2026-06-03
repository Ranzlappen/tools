/* JWT Decoder — header + payload only, signature is NOT verified. */

const $ = (s) => document.querySelector(s);
const inEl = $("#jwt-in");
const headerEl = $("#jwt-header");
const payloadEl = $("#jwt-payload");
const sigEl = $("#jwt-signature");
const expiryEl = $("#jwt-expiry");
const expiryTextEl = $("#jwt-expiry-text");

const TIME_CLAIMS = new Set(["iat", "exp", "nbf", "auth_time"]);

function base64UrlDecode(seg) {
  let s = seg.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const raw = atob(s);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function annotate(obj) {
  // Build a syntax-coloured pretty JSON output. Adds human dates next to
  // time-related claims (iat/exp/nbf/auth_time).
  const pretty = JSON.stringify(obj, null, 2);
  let html = pretty.replace(
    /("(?:\\.|[^"\\])*")\s*:\s*("(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?|true|false|null)/g,
    (m, k, v) => {
      let cls = "num";
      if (v.startsWith('"')) cls = "str";
      else if (v === "true" || v === "false") cls = "bool";
      else if (v === "null") cls = "null";
      let extra = "";
      const key = JSON.parse(k);
      if (TIME_CLAIMS.has(key) && cls === "num") {
        const sec = parseInt(v, 10);
        if (Number.isFinite(sec)) {
          const d = new Date(sec * 1000).toISOString();
          extra = `  <span class="key">// ${escapeHtml(d)}</span>`;
        }
      }
      return `<span class="key">${escapeHtml(k)}</span>: <span class="${cls}">${escapeHtml(v)}</span>${extra}`;
    }
  );
  return html;
}

function clear() {
  headerEl.textContent = "—";
  payloadEl.textContent = "—";
  sigEl.textContent = "—";
  expiryEl.classList.add("is-hidden");
}

function decode() {
  const raw = inEl.value.trim();
  if (!raw) {
    clear();
    return;
  }
  const parts = raw.split(".");
  if (parts.length < 2 || parts.length > 3) {
    clear();
    headerEl.textContent =
      "Not a JWT — expected 2 or 3 dot-separated segments.";
    return;
  }
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    headerEl.innerHTML = annotate(header);
    payloadEl.innerHTML = annotate(payload);
    sigEl.textContent = parts[2] || "(none — unsigned token)";

    if (typeof payload.exp === "number") {
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = payload.exp - nowSec;
      if (remaining < 0) {
        expiryEl.classList.remove("is-hidden", "banner--info");
        expiryEl.classList.add("banner--error");
        expiryTextEl.textContent =
          `Expired ${Math.abs(remaining)}s ago (at ${new Date(payload.exp * 1000).toISOString()}).`;
      } else {
        expiryEl.classList.remove("is-hidden", "banner--error");
        expiryEl.classList.add("banner--info");
        expiryTextEl.textContent =
          `Valid for ${remaining}s more — until ${new Date(payload.exp * 1000).toISOString()}.`;
      }
    } else {
      expiryEl.classList.add("is-hidden");
    }
  } catch (e) {
    headerEl.textContent = "Decode error: " + e.message;
    payloadEl.textContent = "—";
    sigEl.textContent = "—";
    expiryEl.classList.add("is-hidden");
  }
}

inEl.addEventListener("input", decode);

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "sample") {
    // Sample token: header {alg:HS256,typ:JWT}, payload with sub/name/iat/exp
    inEl.value =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImlhdCI6MTcxNTg2NjAwMCwiZXhwIjoxNzE1OTUyNDAwfQ." +
      "TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ";
    decode();
  } else if (btn.dataset.action === "clear") {
    inEl.value = "";
    clear();
    inEl.focus();
  }
});
