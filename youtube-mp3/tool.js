// YouTube MP3 Studio — builds a yt-dlp command from form state.
// Pure client-side string building: by default no URL is ever fetched and
// nothing leaves the page. The optional "Sign in with Google" flow
// (yt-oauth.js) is the one exception — it talks to Google's APIs read-only to
// list your playlists, so you can download your Liked videos cookie-free.

import * as yt from "./yt-oauth.js";

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
  split: $("yt-split"),
  chapterField: $("yt-chapter-field"),
  chapter: $("yt-chapter"),
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
  // optional account flow
  signin: $("yt-signin"),
  signout: $("yt-signout"),
  accountPick: $("yt-account-pick"),
  playlist: $("yt-playlist"),
  accountStatus: $("yt-account-status"),
  using: $("yt-using"),
  downloadUrls: $("yt-download-urls"),
};

// Videos loaded from a signed-in playlist. When non-empty the command targets
// a `urls.txt` batch file instead of the single URL field.
let loaded = { videos: [], title: "" };

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

// The single "Auto-cut into one file per chapter" toggle chip.
function splitChip() {
  return els.split.querySelector("[data-action='yt-split-toggle']");
}

function isSplit() {
  return splitChip().getAttribute("aria-pressed") === "true";
}

function setSplit(on) {
  const chip = splitChip();
  chip.setAttribute("aria-pressed", String(on));
  chip.classList.toggle("is-active", on);
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

  const usingList = loaded.videos.length > 0;
  if (usingList) {
    // Each entry is a clean watch URL — never expand it into a mix/playlist.
    push("flag", "--no-playlist");
  } else if (els.scope.value === "playlist") {
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

  // Auto-cut a multi-song video into one file per chapter. The chapter:-typed
  // -o names each split track; the plain -o above still names the leftover
  // full file. Videos with no chapters just download whole — no error.
  if (isSplit()) {
    push("flag", "--split-chapters");
    const ct = els.chapter.value.trim();
    if (ct) { push("flag", "-o"); push("str", "chapter:" + ct); }
  }

  if (usingList) {
    push("flag", "-a");
    push("str", "urls.txt");
  } else {
    push("str", els.url.value.trim() || "<URL>");
  }
  return t;
}

function urlsText() {
  return loaded.videos
    .map((v) => `https://www.youtube.com/watch?v=${v.id}`)
    .join("\n") + "\n";
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
  const usingList = loaded.videos.length > 0;
  els.qualityField.classList.toggle("ytm-hidden", els.format.value !== "mp3");
  // The manual scope/items controls don't apply to a loaded list.
  els.itemsField.classList.toggle("ytm-hidden", usingList || els.scope.value !== "playlist");
  els.chapterField.classList.toggle("ytm-hidden", !isSplit());
  els.browserField.classList.toggle("ytm-hidden", els.auth.value !== "browser");
  els.cookieFileField.classList.toggle("ytm-hidden", els.auth.value !== "file");
  els.authNote.textContent = AUTH_NOTES[els.auth.value] || "";

  els.downloadUrls.classList.toggle("ytm-hidden", !usingList);
  els.using.classList.toggle("ytm-hidden", !usingList);
  if (usingList) {
    els.using.innerHTML =
      `Reads <strong>urls.txt</strong> — ${loaded.videos.length} video` +
      `${loaded.videos.length === 1 ? "" : "s"} from “${escapeHtml(loaded.title)}”. ` +
      `Click <strong>urls.txt</strong> to save the file, then run the command in the same folder. ` +
      `<button type="button" class="ytm-link" data-action="yt-clear-list">Use a single URL instead</button>`;
  }
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
    setSplit(false);
  },
  playlist() {
    els.format.value = "mp3";
    els.quality.value = "320K";
    els.scope.value = "playlist";
    els.output.value = TEMPLATE_PLAYLIST;
    setEmbed({ thumbnail: true, metadata: true });
    setSplit(false);
  },
  split() {
    els.format.value = "mp3";
    els.quality.value = "320K";
    els.scope.value = "single";
    els.auth.value = "none";
    els.output.value = TEMPLATE_SINGLE;
    els.chapter.value = "%(title)s/%(section_number)02d - %(section_title)s.%(ext)s";
    setEmbed({ thumbnail: true, metadata: true });
    setSplit(true);
  },
  private() {
    els.format.value = "mp3";
    els.quality.value = "320K";
    els.scope.value = "playlist";
    els.auth.value = "browser";
    els.browser.value = "chrome";
    els.output.value = TEMPLATE_PLAYLIST;
    setEmbed({ thumbnail: true, metadata: true });
    setSplit(false);
  },
};

