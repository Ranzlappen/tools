// YouTube MP3 Studio — builds a yt-dlp command from form state.
// Pure client-side string building. No URL is ever fetched; nothing leaves
// the page.

const $ = (id) => document.getElementById(id);

const els = {
  url: $("yt-url"),
  presets: $("yt-presets"),
  options: $("yt-options"),
  format: $("yt-format"),
  qualityField: $("yt-quality-field"),
  quality: $("yt-quality"),
  concurrent: $("yt-concurrent"),
  embed: $("yt-embed"),
  scope: $("yt-scope"),
  itemsField: $("yt-items-field"),
  items: $("yt-items"),
  output: $("yt-output"),
  auth: $("yt-auth"),
  browserField: $("yt-browser-field"),
  browser: $("yt-browser"),
  cookieFileField: $("yt-cookiefile-field"),
  cookieFile: $("yt-cookiefile"),
  authNote: $("yt-auth-note"),
  command: $("yt-command"),
  copy: $("yt-copy"),
};

const TEMPLATE_SINGLE = "%(title)s.%(ext)s";
const TEMPLATE_PLAYLIST = "%(playlist_title)s/%(playlist_index)02d - %(title)s.%(ext)s";

const AUTH_NOTES = {
  none: "",
  browser:
    "yt-dlp reads cookies straight from your installed browser — nothing is uploaded. Tip: fully close that browser first so it doesn't lock the cookie database.",
  file:
    "Point this at a cookies.txt you exported yourself. Make one with the Cookies.txt Converter, and treat the file like a password — it grants access to your session.",
};

// POSIX shell-quote: leave clearly-safe tokens bare, single-quote the rest.
function shq(s) {
  if (s === "") return "''";
  if (/^[A-Za-z0-9_\-.,/:=@%+]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function embedState() {
  const state = {};
  els.embed.querySelectorAll("[data-flag]").forEach((b) => {
    state[b.dataset.flag] = b.getAttribute("aria-pressed") === "true";
  });
  return state;
}

// Build an array of { t, s } tokens: t is 'cmd' | 'flag' | 'val' | 'str'.
function buildTokens() {
  const t = [];
  const push = (type, s) => t.push({ t: type, s });

  push("cmd", "yt-dlp");

  const fmt = els.format.value;
  push("flag", "-x");
  push("flag", "--audio-format");
  push("val", fmt);
  if (fmt === "mp3") {
    push("flag", "--audio-quality");
    push("val", els.quality.value);
  }
  push("flag", "-f");
  push("str", "bestaudio/best");

  const e = embedState();
  if (e.thumbnail) push("flag", "--embed-thumbnail");
  if (e.metadata) push("flag", "--embed-metadata");
  if (e.chapters) push("flag", "--embed-chapters");
  if (e.sponsorblock) { push("flag", "--sponsorblock-remove"); push("val", "all"); }
  if (e.restrict) push("flag", "--restrict-filenames");
  if (e.archive) { push("flag", "--download-archive"); push("str", "archive.txt"); }

  const n = els.concurrent.value;
  if (n !== "1") { push("flag", "-N"); push("val", n); }

  if (els.scope.value === "playlist") {
    push("flag", "--yes-playlist");
    const items = els.items.value.trim();
    if (items) { push("flag", "--playlist-items"); push("val", items); }
  } else {
    push("flag", "--no-playlist");
  }

  if (els.auth.value === "browser") {
    push("flag", "--cookies-from-browser");
    push("val", els.browser.value);
  } else if (els.auth.value === "file") {
    push("flag", "--cookies");
    push("str", els.cookieFile.value.trim() || "cookies.txt");
  }

  const out = els.output.value.trim();
  if (out) { push("flag", "-o"); push("str", out); }

  push("str", els.url.value.trim() || "<URL>");
  return t;
}

function tokenText(tok) {
  return tok.t === "flag" || tok.t === "cmd" ? tok.s : shq(tok.s);
}

function render() {
  syncVisibility();
  const tokens = buildTokens();

  // Plain string for copying.
  els.command.dataset.command = tokens.map(tokenText).join(" ");

  // Highlighted HTML for display.
  els.command.innerHTML = tokens
    .map((tok) => {
      const esc = escapeHtml(tokenText(tok));
      if (tok.t === "flag") return `<span class="tok-flag">${esc}</span>`;
      if (tok.t === "str") return `<span class="tok-str">${esc}</span>`;
      return esc;
    })
    .join(" ");
}

function syncVisibility() {
  els.qualityField.classList.toggle("ytm-hidden", els.format.value !== "mp3");
  els.itemsField.classList.toggle("ytm-hidden", els.scope.value !== "playlist");
  els.browserField.classList.toggle("ytm-hidden", els.auth.value !== "browser");
  els.cookieFileField.classList.toggle("ytm-hidden", els.auth.value !== "file");
  els.authNote.textContent = AUTH_NOTES[els.auth.value] || "";
}

function setEmbed(map) {
  els.embed.querySelectorAll("[data-flag]").forEach((b) => {
    const on = !!map[b.dataset.flag];
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("is-active", on);
  });
}

const PRESETS = {
  mp3() {
    els.format.value = "mp3";
    els.quality.value = "320K";
    els.scope.value = "single";
    els.auth.value = "none";
    els.output.value = TEMPLATE_SINGLE;
    setEmbed({ thumbnail: true, metadata: true });
  },
  playlist() {
    els.format.value = "mp3";
    els.quality.value = "320K";
    els.scope.value = "playlist";
    els.output.value = TEMPLATE_PLAYLIST;
    setEmbed({ thumbnail: true, metadata: true });
  },
  private() {
    els.format.value = "mp3";
    els.quality.value = "320K";
    els.scope.value = "playlist";
    els.auth.value = "browser";
    els.browser.value = "chrome";
    els.output.value = TEMPLATE_PLAYLIST;
    setEmbed({ thumbnail: true, metadata: true });
  },
};

// ---- events (delegated) ----

els.url.addEventListener("input", render);
els.options.addEventListener("input", render);
els.options.addEventListener("change", render);

els.embed.addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-flag]");
  if (!chip) return;
  const on = chip.getAttribute("aria-pressed") !== "true";
  chip.setAttribute("aria-pressed", String(on));
  chip.classList.toggle("is-active", on);
  render();
});

els.presets.addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-preset]");
  if (!chip || !PRESETS[chip.dataset.preset]) return;
  PRESETS[chip.dataset.preset]();
  render();
});

document.addEventListener("click", async (ev) => {
  const action = ev.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "clear") {
    els.url.value = "";
    els.url.focus();
    render();
  } else if (action === "paste") {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { els.url.value = text.trim(); render(); }
    } catch { els.url.focus(); }
  } else if (action === "copy") {
    const cmd = els.command.dataset.command || "";
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {
      const r = document.createRange();
      r.selectNodeContents(els.command);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
    const btn = els.copy;
    const original = btn.querySelector("svg") ? btn.lastChild.textContent : btn.textContent;
    btn.lastChild.textContent = " Copied";
    setTimeout(() => { btn.lastChild.textContent = original; }, 1200);
  }
});

render();
