import assert from 'node:assert/strict';
import { selectContextAction } from '../src/input/context.js';

const pose = { x: 0, y: 0.4, z: 0 };
const facing = { x: 1, z: 0 };
const candidates = [
  { kind: 'lamp', id: 'lamp', origin: [2.1, 1.8, 0] },
  { kind: 'crate', id: 'crate', origin: [2.35, 1.2, 0] },
  { kind: 'lever', id: 'behind', origin: [-1.2, 0.4, 0] }
];

assert.equal(selectContextAction(candidates, pose, facing)?.id, 'crate');
assert.equal(selectContextAction(candidates.slice(0, 2), pose, facing)?.id, 'crate');
assert.equal(selectContextAction([{ kind: 'lamp', id: 'near', origin: [1, 1, 0] }], pose, facing)?.id, 'near');
assert.equal(selectContextAction([{ kind: 'lamp', id: 'far', origin: [4, 1, 0] }], pose, facing), null);
assert.equal(selectContextAction([{ kind: 'pickup', id: 'high', origin: [1, 4, 0] }], pose, facing), null);
assert.equal(selectContextAction([{ kind: 'lever', id: 'off', origin: [1, 0.4, 0], disabled: true }], pose, facing), null);
assert.equal(selectContextAction([{ kind: 'mirror', id: 'custom', origin: [3.5, 1, 0], radius: 4 }], pose, facing)?.id, 'custom');

console.log(JSON.stringify({ context: 'ok' }));
