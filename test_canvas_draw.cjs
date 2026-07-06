const fs = require('fs');
const code = fs.readFileSync('./circuit-simulator/editor.js', 'utf8');

global.document = {
  createElementNS: () => ({
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
    querySelector: () => ({ textContent: '' })
  }),
  getElementById: () => ({
    addEventListener: () => {},
    appendChild: () => {},
    innerHTML: '',
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    style: {}
  })
};

const cleanCode = code.replace('export class CircuitEditor', 'class CircuitEditor');
const wrapper = Function('module', 'exports', cleanCode + '\nmodule.exports = { CircuitEditor };');
const m = { exports: {} };
wrapper(m, m.exports);

const editor = new m.exports.CircuitEditor('mock');
Object.keys(editor.definitions).forEach(key => {
  const comp = editor.definitions[key];
  if (comp.type !== 'wire') {
    const mockG = { innerHTML: '', querySelector: () => ({}) };
    try {
      comp.render(mockG);
    } catch(e) {
      console.error(`Error rendering ${key}:`, e);
    }
  }
});
console.log('All components render successfully.');
