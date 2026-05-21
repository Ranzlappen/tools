/* OG Image Studio — composes calls to /api/og on api.tools.ranzlappen.com.
 * State (title, subtitle, theme) round-trips through location.hash so links
 * are shareable. Preview updates are debounced; canonical URL is always
 * unbusted so shared links hit the edge cache. */

const API = "https://api.tools.ranzlappen.com/api/og";
const DEBOUNCE_MS = 300;
const TITLE_MAX = 60;
const SUBTITLE_MAX = 96;
const SAMPLE = {
  title: "JSON Formatter",
  subtitle: "Pretty-print, minify, validate — entirely in the browser.",
  theme: "dark",
};

const $ = (s) => document.querySelector(s);
const titleEl = $("#og-title");
const subtitleEl = $("#og-subtitle");
const titleCount = $("#og-title-count");
const subtitleCount = $("#og-subtitle-count");
const themeChips = document.querySelectorAll(".chip[data-theme]");
const previewImg = $("#og-preview");
const urlEcho = $("#og-url-echo");
const statusEl = $("#og-status");
const statusText = $("#og-status-text");

const state = { title: "", subtitle: "", theme: "dark" };
let debounceTimer = null;
let statusTimer = null;

function readHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const out = {};
  if (params.has("title")) out.title = params.get("title").slice(0, TITLE_MAX);
  if (params.has("subtitle")) out.subtitle = params.get("subtitle").slice(0, SUBTITLE_MAX);
  if (params.has("theme")) {
    const t = params.get("theme");
    if (t === "dark" || t === "light") out.theme = t;
  }
  return out;
}

function initialTheme() {
  try {
    return localStorage.getItem("tools:theme") === "light" ? "light" : "dark";
  } catch (e) {
    return "dark";
  }
}

function buildUrl({ bust = false } = {}) {
  const params = new URLSearchParams();
  if (state.title) params.set("title", state.title);
  if (state.subtitle) params.set("subtitle", state.subtitle);
  if (state.theme && state.theme !== "dark") params.set("theme", state.theme);
  if (bust) params.set("t", String(Date.now()));
  const qs = params.toString();
  return qs ? `${API}?${qs}` : API;
}

function syncHash() {
  // Only stash non-default values so the hash stays short when empty.
  const params = new URLSearchParams();
  if (state.title) params.set("title", state.title);
  if (state.subtitle) params.set("subtitle", state.subtitle);
  if (state.theme && state.theme !== "dark") params.set("theme", state.theme);
  const qs = params.toString();
  const next = qs ? `#${qs}` : "";
  if (next !== location.hash) {
    history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  }
}

function render({ bust = false } = {}) {
  previewImg.src = buildUrl({ bust });
  urlEcho.textContent = buildUrl({ bust: false });
  syncHash();
}

function updateCounter(el, len, max) {
  el.textContent = `${len} / ${max}`;
  el.classList.toggle("is-warn", len >= max - 4);
}

function setChip(theme) {
  themeChips.forEach((c) => {
    c.setAttribute("aria-pressed", c.dataset.theme === theme ? "true" : "false");
  });
}

function showStatus(msg, tone = "info") {
  statusText.textContent = msg;
  statusEl.classList.remove("is-hidden", "banner--info", "banner--warn", "banner--error");
  statusEl.classList.add(tone === "error" ? "banner--error" : tone === "warn" ? "banner--warn" : "banner--info");
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.add("is-hidden"), 2400);
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function downloadPng() {
  const url = buildUrl({ bust: false });
  showStatus("Downloading…");
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    })
    .then((blob) => {
      const objUrl = URL.createObjectURL(blob);
      const slug = state.title ? slugify(state.title) : "";
      const name = slug ? `og-image-${slug}.png` : "og-image.png";
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      showStatus(`Saved ${name}`);
    })
    .catch(() => {
      showStatus("Download blocked (likely CORS). Open the URL in a new tab to save.", "warn");
    });
}

function copyUrl() {
  const url = buildUrl({ bust: false });
  if (!navigator.clipboard) {
    showStatus("Clipboard unavailable — select the URL above to copy.", "warn");
    return;
  }
  navigator.clipboard.writeText(url)
    .then(() => showStatus("URL copied to clipboard"))
    .catch(() => showStatus("Copy failed — select the URL above to copy.", "warn"));
}

function applyState(next, { immediate = false } = {}) {
  Object.assign(state, next);
  titleEl.value = state.title;
  subtitleEl.value = state.subtitle;
  updateCounter(titleCount, state.title.length, TITLE_MAX);
  updateCounter(subtitleCount, state.subtitle.length, SUBTITLE_MAX);
  setChip(state.theme);
  if (immediate) {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    render({ bust: false });
  } else {
    render({ bust: false });
  }
}

// Inputs: debounced re-render with cache-bust, so identical strings during
// edits still trigger an edge re-fetch. Counters update synchronously.
function onTextInput(field, max, counter) {
  return (e) => {
    state[field] = e.target.value.slice(0, max);
    updateCounter(counter, state[field].length, max);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      render({ bust: true });
    }, DEBOUNCE_MS);
  };
}

titleEl.addEventListener("input", onTextInput("title", TITLE_MAX, titleCount));
subtitleEl.addEventListener("input", onTextInput("subtitle", SUBTITLE_MAX, subtitleCount));

themeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.theme = chip.dataset.theme === "light" ? "light" : "dark";
    setChip(state.theme);
    render({ bust: false });
  });
});

document.querySelectorAll("[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    if (action === "copy-url") copyUrl();
    else if (action === "download") downloadPng();
    else if (action === "reset") applyState({ title: "", subtitle: "", theme: initialTheme() }, { immediate: true });
    else if (action === "sample") applyState(SAMPLE, { immediate: true });
  });
});

window.addEventListener("hashchange", () => {
  const fromHash = readHash();
  if (fromHash) applyState({ title: "", subtitle: "", theme: initialTheme(), ...fromHash }, { immediate: true });
});

// Boot: hash beats localStorage; both can be empty (defaults apply).
const fromHash = readHash();
const boot = { title: "", subtitle: "", theme: initialTheme(), ...(fromHash || {}) };
applyState(boot, { immediate: true });
