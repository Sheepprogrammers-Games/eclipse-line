import assert from 'node:assert/strict';
import { lightCount, lightsOnFace } from '../src/engine/lights.js';

const floor = { id: 'floor', min: [0, 0, 0], max: [4, 0.4, 4] };
const lamp = {
  id: 'lamp',
  type: 'spot',
  origin: [2, 3, 2],
  direction: [0, -1, 0],
  angle: Math.PI / 5,
  range: 8,
  enabled: true
};

assert.equal(lightCount({ boxes: [floor], lights: [] }, { boxId: 'floor', face: '+y' }), 0);
assert.equal(lightCount({ boxes: [floor], lights: [lamp] }, { boxId: 'floor', face: '+y' }), 1);
assert.equal(
  lightCount(
    { boxes: [floor], lights: [lamp, { ...lamp, id: 'lamp2', origin: [2.1, 3.1, 2.1] }] },
    { boxId: 'floor', face: '+y' }
  ),
  2
);

const patch = { id: 'patch', min: [1.6, 0, 1.6], max: [2.4, 0.4, 2.4] };
const occluder = { id: 'crate', min: [1.5, 0.45, 1.5], max: [2.5, 2.7, 2.5] };
assert.equal(
  lightCount({ boxes: [patch, occluder], lights: [lamp] }, { boxId: 'patch', face: '+y' }),
  0
);

const farLamp = { ...lamp, id: 'far', origin: [2, 20, 2], range: 4 };
assert.equal(lightCount({ boxes: [floor], lights: [farLamp] }, { boxId: 'floor', face: '+y' }), 0);

const offLamp = { ...lamp, enabled: false };
assert.equal(lightCount({ boxes: [floor], lights: [offLamp] }, { boxId: 'floor', face: '+y' }), 0);

const lantern = {
  id: 'lantern',
  type: 'point',
  origin: [2, 1.2, 2],
  range: 3,
  enabled: true,
  ignoreBoxIds: ['player']
};
const player = { id: 'player', min: [1.7, 0.4, 1.7], max: [2.3, 1.4, 2.3] };
assert.equal(
  lightCount({ boxes: [floor, player], lights: [lantern] }, { boxId: 'floor', face: '+y' }),
  1
);

const doubled = { boxes: [floor], lights: [lamp, { ...lamp, id: 'cross' }] };
assert.deepEqual(lightsOnFace(doubled, { boxId: 'floor', face: '+y' }).map(light => light.id), ['lamp', 'cross']);
assert.equal(lightCount({
  ...doubled,
  shadowMasks: [{
    boxId: 'floor', face: '+y', lightId: 'cross', origin: [0, 0.4, 0],
    shape: { start: [0, 0.4, 0], tip: [2, 0.4, 2], direction: [0.707, 0, 0.707], length: 2.828, width: 0.7 }
  }]
}, { boxId: 'floor', face: '+y' }), 1);

console.log(JSON.stringify({ lightCount: 'ok' }));
