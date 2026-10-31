import assert from 'node:assert/strict';
import { createRunState, stamp, fall, inputLocked, checkpointIsSafe } from '../src/engine/checkpoint.js';

const spawn = { x: 1, y: 0.4, z: 1, boxId: 'floor', face: '+y' };
const state = createRunState(spawn, 0);
assert.equal(state.stamps.length, 1);
assert.equal(state.stamps[0].x, 1);
assert.equal(state.pose.boxId, 'floor');

stamp(state, { x: 4, y: 0.4, z: 1.2, boxId: 'floor', face: '+y' });
const result = fall(state, 'void', 2500);
assert.equal(result.pose.x, 4);
assert.equal(result.flash, 'black');
assert.equal(state.lockedUntil - 2500, 1000);
assert.equal(inputLocked(state, 2500), true);
assert.equal(inputLocked(state, 3500), false);

const white = fall(state, 'overexposure', 4000);
assert.equal(white.flash, 'white');
assert.ok(white.lockedUntil - 4000 <= 1000);

const floor = { id: 'floor', min: [0, 0, 0], max: [2, 0.4, 2] };
const safeWorld = {
  boxes: [floor],
  lights: [{ id: 'sun', type: 'directional', direction: [0, -1, 0], enabled: true }]
};
assert.equal(checkpointIsSafe(safeWorld, { pose: spawn }), true);
assert.equal(checkpointIsSafe({ boxes: [floor], lights: [] }, { pose: spawn }), false);
assert.equal(checkpointIsSafe(safeWorld, null), false);

console.log(JSON.stringify({ checkpoint: 'ok' }));
