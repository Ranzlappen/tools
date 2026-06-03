/* Regex Tester & Builder */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const patternEl = $("#re-pattern");
const inputEl = $("#re-input");
const flagsLabel = $("#re-flags");
const highlightEl = $("#re-highlight");
const matchesEl = $("#re-matches");
const countEl = $("#re-count");
const errEl = $("#re-error");
const errTextEl = $("#re-error-text");
const replaceEl = $("#re-replace");
const replacedEl = $("#re-replaced");
const snippetsEl = $("#re-snippets");

const flags = new Set(["g"]);

const SNIPPETS = [
  { name: "Email",      pattern: "\\b[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}\\b" },
  { name: "URL",        pattern: "https?:\\/\\/[\\w.-]+(?:\\.[A-Za-z]{2,})+(?:\\/[^\\s]*)?" },
  { name: "IPv4",       pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d?\\d)\\b" },
  { name: "ISO date",   pattern: "\\b\\d{4}-\\d{2}-\\d{2}(?:[T ]\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?\\b" },
  { name: "Phone (loose)", pattern: "\\+?\\d[\\d\\s().-]{7,}\\d" },
  { name: "Hex color",  pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b" },
  { name: "UUID",       pattern: "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-7][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\\b" },
  { name: "Semver",     pattern: "\\bv?\\d+\\.\\d+\\.\\d+(?:-[\\w.]+)?(?:\\+[\\w.]+)?\\b" },
  { name: "Whitespace lines", pattern: "^\\s*$" },
];

SNIPPETS.forEach((s) => {
  const c = document.createElement("button");
  c.className = "chip";
  c.textContent = s.name;
  c.dataset.snippet = s.pattern;
  snippetsEl.appendChild(c);
});

function escapeHtml(str) {
  return str.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function compile() {
  const src = patternEl.value;
  if (!src) return { re: null, error: null };
  try {
    const re = new RegExp(src, [...flags].join(""));
    return { re, error: null };
  } catch (e) {
    return { re: null, error: e.message };
  }
}

function run() {
  flagsLabel.textContent = [...flags].join("") || "(none)";
  const { re, error } = compile();
  if (error) {
    errEl.classList.remove("is-hidden");
    errTextEl.textContent = error;
    highlightEl.innerHTML = escapeHtml(inputEl.value);
    matchesEl.innerHTML = "";
    countEl.textContent = "Invalid pattern";
    return;
  }
  errEl.classList.add("is-hidden");
  if (!re) {
    highlightEl.innerHTML = escapeHtml(inputEl.value);
    matchesEl.innerHTML = "";
    countEl.textContent = "No matches";
    return;
  }

  const text = inputEl.value;
  const isGlobal = flags.has("g");
  const matches = [];

  if (isGlobal) {
    const r2 = new RegExp(re.source, re.flags);
    let m;
    let safety = 0;
    while ((m = r2.exec(text)) && safety++ < 10000) {
      matches.push({ ...m });
      if (m[0] === "") r2.lastIndex++;
    }
  } else {
    const m = re.exec(text);
    if (m) matches.push({ ...m });
  }

  // build highlighted output
  if (matches.length === 0) {
    highlightEl.innerHTML = escapeHtml(text);
  } else {
    let out = "";
    let lastIdx = 0;
    for (const m of matches) {
      out += escapeHtml(text.slice(lastIdx, m.index));
      out += `<span class="match-highlight">${escapeHtml(m[0])}</span>`;
      lastIdx = m.index + m[0].length;
    }
    out += escapeHtml(text.slice(lastIdx));
    highlightEl.innerHTML = out;
  }

  // build match list
  matchesEl.innerHTML = "";
  matches.forEach((m, i) => {
    const li = document.createElement("li");
    let html = `<span class="idx">${i}</span><strong>${escapeHtml(m[0])}</strong> <span class="muted">@${m.index}</span>`;
    if (m.length > 1) {
      for (let g = 1; g < m.length; g++) {
        if (m[g] !== undefined) html += ` <span class="group">$${g}:</span> ${escapeHtml(m[g])}`;
      }
    }
    if (m.groups) {
      for (const [k, v] of Object.entries(m.groups)) {
        if (v !== undefined) html += ` <span class="group">${k}:</span> ${escapeHtml(v)}`;
      }
    }
    li.innerHTML = html;
    matchesEl.appendChild(li);
  });

  countEl.textContent = matches.length === 1 ? "1 match" : `${matches.length} matches`;

  // replace mode
  if (replaceEl.value !== "") {
    try {
      replacedEl.value = text.replace(re, replaceEl.value);
    } catch {
      replacedEl.value = "";
    }
  } else {
    replacedEl.value = "";
  }
}

document.addEventListener("click", (e) => {
  const flagBtn = e.target.closest("[data-flag]");
  if (flagBtn) {
    const f = flagBtn.dataset.flag;
    if (flags.has(f)) flags.delete(f); else flags.add(f);
    if (flags.has("g") && flags.has("y")) flags.delete("y");
    flagBtn.setAttribute("aria-pressed", flags.has(f) ? "true" : "false");
    run();
    return;
  }
  const snip = e.target.closest("[data-snippet]");
  if (snip) {
    patternEl.value = snip.dataset.snippet;
    run();
    patternEl.focus();
  }
});

[patternEl, inputEl, replaceEl].forEach((el) => el.addEventListener("input", run));

inputEl.value = "Email: ada@example.com\nVisit https://ranzlappen.com\nIP 10.0.0.1 today.";
patternEl.value = SNIPPETS[0].pattern;
run();
