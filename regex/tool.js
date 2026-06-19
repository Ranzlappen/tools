/* Regex Tester & Builder */

import { SNIPPET_GROUPS } from "./snippets.js";

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
const snippetFilterEl = $("#re-snippet-filter");

const flags = new Set(["g"]);

// Build the grouped snippet palette, optionally filtered by a query that
// matches a snippet's name or its pattern. Chips are built with DOM nodes
// (no innerHTML) so the static library can't be reinterpreted as markup.
function renderSnippets(query = "") {
  const q = query.trim().toLowerCase();
  snippetsEl.replaceChildren();
  let shown = 0;
  for (const grp of SNIPPET_GROUPS) {
    const items = grp.items.filter(
      (it) => !q || it.name.toLowerCase().includes(q) || it.pattern.toLowerCase().includes(q),
    );
    if (!items.length) continue;
    const section = document.createElement("div");
    section.className = "regex-snippet-group";
    section.style.display = "grid";
    section.style.gap = "6px";
    const label = document.createElement("span");
    label.className = "panel__sub muted tiny";
    label.textContent = grp.group;
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const it of items) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "chip";
      c.textContent = it.name;
      c.dataset.snippet = it.pattern;
      if (it.flags) c.dataset.flags = it.flags;
      c.title = `/${it.pattern}/${it.flags || ""}`;
      chips.appendChild(c);
      shown++;
    }
    section.appendChild(label);
    section.appendChild(chips);
    snippetsEl.appendChild(section);
  }
  if (!shown) {
    const empty = document.createElement("p");
    empty.className = "muted tiny";
    empty.textContent = "No snippets match your filter.";
    snippetsEl.appendChild(empty);
  }
}

// Replace the active flag set and reflect it in the flag chips' UI.
function setFlags(str) {
  flags.clear();
  for (const f of str) flags.add(f);
  if (flags.has("g") && flags.has("y")) flags.delete("y");
  $$("[data-flag]").forEach((btn) =>
    btn.setAttribute("aria-pressed", flags.has(btn.dataset.flag) ? "true" : "false"),
  );
}

renderSnippets();

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
    if (snip.dataset.flags) setFlags(snip.dataset.flags);
    run();
    patternEl.focus();
  }
});

[patternEl, inputEl, replaceEl].forEach((el) => el.addEventListener("input", run));
if (snippetFilterEl) snippetFilterEl.addEventListener("input", () => renderSnippets(snippetFilterEl.value));

inputEl.value = "Email: ada@example.com\nVisit https://ranzlappen.com\nIP 10.0.0.1 today.";
patternEl.value = SNIPPET_GROUPS[0].items[0].pattern;
run();