// ---- optional Google account flow ----

function status(msg, kind) {
  els.accountStatus.textContent = msg || "";
  els.accountStatus.style.color =
    kind === "error" ? "var(--c-danger, #ff6b6b)" : "var(--c-text-faint)";
}

function errorText(err) {
  const m = String(err?.message || err);
  if (m === "not-configured")
    return "Google sign-in isn't set up yet — paste a Web OAuth client ID into yt-oauth.js (see the info ⓘ → Sign in with Google).";
  if (m === "expired" || m === "not-signed-in")
    return "Your session expired — sign in again.";
  if (m === "popup_closed" || m === "popup-failed" || m === "popup_failed_to_open")
    return "Sign-in popup was closed or blocked. Allow popups and try again.";
  if (m === "access_denied")
    return "Access wasn't granted. In Testing mode, make sure your Google account is added as a test user.";
  return m;
}

function showSignedIn(on) {
  els.signin.classList.toggle("ytm-hidden", on);
  els.signout.classList.toggle("ytm-hidden", !on);
  els.accountPick.classList.toggle("ytm-hidden", !on);
}

async function doSignIn() {
  status("Opening Google sign-in…");
  try {
    await yt.signIn();
    status("Signed in. Loading your playlists…");
    await populatePlaylists();
    showSignedIn(true);
    status("Pick a playlist, then “Load videos”.");
  } catch (err) {
    status(errorText(err), "error");
  }
}

async function populatePlaylists() {
  const [related, mine] = await Promise.all([
    yt.getRelatedPlaylists().catch(() => ({})),
    yt.listMyPlaylists().catch(() => []),
  ]);
  const opts = [];
  if (related.likes)
    opts.push({ id: related.likes, label: "👍 Liked videos" });
  for (const p of mine) {
    const n = p.count == null ? "" : ` (${p.count})`;
    opts.push({ id: p.id, label: `${p.title}${n}` });
  }
  els.playlist.innerHTML = opts.length
    ? opts.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`).join("")
    : `<option value="">No playlists found</option>`;
}

async function doLoad() {
  const id = els.playlist.value;
  if (!id) { status("No playlist selected.", "error"); return; }
  const title = els.playlist.selectedOptions[0]?.textContent.replace(/\s*\(\d+\)$/, "").trim() || "playlist";
  status("Loading videos…");
  try {
    const { videos, skipped } = await yt.listItems(id, (n) => status(`Loading videos… ${n} so far`));
    if (!videos.length) {
      loaded = { videos: [], title: "" };
      status("No downloadable videos in that playlist.", "error");
      render();
      return;
    }
    loaded = { videos, title };
    const extra = skipped ? ` · ${skipped} unavailable skipped` : "";
    status(`Loaded ${videos.length} video${videos.length === 1 ? "" : "s"} from “${title}”${extra}.`);
    render();
  } catch (err) {
    status(errorText(err), "error");
  }
}

function downloadUrls() {
  if (!loaded.videos.length) return;
  const blob = new Blob([urlsText()], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "urls.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function clearList() {
  loaded = { videos: [], title: "" };
  status(yt.signedIn() ? "Pick a playlist, then “Load videos”." : "");
  render();
}

// If a client ID was never configured, say so up front (the button still works
// and will surface the same hint on click).
if (!yt.isConfigured()) {
  status("Sign-in needs a one-time setup — see the info ⓘ → “Sign in with Google”.");
}

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

els.split.addEventListener("click", (ev) => {
  if (!ev.target.closest("[data-action='yt-split-toggle']")) return;
  setSplit(!isSplit());
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
  } else if (action === "yt-signin") {
    await doSignIn();
  } else if (action === "yt-signout") {
    yt.signOut();
    showSignedIn(false);
    clearList();
    status("Signed out.");
  } else if (action === "yt-load") {
    await doLoad();
  } else if (action === "yt-download-urls") {
    downloadUrls();
  } else if (action === "yt-clear-list") {
    clearList();
  }
});

render();
