// Basic test to see if all components render without throwing
const fs = require('fs');
const code = fs.readFileSync('./circuit-simulator/editor.js', 'utf8');

// Quick and dirty mock of DOM
global.document = {
  createElementNS: () => ({
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
    querySelector: () => ({ textContent: '' })
  }),
  getElementById: () => ({
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    style: {}
  })
};

// Evaluate the class
const m = {};
const wrapper = Function('module', 'exports', code + '\nmodule.exports = { CircuitEditor };');
wrapper(m, m);

const editor = new m.exports.CircuitEditor('mock');
Object.keys(editor.definitions).forEach(key => {
  const comp = editor.definitions[key];
  if (comp.type !== 'wire') {
    const mockG = { innerHTML: '', querySelector: () => ({}) };
    comp.render(mockG);
  }
});
console.log('All components render successfully.');
