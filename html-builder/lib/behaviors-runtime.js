/* behaviors-runtime.js — the no-code interaction contract, shared by the
   behaviors editor UI, the live preview, and the export. Pure: metadata +
   a serializer + the runtime IIFE source string. No DOM, no imports.

   A Behavior = { id, trigger, action, target, params }.
   On export each node with behaviors carries data-hb-bind='[...]' and the
   RUNTIME_JS IIFE wires them. The same bytes run in the in-editor preview. */

export const TRIGGERS = [
  { id: "click", label: "On click" },
  { id: "hover", label: "On hover" },
  { id: "load", label: "On page load" },
  { id: "scroll-into-view", label: "On scroll into view" },
];

export const ACTIONS = [
  { id: "toggle-class", label: "Toggle CSS class", params: [{ key: "className", label: "Class name", type: "text" }] },
  { id: "add-class", label: "Add CSS class", params: [{ key: "className", label: "Class name", type: "text" }] },
  { id: "remove-class", label: "Remove CSS class", params: [{ key: "className", label: "Class name", type: "text" }] },
  { id: "show", label: "Show element", params: [] },
  { id: "hide", label: "Hide element", params: [] },
  { id: "set-style", label: "Set style property", params: [{ key: "prop", label: "CSS property", type: "text" }, { key: "value", label: "Value", type: "text" }] },
  { id: "set-text", label: "Set text content", params: [{ key: "text", label: "Text", type: "text" }] },
  { id: "navigate", label: "Go to URL", params: [{ key: "href", label: "URL", type: "text" }, { key: "blank", label: "Open in new tab", type: "bool" }] },
  { id: "scroll-to", label: "Scroll to element", params: [] },
  { id: "play", label: "Play media", params: [] },
  { id: "pause", label: "Pause media", params: [] },
];

export const actionInfo = (id) => ACTIONS.find((a) => a.id === id) || null;
export const triggerInfo = (id) => TRIGGERS.find((t) => t.id === id) || null;

export function makeBehavior() {
  return { id: "b_" + Math.random().toString(36).slice(2, 9), trigger: "click", action: "toggle-class", target: "self", params: {} };
}

/* Compact form embedded in the DOM as data-hb-bind. Short keys keep export
   lean: t=trigger, a=action, g=target(=goal), p=params. */
export function serializeBindings(node) {
  if (!node.behaviors || !node.behaviors.length) return null;
  return node.behaviors.map((b) => ({ t: b.trigger, a: b.action, g: b.target || "self", p: b.params || {} }));
}

/* The runtime. A self-contained IIFE; no deps, no eval. Wires click/hover via
   addEventListener, scroll-into-view via IntersectionObserver, load
   immediately. Targets resolve through [data-hb-id]. */
export const RUNTIME_JS = `(function(){
  function el(id){return id&&id!=='self'?document.querySelector('[data-hb-id="'+id+'"]'):null;}
  function act(host,b){
    var t=b.g&&b.g!=='self'?el(b.g):host; if(!t)return; var p=b.p||{};
    switch(b.a){
      case 'toggle-class':if(p.className)t.classList.toggle(p.className);break;
      case 'add-class':if(p.className)t.classList.add(p.className);break;
      case 'remove-class':if(p.className)t.classList.remove(p.className);break;
      case 'show':t.style.display=t.getAttribute('data-hb-disp')||'';if(getComputedStyle(t).display==='none')t.style.display='block';break;
      case 'hide':t.style.display='none';break;
      case 'set-style':if(p.prop)t.style.setProperty(p.prop,p.value||'');break;
      case 'set-text':t.textContent=p.text||'';break;
      case 'navigate':if(p.href){if(p.blank)window.open(p.href,'_blank');else window.location.href=p.href;}break;
      case 'scroll-to':t.scrollIntoView({behavior:'smooth',block:'start'});break;
      case 'play':if(t.play)t.play();break;
      case 'pause':if(t.pause)t.pause();break;
    }
  }
  function wire(host){
    var raw=host.getAttribute('data-hb-bind');if(!raw)return;var list;
    try{list=JSON.parse(raw);}catch(e){return;}
    list.forEach(function(b){
      if(b.t==='click'){host.addEventListener('click',function(e){if(b.a==='navigate'||b.a==='scroll-to')e.preventDefault();act(host,b);});}
      else if(b.t==='hover'){host.addEventListener('mouseenter',function(){act(host,b);});}
      else if(b.t==='load'){act(host,b);}
      else if(b.t==='scroll-into-view'){io.observe(host);pending.set(host,(pending.get(host)||[]).concat(b));}
    });
  }
  var pending=new Map();
  var io=('IntersectionObserver'in window)?new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){(pending.get(en.target)||[]).forEach(function(b){act(en.target,b);});io.unobserve(en.target);pending.delete(en.target);}});},{threshold:0.2}):{observe:function(){},unobserve:function(){}};
  function init(){document.querySelectorAll('[data-hb-bind]').forEach(wire);}
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();`;
