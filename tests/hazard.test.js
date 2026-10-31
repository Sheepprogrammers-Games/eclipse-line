import assert from 'node:assert/strict';
import { hazardAtPoint } from '../src/engine/hazard.js';

const spikes = [{ id: 'pit', type: 'spikes', x: 2, z: 4, w: 4, d: 2 }];
assert.equal(hazardAtPoint(spikes, 1.9, 5), null);
assert.equal(hazardAtPoint(spikes, 4, 5)?.kind, 'spikes');
assert.equal(hazardAtPoint(spikes, 2.01, 5, 0.04), null);
assert.equal(hazardAtPoint(spikes, 5.9, 5, 0.04)?.id, 'pit');
assert.equal(hazardAtPoint(spikes, 2.12, 5, 0.18), null, 'edge contact keeps a forgiving rim');
assert.equal(hazardAtPoint(spikes, 2.3, 5, 0.18)?.kind, 'spikes', 'moving clearly into the pit still kills');
assert.equal(hazardAtPoint([], 4, 5), null);

console.log(JSON.stringify({ hazard: 'ok' }));
