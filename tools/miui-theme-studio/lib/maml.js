/* MAML element registry — describes the element types the editor can add to an
   animated lockscreen or a fancy icon, and which attributes are editable.
   Drives the inspector UI; the actual XML is emitted by xml.js. */

import { uid } from "./state.js";

// field: { key, label, kind: "text"|"number"|"color"|"select", options? }
const FIELDS = {
  src: { key: "src", label: "Image source", kind: "text" },
  x: { key: "x", label: "X", kind: "number" },
  y: { key: "y", label: "Y", kind: "number" },
  align: {
    key: "align",
    label: "Align",
    kind: "select",
    options: ["left", "center", "right"],
  },
  format: { key: "format", label: "Format", kind: "text" },
  fontSize: { key: "fontSize", label: "Font size", kind: "number" },
  color: { key: "color", label: "Color", kind: "color" },
  name: { key: "name", label: "Name", kind: "text" },
};

export const LOCKSCREEN_TYPES = {
  Image: { fields: ["src", "x", "y", "align"], defaults: { src: "bg.png", x: 0, y: 0 } },
  Time: {
    fields: ["format", "x", "y", "fontSize", "color", "align"],
    defaults: { format: "HH:mm", x: 610, y: 700, fontSize: 180, color: "#FFFFFFFF", align: "center" },
  },
  DateTime: {
    fields: ["format", "x", "y", "fontSize", "color", "align"],
    defaults: { format: "EEEE, MMM d", x: 610, y: 920, fontSize: 56, color: "#FFFFFFFF", align: "center" },
  },
  Unlocker: { fields: ["src", "x", "y"], defaults: { src: "unlock.png", x: 0, y: 2400 } },
};

export const FANCY_TYPES = {
  Image: { fields: ["src", "x", "y"], defaults: { src: "bg.png", x: 0, y: 0 } },
  DateTime: {
    fields: ["format", "x", "y", "fontSize", "color"],
    defaults: { format: "HH:mm", x: 60, y: 70, fontSize: 28, color: "#FFFFFFFF" },
  },
  Battery: { fields: ["x", "y", "fontSize", "color"], defaults: { x: 60, y: 100, fontSize: 22, color: "#FFFFFFFF" } },
  Text: { fields: ["name", "x", "y", "fontSize", "color"], defaults: { name: "text", x: 10, y: 10, fontSize: 20, color: "#FFFFFFFF" } },
  Var: { fields: ["name", "x", "y", "fontSize", "color"], defaults: { name: "var", x: 10, y: 40, fontSize: 20, color: "#FFFFFFFF" } },
};

export function fieldDef(key) {
  return FIELDS[key];
}

export function makeElement(registry, type) {
  const def = registry[type];
  if (!def) return null;
  return { id: uid("el"), type, ...structuredClone(def.defaults) };
}

export function editableFields(registry, type) {
  const def = registry[type];
  return def ? def.fields.map((k) => FIELDS[k]) : [];
}
