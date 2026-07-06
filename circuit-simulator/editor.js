export class CircuitEditor {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.components = [];
    this.wires = [];

    this.state = {
      mode: 'select', // 'select', 'wire', 'place'
      selectedComponent: null,
      selectedWire: null,
      draggingComponent: null,
      wiringStartPin: null,
      tempWire: null,
      placementType: null,
      mousePos: { x: 0, y: 0 },
      pan: { x: 0, y: 0 },
      zoom: 1,
      isPanning: false,
      panStart: { x: 0, y: 0 }
    };

    // Component definitions
    this.definitions = {
      'resistor': {
        type: 'resistor',
        name: 'Resistor',
        props: { resistance: { label: 'Resistance (Ω)', value: 1000 } },
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M -20 0 L -10 0 L -5 -10 L 5 10 L 15 -10 L 25 10 L 30 0 L 40 0" />
            <text class="component-label" x="10" y="-15" text-anchor="middle">R</text>
          `;
          return [{x: -20, y: 0, id: 'p1'}, {x: 40, y: 0, id: 'p2'}];
        }
      },
      'dcvsource': {
        type: 'dcvsource',
        name: 'DC Voltage',
        props: { voltage: { label: 'Voltage (V)', value: 9 } },
        render: (g) => {
          g.innerHTML = `
            <circle class="component-body" cx="10" cy="0" r="15" />
            <path class="component-body" d="M 5 -5 L 5 5 M 2 -2 L 8 -2 M -20 0 L -5 0 M 25 0 L 40 0 M 15 -5 L 15 5 M 12 -2 L 18 -2 M 15 2 L 15 -2" stroke-width="1.5"/>
            <text class="component-label" x="10" y="-20" text-anchor="middle">V</text>
            <text class="component-label" x="10" y="4" text-anchor="middle" font-size="10">+-</text>
          `;
          return [{x: -20, y: 0, id: 'p1'}, {x: 40, y: 0, id: 'p2'}];
        }
      },
      'ground': {
        type: 'ground',
        name: 'Ground',
        props: {},
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M 10 0 L 10 15 M 0 15 L 20 15 M 5 20 L 15 20 M 8 25 L 12 25" />
          `;
          return [{x: 10, y: 0, id: 'p1'}];
        }
      },
      'switch': {
        type: 'switch',
        name: 'Switch',
        props: { closed: { label: 'Closed (1=Yes, 0=No)', value: 0 } },
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M -20 0 L -10 0" />
            <path class="component-body" d="M -10 0 L 10 -10" stroke-width="1.5" />
            <path class="component-body" d="M 10 0 L 20 0" />
            <circle class="component-body" cx="-10" cy="0" r="2" fill="currentColor"/>
            <circle class="component-body" cx="10" cy="0" r="2" fill="currentColor"/>
            <text class="component-label" x="0" y="-15" text-anchor="middle">SW</text>
          `;
          return [{x: -20, y: 0, id: 'p1'}, {x: 20, y: 0, id: 'p2'}];
        }
      },
      'capacitor': {
        type: 'capacitor',
        name: 'Capacitor',
        props: { capacitance: { label: 'Capacitance (µF)', value: 10 } },
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M -20 0 L -5 0" />
            <path class="component-body" d="M 5 0 L 20 0" />
            <path class="component-body" d="M -5 -10 L -5 10" stroke-width="2" />
            <path class="component-body" d="M 5 -10 L 5 10" stroke-width="2" />
            <text class="component-label" x="0" y="-15" text-anchor="middle">C</text>
          `;
          return [{x: -20, y: 0, id: 'p1'}, {x: 20, y: 0, id: 'p2'}];
        }
      },
      'inductor': {
        type: 'inductor',
        name: 'Inductor',
        props: { inductance: { label: 'Inductance (mH)', value: 10 } },
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M -20 0 L -10 0 Q -5 -10 0 0 Q 5 -10 10 0 Q 15 -10 20 0 L 30 0" fill="none" />
            <text class="component-label" x="5" y="-15" text-anchor="middle">L</text>
          `;
          return [{x: -20, y: 0, id: 'p1'}, {x: 30, y: 0, id: 'p2'}];
        }
      },
      'bulb': {
        type: 'bulb',
        name: 'Light Bulb',
        props: { resistance: { label: 'Resistance (Ω)', value: 100 } },
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M -20 0 L -10 0" />
            <path class="component-body" d="M 10 0 L 20 0" />
            <circle class="component-body" cx="0" cy="0" r="10" />
            <path class="component-body" d="M -7 -7 L 7 7 M -7 7 L 7 -7" />
            <text class="component-label" x="0" y="-15" text-anchor="middle">Bulb</text>
          `;
          return [{x: -20, y: 0, id: 'p1'}, {x: 20, y: 0, id: 'p2'}];
        }
      },
      'voltmeter': {
        type: 'voltmeter',
        name: 'Voltmeter',
        props: {},
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M -20 0 L -10 0" />
            <path class="component-body" d="M 10 0 L 20 0" />
            <circle class="component-body" cx="0" cy="0" r="10" />
            <text x="0" y="4" text-anchor="middle" font-size="12" fill="currentColor">V</text>
          `;
          return [{x: -20, y: 0, id: 'p1'}, {x: 20, y: 0, id: 'p2'}];
        }
      },
      'ammeter': {
        type: 'ammeter',
        name: 'Ammeter',
        props: {},
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M -20 0 L -10 0" />
            <path class="component-body" d="M 10 0 L 20 0" />
            <circle class="component-body" cx="0" cy="0" r="10" />
            <text x="0" y="4" text-anchor="middle" font-size="12" fill="currentColor">A</text>
          `;
          return [{x: -20, y: 0, id: 'p1'}, {x: 20, y: 0, id: 'p2'}];
        }
      },
      'transformer': {
        type: 'transformer',
        name: 'Transformer',
        props: { ratio: { label: 'Turns Ratio (Np:Ns)', value: 1 } },
        render: (g) => {
          g.innerHTML = `
            <path class="component-body" d="M -20 -10 L -10 -10 Q -5 -15 0 -10 Q 5 -15 10 -10 Q 15 -15 20 -10 L 30 -10" fill="none" />
            <path class="component-body" d="M -20 10 L -10 10 Q -5 15 0 10 Q 5 15 10 10 Q 15 15 20 10 L 30 10" fill="none" />
            <path class="component-body" d="M -5 -2 L 15 -2 M -5 2 L 15 2" />
            <text class="component-label" x="5" y="-20" text-anchor="middle">TX</text>
          `;
          return [
            {x: -20, y: -10, id: 'p1'}, {x: 30, y: -10, id: 'p2'},
            {x: -20, y: 10, id: 'p3'}, {x: 30, y: 10, id: 'p4'}
          ];
        }
      },
      'wire': {
        type: 'wire',
        name: 'Wire Tool',
        props: {}
      }
    };

    this.initEvents();
    this.draw();
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.state.pan.x) / this.state.zoom,
      y: (e.clientY - rect.top - this.state.pan.y) / this.state.zoom
    };
  }

  snapToGrid(val, size = 10) {
    return Math.round(val / size) * size;
  }

  addComponent(type, x, y) {
    const def = this.definitions[type];
    if (!def) return;

    const comp = {
      id: this.generateId(),
      type: type,
      x: this.snapToGrid(x),
      y: this.snapToGrid(y),
      rotation: 0,
      props: JSON.parse(JSON.stringify(def.props || {}))
    };

    this.components.push(comp);
    this.draw();
    return comp;
  }

  addWire(pin1, pin2) {
    // Avoid duplicate wires
    const exists = this.wires.find(w =>
      (w.start.compId === pin1.compId && w.start.pinId === pin1.pinId && w.end.compId === pin2.compId && w.end.pinId === pin2.pinId) ||
      (w.start.compId === pin2.compId && w.start.pinId === pin2.pinId && w.end.compId === pin1.compId && w.end.pinId === pin1.pinId)
    );
    if (exists) return;

    // Prevent self loop
    if (pin1.compId === pin2.compId && pin1.pinId === pin2.pinId) return;

    this.wires.push({
      id: this.generateId(),
      start: pin1,
      end: pin2
    });
    this.draw();
  }

  removeComponent(id) {
    this.components = this.components.filter(c => c.id !== id);
    this.wires = this.wires.filter(w => w.start.compId !== id && w.end.compId !== id);
    if (this.state.selectedComponent && this.state.selectedComponent.id === id) {
      this.state.selectedComponent = null;
      this.onSelectionChange(null);
    }
    this.draw();
  }

  removeWire(id) {
    this.wires = this.wires.filter(w => w.id !== id);
    if (this.state.selectedWire && this.state.selectedWire.id === id) {
      this.state.selectedWire = null;
      this.onSelectionChange(null);
    }
    this.draw();
  }

  clear() {
    this.components = [];
    this.wires = [];
    this.state.selectedComponent = null;
    this.state.selectedWire = null;
    this.state.tempWire = null;
    this.onSelectionChange(null);
    this.draw();
  }

  getPinAbsolutePos(comp, pinOffset) {
    // Simple rotation math assuming 0, 90, 180, 270
    let rad = comp.rotation * Math.PI / 180;
    let cos = Math.cos(rad);
    let sin = Math.sin(rad);
    return {
      x: comp.x + pinOffset.x * cos - pinOffset.y * sin,
      y: comp.y + pinOffset.x * sin + pinOffset.y * cos
    };
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
  }

  onWheel(e) {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(0.1, this.state.zoom * (1 + delta)), 5);

    // Zoom around mouse pointer
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Adjust pan to keep the mouse pointer fixed relative to the canvas content
    this.state.pan.x = mouseX - (mouseX - this.state.pan.x) * (newZoom / this.state.zoom);
    this.state.pan.y = mouseY - (mouseY - this.state.pan.y) * (newZoom / this.state.zoom);

    this.state.zoom = newZoom;
    this.draw();
  }

  onMouseDown(e) {
    const pos = this.getCanvasPos(e);

    // Middle click or Alt+Left click for panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      this.state.isPanning = true;
      this.state.panStart = { x: e.clientX - this.state.pan.x, y: e.clientY - this.state.pan.y };
      return;
    }

    if (e.button === 2) {
      // Right click to cancel action or delete
      if (this.state.mode === 'wire' && this.state.wiringStartPin) {
        this.state.wiringStartPin = null;
        this.state.tempWire = null;
        this.draw();
        return;
      } else if (this.state.mode === 'place') {
        this.setMode('select');
        return;
      }
    }

    if (this.state.mode === 'place' && e.button === 0) {
      const comp = this.addComponent(this.state.placementType, pos.x, pos.y);
      this.selectComponent(comp);
      this.setMode('select');
      return;
    }
  }

  onMouseMove(e) {
    if (this.state.isPanning) {
      this.state.pan.x = e.clientX - this.state.panStart.x;
      this.state.pan.y = e.clientY - this.state.panStart.y;
      this.draw();
      return;
    }

    const pos = this.getCanvasPos(e);
    this.state.mousePos = pos;

    if (this.state.draggingComponent) {
      this.state.draggingComponent.x = this.snapToGrid(pos.x - this.state.dragOffset.x);
      this.state.draggingComponent.y = this.snapToGrid(pos.y - this.state.dragOffset.y);
      this.draw();
    } else if (this.state.wiringStartPin) {
      this.draw(); // Update temp wire
    }
  }

  onMouseUp(e) {
    if (this.state.isPanning) {
      this.state.isPanning = false;
    }
    if (this.state.draggingComponent) {
      this.state.draggingComponent = null;
    }
  }

  onKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.state.selectedComponent) {
        this.removeComponent(this.state.selectedComponent.id);
      } else if (this.state.selectedWire) {
        this.removeWire(this.state.selectedWire.id);
      }
    } else if (e.key === 'r' || e.key === 'R') {
      if (this.state.selectedComponent) {
        this.state.selectedComponent.rotation = (this.state.selectedComponent.rotation + 90) % 360;
        this.draw();
      }
    } else if (e.key === 'Escape') {
      this.setMode('select');
      this.selectComponent(null);
      this.selectWire(null);
      this.state.wiringStartPin = null;
      this.draw();
    }
  }

  handleComponentDown(e, comp) {
    e.stopPropagation();
    if (this.state.mode === 'select') {
      this.selectComponent(comp);
      const pos = this.getCanvasPos(e);
      this.state.draggingComponent = comp;
      this.state.dragOffset = { x: pos.x - comp.x, y: pos.y - comp.y };
    }
  }

  handlePinDown(e, comp, pinId) {
    e.stopPropagation();
    if (this.state.mode === 'select' || this.state.mode === 'wire') {
      this.setMode('wire');
      this.state.wiringStartPin = { compId: comp.id, pinId: pinId };
    }
  }

  handlePinUp(e, comp, pinId) {
    e.stopPropagation();
    if (this.state.mode === 'wire' && this.state.wiringStartPin) {
      const endPin = { compId: comp.id, pinId: pinId };
      this.addWire(this.state.wiringStartPin, endPin);
      this.state.wiringStartPin = null;
      this.state.tempWire = null;
      this.setMode('select');
    }
  }

  handleWireClick(e, wire) {
    e.stopPropagation();
    if (this.state.mode === 'select') {
      this.selectWire(wire);
    }
  }

  selectComponent(comp) {
    this.state.selectedComponent = comp;
    this.state.selectedWire = null;
    this.onSelectionChange({ type: 'component', item: comp });
    this.draw();
  }

  selectWire(wire) {
    this.state.selectedWire = wire;
    this.state.selectedComponent = null;
    this.onSelectionChange({ type: 'wire', item: wire });
    this.draw();
  }

  setMode(mode, type = null) {
    this.state.mode = mode;
    this.state.placementType = type;
    this.canvas.style.cursor = mode === 'place' ? 'copy' : (mode === 'wire' ? 'crosshair' : 'default');
    if (mode !== 'wire') {
      this.state.wiringStartPin = null;
    }
    this.draw();
  }

  // Callback to app.js
  onSelectionChange(selection) {
    // Overridden by app.js
  }

  draw() {
    // Clear canvas
    this.canvas.innerHTML = '';

    // Create a group for panning/zooming
    const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mainGroup.setAttribute('transform', `translate(${this.state.pan.x}, ${this.state.pan.y}) scale(${this.state.zoom})`);
    this.canvas.appendChild(mainGroup);

    // Draw wires
    this.wires.forEach(wire => {
      const startComp = this.components.find(c => c.id === wire.start.compId);
      const endComp = this.components.find(c => c.id === wire.end.compId);

      if (!startComp || !endComp) return; // Should not happen if delete handles it

      const startDef = this.definitions[startComp.type];
      const endDef = this.definitions[endComp.type];

      // Temporary simple render to get pin offsets (inefficient but works for now, we should cache)
      const startG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const startPins = startDef.render(startG);
      const startPinOffset = startPins.find(p => p.id === wire.start.pinId);

      const endG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const endPins = endDef.render(endG);
      const endPinOffset = endPins.find(p => p.id === wire.end.pinId);

      const p1 = this.getPinAbsolutePos(startComp, startPinOffset);
      const p2 = this.getPinAbsolutePos(endComp, endPinOffset);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      // Simple manhattan routing
      const midX = (p1.x + p2.x) / 2;
      path.setAttribute('d', `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`);
      path.setAttribute('class', `wire ${this.state.selectedWire && this.state.selectedWire.id === wire.id ? 'selected' : ''}`);

      // Voltage colors if simulation data exists
      if (wire.simColor) {
        path.style.stroke = wire.simColor;
      }

      path.addEventListener('mousedown', e => this.handleWireClick(e, wire));
      mainGroup.appendChild(path);

      // Add text label for current/voltage if exists
      if (wire.simLabel) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', p1.y - 5);
        text.setAttribute('class', 'node-voltage-label');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = wire.simLabel;
        mainGroup.appendChild(text);
      }
    });

    // Draw temporary wire
    if (this.state.wiringStartPin) {
      const startComp = this.components.find(c => c.id === this.state.wiringStartPin.compId);
      const startDef = this.definitions[startComp.type];
      const startG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const startPins = startDef.render(startG);
      const startPinOffset = startPins.find(p => p.id === this.state.wiringStartPin.pinId);
      const p1 = this.getPinAbsolutePos(startComp, startPinOffset);
      const p2 = this.state.mousePos;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midX = (p1.x + p2.x) / 2;
      path.setAttribute('d', `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`);
      path.setAttribute('class', 'wire selected');
      mainGroup.appendChild(path);
    }

    // Draw components
    this.components.forEach(comp => {
      const def = this.definitions[comp.type];
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`);
      g.setAttribute('class', `component-group ${this.state.selectedComponent && this.state.selectedComponent.id === comp.id ? 'selected' : ''}`);

      const pins = def.render(g);

      // Update label based on props
      const labelEl = g.querySelector('.component-label');
      if (labelEl) {
        let labelText = def.name[0];
        if (comp.props.resistance) labelText = comp.props.resistance.value + 'Ω';
        if (comp.props.voltage) labelText = comp.props.voltage.value + 'V';
        labelEl.textContent = labelText;
      }

      g.addEventListener('mousedown', e => this.handleComponentDown(e, comp));

      // Draw pins
      pins.forEach(pin => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pin.x);
        circle.setAttribute('cy', pin.y);
        circle.setAttribute('r', 3);
        circle.setAttribute('class', 'pin');

        circle.addEventListener('mousedown', e => this.handlePinDown(e, comp, pin.id));
        circle.addEventListener('mouseup', e => this.handlePinUp(e, comp, pin.id));

        g.appendChild(circle);
      });

      mainGroup.appendChild(g);
    });
  }
}
