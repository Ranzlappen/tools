/* Markdown Preview — uses marked + DOMPurify (CDN-loaded with SRI).
   File import converts dropped files to Markdown via ./convert.js. */

import { convertFileToMarkdown } from "./convert.js";

const $ = (s) => document.querySelector(s);
const inEl = $("#md-in");
const outEl = $("#md-out");
const dropEl = $("#drop");
const fileEl = $("#md-file");
const statusEl = $("#status");
const statusTextEl = $("#status-text");

const SAMPLE = `# Hello, world

A small **markdown** preview tool. Type on the left, see HTML on the right.

## Features

- Live preview
- GitHub-Flavored Markdown
- HTML sanitised with [DOMPurify](https://github.com/cure53/DOMPurify)

## Code

\`\`\`js
const greet = (name) => \`Hello, \${name}!\`;
greet("world");
\`\`\`

## Tables

| Tool        | Where it runs    |
| ----------- | ---------------- |
| Static ones | GitHub Pages     |
| Heavier     | Vercel functions |

> "Make small things, make them work, ship them."

- [x] write a sample
- [ ] do something with it
`;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function render() {
  if (typeof window.marked === "undefined" || typeof window.DOMPurify === "undefined") {
    outEl.innerHTML =
      `<pre style="white-space:pre-wrap;">${escapeHtml(inEl.value)}</pre>` +
      `<p style="color:var(--c-warning); font-size:.85rem; margin-top:1em;">` +
      `Renderer libraries failed to load. Showing plain text as a safety fallback.</p>`;
    return;
  }
  window.marked.setOptions({ gfm: true, breaks: false });
  const rawHtml = window.marked.parse(inEl.value || "");
  outEl.innerHTML = window.DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
}

let t = 0;
inEl.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(render, 80);
});

// ─── file import → Markdown ────────────────────────────────────────────
function setStatus(kind, msg) {
  statusEl.classList.remove("banner--info", "banner--warn", "banner--error", "is-hidden");
  statusEl.classList.add("banner--" + kind);
  statusTextEl.textContent = msg;
}
function safeBlobUrl(url) {
  try { return new URL(url).protocol === "blob:" ? url : ""; }
  catch (_) { return ""; }
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

async function onFile(file) {
  setStatus("info", `Converting ${file.name}…`);
  try {
    const { markdown, kind, warnings } = await convertFileToMarkdown(file, {
      onProgress: (m) => setStatus("info", m),
    });
    inEl.value = markdown;
    render();
    if (warnings.length) {
      setStatus("warn", `Imported ${file.name} as ${kind} — ${warnings.join(" ")}`);
    } else {
      setStatus("info", `Imported ${file.name} as Markdown (${kind}).`);
    }
  } catch (e) {
    setStatus("error", "Import failed: " + (e.message || e));
  } finally {
    fileEl.value = ""; // allow re-importing the same file
  }
}

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
dropEl.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dropEl.classList.remove("is-hover");
});
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

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "copy-html") {
    if (!outEl.innerHTML) return;
    navigator.clipboard?.writeText(outEl.innerHTML)?.then(() => {
      btn.textContent = "Copied ✓";
      setTimeout(() => (btn.textContent = "Copy HTML"), 1200);
    });
  } else if (btn.dataset.action === "copy-md") {
    if (!inEl.value) return;
    navigator.clipboard?.writeText(inEl.value)?.then(() => {
      btn.textContent = "Copied ✓";
      setTimeout(() => (btn.textContent = "Copy Markdown"), 1200);
    });
  } else if (btn.dataset.action === "download-md") {
    if (!inEl.value) return;
    downloadBlob(new Blob([inEl.value], { type: "text/markdown" }), "document.md");
  } else if (btn.dataset.action === "sample") {
    inEl.value = SAMPLE;
    render();
  } else if (btn.dataset.action === "clear") {
    inEl.value = "";
    render();
    inEl.focus();
  }
});

// Wait for the deferred CDN scripts to actually finish before first render.
window.addEventListener("load", () => {
  inEl.value = SAMPLE;
  render();
});
