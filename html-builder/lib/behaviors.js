/* behaviors.js — the no-code interaction editor for the Behaviors inspector
   tab. Renders the selected node's behavior rows (trigger → action → params →
   target) and writes them back through the store. The runtime contract lives
   in behaviors-runtime.js (shared with the renderer and exporters).

   This panel re-renders itself on structural row changes (add/remove, or a
   select that changes which params show) but writes silently on text input,
   so typing a class name or URL doesn't lose focus. */

import * as store from "./store.js";
import { walk } from "./schema.js";
import { TRIGGERS, ACTIONS, actionInfo, makeBehavior } from "./behaviors-runtime.js";

let host = null;
let nodeId = null;

export function render(container, node) {
  if (!container) return;
  host = container;
  nodeId = node.id;
  const behaviors = node.behaviors || [];
  const targets = targetOptions(node);

  let html = `<div class="hb-bhv">`;
  html += `<p class="hb-bhv__hint">Add interactions without code. They run in exported pages and in <em>Test</em> mode.</p>`;
  if (!behaviors.length) html += `<div class="hb-bhv__empty">No interactions yet.</div>`;

  behaviors.forEach((b, i) => {
    html += `<div class="hb-bhv__row" data-i="${i}">`;
    html += `<div class="hb-bhv__line">`;
    html += selectEl("trig", TRIGGERS.map((t) => [t.id, t.label]), b.trigger);
    html += selectEl("act", ACTIONS.map((a) => [a.id, a.label]), b.action);
    html += `<button type="button" class="hb-clear" data-del="${i}" title="Remove">×</button>`;
    html += `</div>`;
    // params
    const info = actionInfo(b.action);
    if (info && info.params.length) {
      html += `<div class="hb-bhv__params">`;
      for (const p of info.params) {
        const val = (b.params || {})[p.key];
        if (p.type === "bool") {
          html += `<label class="hb-check"><input type="checkbox" data-param="${p.key}"${val ? " checked" : ""}> ${p.label}</label>`;
        } else {
          html += `<input type="text" class="input hb-input" data-param="${p.key}" value="${attr(val)}" placeholder="${attr(p.label)}" spellcheck="false">`;
        }
      }
      html += `</div>`;
    }
    // target (hidden for self-only actions like none — always show, default self)
    html += `<div class="hb-bhv__target"><span class="hb-ctrl__label">Target</span>${selectEl("tgt", targets, b.target || "self")}</div>`;
    html += `</div>`;
  });

  html += `<button type="button" class="btn btn--ghost hb-bhv__add" data-add>+ Add interaction</button>`;
  html += `</div>`;
  host.innerHTML = html;

  host.onclick = onClick;
  host.onchange = onChange;
  host.oninput = onInput;
}

function targetOptions(node) {
  const opts = [["self", "This element"]];
  walk(store.get().root, (n) => {
    if (n.id === node.id) return;
    const label = n.id === "root" ? "body" : (n.name || n.tag + (n.classes[0] ? "." + n.classes[0] : ""));
    opts.push([n.id, label]);
  });
  return opts;
}

function selectEl(role, pairs, value) {
  const opts = pairs.map(([v, l]) => `<option value="${attr(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("");
  return `<select class="input hb-input" data-role="${role}">${opts}</select>`;
}

function current() {
  const d = store.get();
  const node = findById(d.root, nodeId);
  return node ? (node.behaviors || []).map((b) => ({ ...b, params: { ...b.params } })) : [];
}
function findById(root, id) { let f = null; walk(root, (n) => { if (n.id === id) f = n; }); return f; }

function rowIndex(elm) {
  const row = elm.closest("[data-i]");
  return row ? Number(row.getAttribute("data-i")) : -1;
}

function onClick(e) {
  if (e.target.closest("[data-add]")) {
    const list = current();
    list.push(makeBehavior());
    store.setBehaviors(nodeId, list);
    rerender();
    return;
  }
  const del = e.target.closest("[data-del]");
  if (del) {
    const list = current();
    list.splice(Number(del.getAttribute("data-del")), 1);
    store.setBehaviors(nodeId, list);
    rerender();
    return;
  }
}

function onChange(e) {
  const role = e.target.getAttribute && e.target.getAttribute("data-role");
  if (role) {
    const i = rowIndex(e.target);
    const list = current();
    if (i < 0 || !list[i]) return;
    if (role === "trig") list[i].trigger = e.target.value;
    else if (role === "act") { list[i].action = e.target.value; list[i].params = {}; }
    else if (role === "tgt") list[i].target = e.target.value;
    store.setBehaviors(nodeId, list);
    rerender();
    return;
  }
  if (e.target.matches('input[type="checkbox"][data-param]')) {
    updateParam(e.target, e.target.checked);
  }
}

function onInput(e) {
  if (e.target.matches('input[data-param]:not([type="checkbox"])')) {
    updateParam(e.target, e.target.value);
  }
}

function updateParam(input, value) {
  const i = rowIndex(input);
  const list = current();
  if (i < 0 || !list[i]) return;
  list[i].params = { ...list[i].params, [input.getAttribute("data-param")]: value };
  store.setBehaviors(nodeId, list); // kind:"attr" — patches data-hb-bind, no focus loss
}

function rerender() {
  const node = findById(store.get().root, nodeId);
  if (node && host) render(host, node);
}

function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function attr(s) { return String(s == null ? "" : s).replace(/[&"<]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;" }[c])); }
