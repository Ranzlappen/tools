export class CircuitSimulator {
  constructor() {
    this.nodes = []; // List of unique nodes
    this.components = []; // Extracted components
  }

  // Extracts graph from the editor's raw components and wires
  extractCircuit(editorComponents, editorWires) {
    this.nodes = [];
    this.components = [];

    // First, find all connected pins. A node is a set of pins connected by wires.
    const pinSets = []; // Array of Set of pin strings like "compId_pinId"

    const getPinStr = (pin) => `${pin.compId}_${pin.pinId}`;

    editorWires.forEach(wire => {
      const p1 = getPinStr(wire.start);
      const p2 = getPinStr(wire.end);

      let set1 = pinSets.find(s => s.has(p1));
      let set2 = pinSets.find(s => s.has(p2));

      if (set1 && set2 && set1 !== set2) {
        // Merge sets
        set2.forEach(p => set1.add(p));
        pinSets.splice(pinSets.indexOf(set2), 1);
      } else if (set1) {
        set1.add(p2);
      } else if (set2) {
        set2.add(p1);
      } else {
        pinSets.push(new Set([p1, p2]));
      }
    });

    // Each standalone pin is also a node (not connected to any wire)
    editorComponents.forEach(comp => {
      let pinIds = [];
      if (comp.type === 'transformer') {
        pinIds = ['p1', 'p2', 'p3', 'p4'];
      } else if (comp.type !== 'ground') {
        pinIds = ['p1', 'p2'];
      } else if (comp.type === 'ground') {
        pinIds = ['p1'];
      }

      pinIds.forEach(pid => {
        const pStr = getPinStr({compId: comp.id, pinId: pid});
        if (!pinSets.find(s => s.has(pStr))) {
          pinSets.push(new Set([pStr]));
        }
      });
    });

    // Assign node IDs
    const pinToNode = {};
    let groundNodeId = null;

    pinSets.forEach((set, index) => {
      const nodeId = index;
      this.nodes.push(nodeId);
      set.forEach(pStr => {
        pinToNode[pStr] = nodeId;
        // Check if this pin belongs to a ground component
        const compId = pStr.split('_')[0];
        const comp = editorComponents.find(c => c.id === compId);
        if (comp && comp.type === 'ground') {
          groundNodeId = nodeId;
        }
      });
    });

    if (groundNodeId === null && this.nodes.length > 0) {
      throw new Error("Circuit has no ground. Please add a Ground component.");
    }

    // Now map components to nodes
    editorComponents.forEach(comp => {
      if (comp.type === 'resistor' || comp.type === 'bulb') {
        this.components.push({
          type: 'resistor',
          id: comp.id,
          originalType: comp.type,
          node1: pinToNode[`${comp.id}_p1`],
          node2: pinToNode[`${comp.id}_p2`],
          value: parseFloat(comp.props.resistance.value)
        });
      } else if (comp.type === 'dcvsource') {
        this.components.push({
          type: 'vsource',
          id: comp.id,
          originalType: comp.type,
          node1: pinToNode[`${comp.id}_p1`], // negative
          node2: pinToNode[`${comp.id}_p2`], // positive
          value: parseFloat(comp.props.voltage.value)
        });
      } else if (comp.type === 'switch') {
        const closed = parseFloat(comp.props.closed.value) > 0.5;
        this.components.push({
          type: 'resistor', // Switch modeled as a resistor
          id: comp.id,
          originalType: comp.type,
          node1: pinToNode[`${comp.id}_p1`],
          node2: pinToNode[`${comp.id}_p2`],
          value: closed ? 1e-6 : 1e9 // Very low or very high resistance
        });
      } else if (comp.type === 'capacitor') {
        // DC steady state: capacitor is an open circuit (very high resistance)
        this.components.push({
          type: 'resistor',
          id: comp.id,
          originalType: comp.type,
          node1: pinToNode[`${comp.id}_p1`],
          node2: pinToNode[`${comp.id}_p2`],
          value: 1e9 // 1 GigaOhm (open circuit approximation)
        });
      } else if (comp.type === 'inductor' || comp.type === 'ammeter') {
        // DC steady state: inductor/ammeter is a short circuit (very low resistance)
        this.components.push({
          type: 'resistor',
          id: comp.id,
          originalType: comp.type,
          node1: pinToNode[`${comp.id}_p1`],
          node2: pinToNode[`${comp.id}_p2`],
          value: 1e-6 // 1 microOhm (short circuit approximation)
        });
      } else if (comp.type === 'voltmeter') {
        // Voltmeter: high impedance
        this.components.push({
          type: 'resistor',
          id: comp.id,
          originalType: comp.type,
          node1: pinToNode[`${comp.id}_p1`],
          node2: pinToNode[`${comp.id}_p2`],
          value: 1e9 // 1 GigaOhm
        });
      } else if (comp.type === 'transformer') {
        // Ideal DC transformer logic is tricky. In steady state, a transformer
        // behaves as an open circuit unless driven by AC.
        // For simple DC simulator: Treat coils as low-resistance, but isolated.
        this.components.push({
          type: 'resistor',
          id: comp.id + '_primary',
          originalId: comp.id,
          originalType: comp.type,
          node1: pinToNode[`${comp.id}_p1`],
          node2: pinToNode[`${comp.id}_p2`],
          value: 1e-3
        });
        this.components.push({
          type: 'resistor',
          id: comp.id + '_secondary',
          originalId: comp.id,
          originalType: comp.type,
          node1: pinToNode[`${comp.id}_p3`],
          node2: pinToNode[`${comp.id}_p4`],
          value: 1e-3
        });
      }
    });

    return { groundNodeId, pinToNode };
  }

  // Solves the circuit using Modified Nodal Analysis (MNA)
  simulate(editorComponents, editorWires) {
    let groundNodeId, pinToNode;
    try {
      const res = this.extractCircuit(editorComponents, editorWires);
      groundNodeId = res.groundNodeId;
      pinToNode = res.pinToNode;
    } catch (e) {
      return { success: false, error: e.message };
    }

    const numNodes = this.nodes.length;
    // We need an equation for each node, plus an equation for each voltage source
    const vsources = this.components.filter(c => c.type === 'vsource');
    const numV = vsources.length;

    const size = numNodes + numV;
    const A = Array(size).fill(0).map(() => Array(size).fill(0));
    const z = Array(size).fill(0);

    // Build G matrix (conductances) and B/C matrices (voltage source connections)
    this.components.forEach(comp => {
      const n1 = comp.node1;
      const n2 = comp.node2;

      if (comp.type === 'resistor') {
        const g = 1.0 / comp.value;
        A[n1][n1] += g;
        A[n2][n2] += g;
        A[n1][n2] -= g;
        A[n2][n1] -= g;
      }
    });

    vsources.forEach((vs, idx) => {
      const vIdx = numNodes + idx;
      const n1 = vs.node1; // negative
      const n2 = vs.node2; // positive

      // B and C matrices
      A[n2][vIdx] += 1;
      A[n1][vIdx] -= 1;
      A[vIdx][n2] += 1;
      A[vIdx][n1] -= 1;

      // E vector (z)
      z[vIdx] = vs.value;
    });

    // Ground node equation: V_ground = 0
    // Replace the row and column for the ground node to enforce this.
    for (let i = 0; i < size; i++) {
      A[groundNodeId][i] = 0;
      A[i][groundNodeId] = 0;
    }
    A[groundNodeId][groundNodeId] = 1;
    z[groundNodeId] = 0;

    // Solve Ax = z using Gaussian elimination
    const x = this.solveMatrix(A, z);

    if (!x) {
      return { success: false, error: "Circuit is singular (e.g. short circuit across voltage source or floating components)." };
    }

    // Process results
    const nodeVoltages = x.slice(0, numNodes);
    const vsourceCurrents = x.slice(numNodes);

    // Calculate component currents/power
    const results = {
      nodeVoltages: {},
      components: {},
      wires: {} // Map wire ID to current or voltage
    };

    nodeVoltages.forEach((v, idx) => {
      results.nodeVoltages[idx] = v;
    });

    this.components.forEach(comp => {
      const v1 = nodeVoltages[comp.node1];
      const v2 = nodeVoltages[comp.node2];
      const vDrop = v2 - v1;
      let current = 0;

      if (comp.type === 'resistor') {
        current = vDrop / comp.value;
      } else if (comp.type === 'vsource') {
        const vIdx = vsources.indexOf(comp);
        current = vsourceCurrents[vIdx];
      }

      const power = Math.abs(vDrop * current);

      let warning = null;
      if (comp.originalType === 'resistor' && power > 0.25) { // 1/4 watt resistor limit
        warning = `Power rating exceeded! (${power.toFixed(2)}W > 0.25W)`;
      } else if (comp.originalType === 'bulb' && power > 10) {
        warning = `Bulb burnt out! (${power.toFixed(2)}W > 10W)`;
      }

      // Handle components mapped to multiple primitives (like transformer)
      const targetId = comp.originalId || comp.id;
      if (!results.components[targetId]) {
        results.components[targetId] = { voltageDrop: 0, current: 0, power: 0, warning: null };
      }

      // Aggregate for multi-primitive components, overwrite for single primitive
      if (comp.originalType === 'transformer') {
        results.components[targetId].power += power;
      } else {
        results.components[targetId] = {
          voltageDrop: vDrop,
          current: current,
          power: power,
          warning: warning
        };
      }
    });

    // Annotate wires with voltage
    editorWires.forEach(wire => {
      const pinStr = `${wire.start.compId}_${wire.start.pinId}`;
      const nodeId = pinToNode[pinStr];
      const voltage = nodeVoltages[nodeId];

      // Map voltage to a color: e.g., Ground(0V) = black, Positive = red, Negative = blue
      let color = 'var(--text-2)';
      if (Math.abs(voltage) < 1e-6) color = '#10b981'; // green for ground
      else if (voltage > 0) color = '#ef4444'; // red for positive
      else color = '#3b82f6'; // blue for negative

      results.wires[wire.id] = {
        voltage: voltage,
        color: color,
        label: `${voltage.toFixed(2)}V`
      };
    });

    return { success: true, data: results };
  }

  // Gaussian elimination
  solveMatrix(A, b) {
    const n = A.length;
    // Augment matrix
    for (let i = 0; i < n; i++) {
      A[i].push(b[i]);
    }

    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      // Check for singularity
      if (maxEl < 1e-10) {
        return null;
      }

      // Swap rows
      const tmp = A[maxRow];
      A[maxRow] = A[i];
      A[i] = tmp;

      // Eliminate
      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < n + 1; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
      }
    }

    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = A[i][n] / A[i][i];
      for (let k = i - 1; k >= 0; k--) {
        A[k][n] -= A[k][i] * x[i];
      }
    }
    return x;
  }
}
