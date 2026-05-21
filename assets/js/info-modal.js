/* Info Modal — shared component used by every /tools/<slug>/ page.
   Fetches the tool's README.md, renders it via marked + DOMPurify in a
   native <dialog>. Both deps are lazy-loaded on first open so the
   first-paint budget is unaffected. */

const MARKED_SRC = "https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js";
const MARKED_SRI = "sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi";
const PURIFY_SRC = "https://cdn.jsdelivr.net/npm/dompurify@3.0.11/dist/purify.min.js";
const PURIFY_SRI = "sha384-Ic7KEGROu37YaruU6NyiYeib7UhjFyDZQ5fzBAji965L75T/4LGk5nzwMEjNGexs";

let dialog = null;
let bodyEl = null;
let depsPromise = null;
const renderCache = new Map();

function loadScript(src, integrity) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.integrity = integrity;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

function ensureDeps() {
  if (window.marked && window.DOMPurify) return Promise.resolve();
  if (depsPromise) return depsPromise;
  const tasks = [];
  if (!window.marked) tasks.push(loadScript(MARKED_SRC, MARKED_SRI));
  if (!window.DOMPurify) tasks.push(loadScript(PURIFY_SRC, PURIFY_SRI));
  depsPromise = Promise.all(tasks).then(() => undefined);
  return depsPromise;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "info-modal";
  dialog.innerHTML =
    '<button type="button" class="info-modal__close" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    '</button>' +
    '<div class="info-modal__body" tabindex="-1"></div>';
  bodyEl = dialog.querySelector(".info-modal__body");
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.querySelector(".info-modal__close").addEventListener("click", () => dialog.close());
  document.body.appendChild(dialog);
  return dialog;
}

async function openModal(src) {
  ensureDialog();
  if (renderCache.has(src)) {
    bodyEl.innerHTML = renderCache.get(src);
    dialog.showModal();
    bodyEl.scrollTop = 0;
    return;
  }
  bodyEl.innerHTML = '<p class="info-modal__loading">Loading…</p>';
  dialog.showModal();
  try {
    const [md] = await Promise.all([
      fetch(src, { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      }),
      ensureDeps(),
    ]);
    if (!window.marked || !window.DOMPurify) {
      throw new Error("Renderer libraries failed to load.");
    }
    window.marked.setOptions({ gfm: true, breaks: false });
    const raw = window.marked.parse(md);
    const clean = window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    renderCache.set(src, clean);
    bodyEl.innerHTML = clean;
    bodyEl.scrollTop = 0;
  } catch (e) {
    let plain = "";
    try {
      plain = await fetch(src).then((r) => r.text());
    } catch {}
    bodyEl.innerHTML =
      '<p class="info-modal__error">Could not render the help page (' +
      escapeHtml(e.message) + '). Showing plain text below.</p>' +
      (plain ? '<pre>' + escapeHtml(plain) + '</pre>' : '');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-info-button]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.dataset.infoSrc || "./README.md";
      openModal(src);
    });
  });
});
