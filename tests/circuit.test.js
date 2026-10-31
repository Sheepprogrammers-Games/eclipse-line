import assert from 'node:assert/strict';
import { switchClosed, closedSwitches, lightPowered, circuitEnabled } from '../src/engine/circuit.js';
import { resolveWorld } from '../src/engine/resolve.js';
import { lightCount } from '../src/engine/lights.js';

const floor = { id: 'a', min: [0, 0, 0], max: [2, 0.4, 2] };
const eye = { id: 'eye', min: [0.6, 0.4, 0.6], max: [1.4, 0.5, 1.4], walkable: false };
const lamp = {
  id: 'sun',
  type: 'spot',
  origin: [1, 3, 1],
  yaw: 0,
  tilt: 0,
  angle: Math.PI / 4,
  range: 8,
  enabled: false,
  power: 'gate'
};

assert.equal(switchClosed({ id: 'gate', kind: 'lever' }, { levers: { gate: true } }), true);
assert.equal(switchClosed({ id: 'gate', kind: 'lever' }, { levers: {} }), false);
assert.equal(switchClosed({ id: 'p', kind: 'plate', boxId: 'a' }, { face: { boxId: 'a' } }), true);
assert.equal(switchClosed({ id: 'p', kind: 'plate', boxId: 'a' }, { face: { boxId: 'b' } }), false);
assert.equal(switchClosed({ id: 'p', kind: 'plate', boxId: 'a' }, { levers: { p: true }, face: { boxId: 'b' } }), true);
assert.equal(switchClosed({ id: 'mark', kind: 'lit', boxId: 'eye' }, {}), false);
assert.equal(switchClosed(
  { id: 'shade', kind: 'shadow', origin: [1, 0.4, 1], shadowRadius: 0.6 },
  { shadowPose: { x: 1.3, y: 0.44, z: 1, boxId: 'a' } }
), true);
assert.equal(switchClosed(
  { id: 'shade', kind: 'shadow', origin: [1, 0.4, 1], shadowRadius: 0.6 },
  { shadowPose: { x: 3, y: 0.44, z: 1, boxId: 'a' } }
), false);
assert.equal(switchClosed(
  { id: 'relay', kind: 'shadow', requiresPose: true, origin: [1, 0.4, 1], shadowRadius: 0.6 },
  { shadowPose: null },
  { boxes: [{ id: 'relay', min: [0.6, 0.4, 0.6], max: [1.4, 0.5, 1.4], walkable: false }], lights: [] }
), false);
assert.equal(switchClosed(
  { id: 'legacy', kind: 'shadow', boxId: 'eye', face: '+y' },
  { shadowCast: { boxId: 'eye', face: '+y', shape: { length: 1 } } }
), true);

assert.equal(lightPowered('gate', { gate: true }), true);
assert.equal(lightPowered({ all: ['a', 'b'] }, { a: true, b: false }), false);
assert.equal(lightPowered({ any: ['a', 'b'] }, { a: false, b: true }), true);

const level = {
  boxes: [floor],
  lights: [lamp],
  switches: [{ id: 'gate', kind: 'lever' }]
};
const off = resolveWorld(level, 0, { levers: {} });
assert.equal(off.lights[0].enabled, false);
assert.equal(off.closed.gate, false);
const on = resolveWorld(level, 0, { levers: { gate: true } });
assert.equal(on.lights[0].enabled, true);
assert.equal(on.closed.gate, true);

const shadowLevel = {
  boxes: [floor, eye],
  lights: [
    {
      id: 'left',
      type: 'spot',
      origin: [1, 3, 1],
      direction: [0, -1, 0],
      angle: Math.PI / 5,
      range: 8,
      enabled: true
    },
    {
      id: 'right',
      type: 'spot',
      origin: [8, 3, 1],
      direction: [0, -1, 0],
      angle: Math.PI / 5,
      range: 8,
      enabled: false,
      power: 'shade'
    }
  ],
  switches: [{ id: 'shade', kind: 'shadow', boxId: 'eye', face: '+y' }]
};
const litEye = resolveWorld(shadowLevel, 0, {});
assert.equal(lightCount(litEye, { boxId: 'eye', face: '+y' }), 1);
assert.equal(litEye.closed.shade, false);
assert.equal(litEye.lights.find(item => item.id === 'right').enabled, false);

const wall = { id: 'wall', min: [0.2, 0.4, 0.2], max: [1.8, 2.8, 1.8], walkable: false };
const blocked = resolveWorld({ ...shadowLevel, boxes: [...shadowLevel.boxes, wall] }, 0, {});
assert.equal(lightCount(blocked, { boxId: 'eye', face: '+y' }), 0);
assert.equal(blocked.closed.shade, true);
assert.equal(blocked.lights.find(item => item.id === 'right').enabled, true);

const map = closedSwitches(level, { levers: { gate: true } });
assert.deepEqual(circuitEnabled(level, map, {}), { sun: true });

const disableLevel = {
  boxes: [floor],
  lights: [
    { id: 'main', type: 'point', origin: [1, 3, 1], range: 8, enabled: true, disabledBy: 'shade' }
  ],
  switches: [{ id: 'shade', kind: 'lever' }]
};
const disabled = resolveWorld(disableLevel, 0, { levers: { shade: true } });
assert.equal(disabled.lights[0].enabled, false);

assert.equal(switchClosed(
  { id: 'latchedShade', kind: 'shadow', latch: true },
  { levers: { latchedShade: true } }
), true);

console.log(JSON.stringify({ circuit: 'ok' }));
