/* Markdown Preview — uses marked + DOMPurify (CDN-loaded with SRI). */

const $ = (s) => document.querySelector(s);
const inEl = $("#md-in");
const outEl = $("#md-out");

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

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "copy-html") {
    if (!outEl.innerHTML) return;
    navigator.clipboard.writeText(outEl.innerHTML).then(() => {
      btn.textContent = "Copied ✓";
      setTimeout(() => (btn.textContent = "Copy HTML"), 1200);
    });
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
