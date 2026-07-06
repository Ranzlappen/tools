import { CircuitEditor } from './editor.js';
import { CircuitSimulator } from './simulator.js';

document.addEventListener('DOMContentLoaded', () => {
  const editor = new CircuitEditor('circuit-canvas');
  const simulator = new CircuitSimulator();

  const paletteEl = document.getElementById('component-palette');
  const propsPanel = document.getElementById('props-panel');
  const propsContent = document.getElementById('props-content');
  const statusBanner = document.getElementById('status');
  const statusText = document.getElementById('status-text');

  // Initialize palette
  Object.values(editor.definitions).forEach(def => {
    const item = document.createElement('div');
    item.className = 'palette-item';

    // Create a mini SVG preview
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-30 -30 80 60');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    if (def.type === 'wire') {
      g.innerHTML = `<path class="wire" d="M -20 0 L 40 0" stroke="currentColor"/>`;
    } else {
      def.render(g);
    }

    svg.appendChild(g);
    item.appendChild(svg);

    const label = document.createElement('span');
    label.textContent = def.name;
    item.appendChild(label);

    item.addEventListener('click', () => {
      if (def.type === 'wire') {
        editor.setMode('wire');
      } else {
        editor.setMode('place', def.type);
      }
    });

    paletteEl.appendChild(item);
  });

  // Handle selection change
  editor.onSelectionChange = (selection) => {
    propsContent.innerHTML = '';

    if (!selection) {
      propsPanel.classList.add('is-hidden');
      return;
    }

    propsPanel.classList.remove('is-hidden');

    if (selection.type === 'component') {
      const comp = selection.item;
      const def = editor.definitions[comp.type];

      // Type label
      const typeDiv = document.createElement('div');
      typeDiv.className = 'prop-field';
      typeDiv.innerHTML = `<label>Type</label><div style="padding: 0.5rem 0;">${def.name}</div>`;
      propsContent.appendChild(typeDiv);

      // Properties
      Object.entries(comp.props).forEach(([key, prop]) => {
        const field = document.createElement('div');
        field.className = 'prop-field';

        const label = document.createElement('label');
        label.textContent = prop.label;

        const input = document.createElement('input');
        input.type = 'number';
        input.value = prop.value;
        input.step = 'any';

        input.addEventListener('change', (e) => {
          comp.props[key].value = parseFloat(e.target.value);
          editor.draw();
          runSimulation(); // Auto-simulate on property change
        });

        field.appendChild(label);
        field.appendChild(input);
        propsContent.appendChild(field);
      });

      // Simulation Data Display
      if (comp.simData) {
        const simDiv = document.createElement('div');
        simDiv.className = 'prop-field';
        let html = `<label>Simulation Data</label>
          <div style="font-family: var(--font-mono); font-size: 0.875rem; margin-top: 0.5rem; color: var(--accent);">
            V Drop: ${Math.abs(comp.simData.voltageDrop).toFixed(3)} V<br>
            Current: ${Math.abs(comp.simData.current * 1000).toFixed(2)} mA<br>
            Power: ${comp.simData.power.toFixed(4)} W
          </div>`;
        if (comp.simData.warning) {
          html += `<div class="simulation-error" style="margin-top: 0.5rem; font-size: 0.8rem;">⚠ ${comp.simData.warning}</div>`;
        }
        simDiv.innerHTML = html;
        propsContent.appendChild(simDiv);
      }
    }
  };

  // Simulation Logic
  const runSimulation = () => {
    statusBanner.classList.add('is-hidden');

    // Clear old simulation data
    editor.components.forEach(c => c.simData = null);
    editor.wires.forEach(w => { w.simColor = null; w.simLabel = null; });

    if (editor.components.length === 0) {
      editor.draw();
      return;
    }

    const res = simulator.simulate(editor.components, editor.wires);

    if (!res.success) {
      statusBanner.classList.remove('is-hidden');
      statusBanner.classList.replace('banner--success', 'banner--error');
      statusBanner.classList.replace('banner--info', 'banner--error');
      statusText.textContent = "Simulation Error: " + res.error;
      editor.draw();
      return;
    }

    // Apply simulation results
    Object.entries(res.data.components).forEach(([id, data]) => {
      const comp = editor.components.find(c => c.id === id);
      if (comp) comp.simData = data;
    });

    Object.entries(res.data.wires).forEach(([id, data]) => {
      const wire = editor.wires.find(w => w.id === id);
      if (wire) {
        wire.simColor = data.color;
        wire.simLabel = data.label;
      }
    });

    // Check for warnings
    const warnings = Object.values(res.data.components).filter(c => c.warning).map(c => c.warning);
    if (warnings.length > 0) {
      statusBanner.classList.remove('is-hidden');
      statusBanner.classList.replace('banner--error', 'banner--warning');
      statusBanner.classList.replace('banner--info', 'banner--warning');
      statusBanner.classList.replace('banner--success', 'banner--warning');
      statusText.textContent = "Warning: " + warnings.join(' | ');
    } else {
      statusBanner.classList.remove('is-hidden');
      statusBanner.classList.replace('banner--error', 'banner--success');
      statusBanner.classList.replace('banner--warning', 'banner--success');
      statusBanner.classList.replace('banner--info', 'banner--success');
      statusText.textContent = "Simulation running successfully.";
    }

    editor.draw();

    // Refresh properties panel if a component is selected
    if (editor.state.selectedComponent) {
      editor.onSelectionChange({ type: 'component', item: editor.state.selectedComponent });
    }
  };

  // Bind Buttons
  document.getElementById('btn-simulate').addEventListener('click', runSimulation);

  document.getElementById('btn-clear').addEventListener('click', () => {
    editor.clear();
    statusBanner.classList.add('is-hidden');
  });

  // Intercept draw to also run simulation if we want live updates
  // A bit hacky but works for this simple app
  const originalDraw = editor.draw.bind(editor);
  let simTimeout = null;
  editor.draw = () => {
    originalDraw();
    if (simTimeout) clearTimeout(simTimeout);
    simTimeout = setTimeout(() => {
      // Only auto-simulate if there are components and we're not actively wiring/placing
      if (editor.state.mode === 'select' && editor.components.length > 0 && !editor.state.draggingComponent) {
        runSimulation();
      }
    }, 500);
  };
});
