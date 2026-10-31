import assert from 'node:assert/strict';
import { walkableFaces, faceKey } from '../src/engine/walkable.js';
import { buildGraph, findPath } from '../src/engine/path.js';

const a = { id: 'a', min: [0, 0, 0], max: [2, 0.4, 2] };
const b = { id: 'b', min: [2, 0, 0], max: [4, 0.4, 2] };
const sun = {
  id: 'sun',
  type: 'directional',
  origin: [2, 8, 1],
  direction: [0, -1, 0],
  enabled: true
};

const world = { boxes: [a, b], lights: [sun] };
const faces = walkableFaces(world, { walls: false });
assert.equal(faces.length, 2);
assert.ok(faces.every(face => face.face === '+y'));

const graph = buildGraph(world, faces);
const path = findPath(graph, { boxId: 'a', face: '+y' }, { boxId: 'b', face: '+y' });
assert.ok(path);
assert.equal(path.length, 2);
assert.equal(faceKey(path[0]), 'a:+y');
assert.equal(faceKey(path[1]), 'b:+y');

const extra = {
  id: 'hot',
  type: 'spot',
  origin: [3, 3, 1],
  direction: [0, -1, 0],
  angle: Math.PI / 3,
  range: 8,
  enabled: true
};
const over = { boxes: [a, b], lights: [sun, extra] };
const faces2 = walkableFaces(over, { walls: false });
assert.equal(faces2.length, 0);

const dark = { boxes: [a, b], lights: [] };
assert.equal(walkableFaces(dark, { walls: false }).length, 0);

const climb = { id: 'wall', min: [0, 0, 0], max: [0.5, 2.4, 2], climb: true };
const wallLit = {
  boxes: [climb],
  lights: [{
    id: 'side',
    type: 'directional',
    origin: [4, 1, 1],
    direction: [-1, 0, 0],
    enabled: true
  }]
};
assert.equal(
  walkableFaces(wallLit, { walls: false }).some(face => face.face === '+x'),
  false
);
assert.ok(walkableFaces(wallLit, { walls: true }).some(face => face.face === '+x'));

console.log(JSON.stringify({ path: 'ok' }));
