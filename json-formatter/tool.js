/* JSON Formatter — format / minify / validate. Pure client. */

const $ = (s) => document.querySelector(s);
const inEl = $("#json-in");
const outEl = $("#json-out");
const statusEl = $("#status");
const statusTextEl = $("#status-text");

const SAMPLE = {
  user: { id: 42, name: "Ada Lovelace", roles: ["author", "admin"] },
  posts: [
    { slug: "first-post", title: "Hello, world", published: true, tags: ["intro"] },
    { slug: "draft", title: null, published: false, tags: [] },
  ],
  meta: { generated: "2026-05-16T12:00:00Z", count: 2 },
};

function setStatus(kind, msg) {
  statusEl.classList.remove("banner--info", "banner--warn", "banner--error", "is-hidden");
  statusEl.classList.add("banner--" + kind);
  statusTextEl.textContent = msg;
}
function clearStatus() {
  statusEl.classList.add("is-hidden");
  statusTextEl.textContent = "";
}

function parsePosition(message, raw) {
  // Most engines: "Unexpected token x in JSON at position 42"
  const m = /position (\d+)/.exec(message);
  if (!m) return null;
  const pos = parseInt(m[1], 10);
  let line = 1;
  let col = 1;
  for (let i = 0; i < pos && i < raw.length; i++) {
    if (raw[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { pos, line, col };
}

function action(kind) {
  const raw = inEl.value;
  if (!raw.trim()) {
    setStatus("warn", "Input is empty.");
    outEl.value = "";
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (kind === "validate") {
      const size = new Blob([raw]).size;
      setStatus("info", `Valid JSON. ${size.toLocaleString()} bytes.`);
      return;
    }
    outEl.value =
      kind === "minify" ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);
    setStatus("info", kind === "minify" ? "Minified." : "Formatted.");
  } catch (err) {
    outEl.value = "";
    const where = parsePosition(err.message, raw);
    const detail = where ? ` (line ${where.line}, col ${where.col})` : "";
    setStatus("error", err.message + detail);
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const a = btn.dataset.action;
  if (a === "sample") {
    inEl.value = JSON.stringify(SAMPLE, null, 2);
    outEl.value = "";
    clearStatus();
  } else if (a === "clear") {
    inEl.value = "";
    outEl.value = "";
    clearStatus();
    inEl.focus();
  } else if (a === "copy") {
    if (!outEl.value) {
      setStatus("warn", "Nothing to copy. Run Format or Minify first.");
      return;
    }
    navigator.clipboard
      .writeText(outEl.value)
      .then(() => setStatus("info", "Copied to clipboard."))
      .catch(() => setStatus("error", "Clipboard write failed."));
  } else {
    action(a);
  }
});

inEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    action("format");
  }
});
