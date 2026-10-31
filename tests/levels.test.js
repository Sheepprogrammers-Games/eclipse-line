import assert from 'node:assert/strict';
import { LEVELS } from '../src/content/levels.js';
import { COPY } from '../src/content/copy.js';
import { walkableFaces } from '../src/engine/walkable.js';
import { buildGraph, findPath } from '../src/engine/path.js';
import { resolveWorld } from '../src/engine/resolve.js';
import { shadowPoseNearSwitch, shadowSurfaceAt } from '../src/engine/shadow.js';

// 原有十关必须始终在册且保持先后顺序，新增关卡插在其间不算破坏。
const CORE_ORDER = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'];
assert.ok(LEVELS.length >= CORE_ORDER.length, '关卡不得少于原有十关');
assert.deepEqual(LEVELS.map(level => level.id).filter(id => CORE_ORDER.includes(id)), CORE_ORDER);
assert.equal(new Set(LEVELS.map(level => level.id)).size, LEVELS.length, '关卡 ID 不得重复');

const byId = id => LEVELS.find(level => level.id === id);
const l1 = byId('L1');
assert.equal(l1.lights.length, 2);
assert.equal((l1.crates || []).length, 0);
assert.equal(l1.shadowCast, true);
assert.equal(l1.shadowTargets?.[0]?.boxId, 'c');
assert.deepEqual(l1.shadowTargets?.[0]?.origin, [4.7, 1.94, 6.8]);
assert.equal(l1.hazards?.[0]?.type, 'spikes');
assert.ok(l1.boxes.find(item => item.id === 'c').max[1] - l1.boxes.find(item => item.id === 'a').max[1] > 0.85);
assert.notEqual(l1.switches?.find(item => item.id === 'shade')?.requiresPose, true);
assert.equal(l1.shadowControl?.swap, false);
assert.equal(l1.shadowTargets[0].lightId, 'glow');
assert.equal(l1.lights.some(item => item.disabledBy === 'shade'), false, 'L1 release must not toggle the safe platform light');

const l2 = byId('L2');
assert.equal((l2.crates || []).length, 1);
assert.deepEqual(l2.boxes.map(box => box.id), ['west', 'bay', 'bridge', 'east']);
assert.deepEqual([...new Set(l2.boxes.map(box => box.max[1]))], [0.6], 'L2 route must be completely level');
assert.deepEqual(l2.crates[0].limit, [0.9, 4], 'L2 push direction must lead into the visible side bay');

const l3 = byId('L3');
assert.equal(l3.lantern, true);

const l6 = byId('L6');
assert.equal((l6.mirrors || []).length, 1);

const l7 = byId('L7');
assert.equal(l7.goal.boxId, 's15');
assert.equal(l7.boxes.filter(box => box.id.startsWith('s')).length, 16);
assert.equal(l7.monument?.kind, 'lighthouse');

const l10 = byId('L10');
assert.equal(l10.monument?.kind, 'eclipse');

for (const level of LEVELS) {
  assert.ok(level.boxes.length <= 48, level.id);
  assert.ok(level.lights.length <= 4, level.id);
}

const chinese = /[\u4e00-\u9fff]/;
const blob = JSON.stringify(COPY);
assert.ok(chinese.test(blob));
assert.equal(/TODO|lorem|Click|Game Over/i.test(blob), false);
for (const line of COPY.chapterLines) {
  assert.ok(chinese.test(line));
}
assert.ok(chinese.test(COPY.hiddenLine));
assert.equal(COPY.chapterLines.length, 4);

const world = resolveWorld(l1, 0);
const glow = world.lights.find(light => light.id === l1.shadowControl.lightId);
const initialShadow = shadowSurfaceAt(world, l1.spawn, glow, {
  height: l1.shadowControl.height || 1.02,
  floorY: l1.spawn.y,
  maxDistance: l1.shadowControl.maxDistance,
  maxGap: l1.shadowControl.maxGap,
  maxStep: l1.shadowControl.maxStep || 2.4
});
assert.equal(initialShadow?.boxId, 'b');
const shade = l1.switches.find(item => item.id === 'shade');
const shadePose = {
  x: shade.origin[0],
  y: shade.origin[1],
  z: shade.origin[2],
  boxId: shade.boxId,
  face: shade.face,
  detached: true,
  lightId: glow.id
};
assert.equal(shadowPoseNearSwitch(shadePose, shade, world, l1.shadowControl.switchRadius), true);
const faces = walkableFaces(world, { walls: false });
const graph = buildGraph(world, faces);
const dark = findPath(graph, { boxId: 'a', face: '+y' }, { boxId: 'd', face: '+y' });
assert.equal(dark, null);

const lit = resolveWorld(l1, 0);
const litPath = findPath(buildGraph(lit, walkableFaces(lit, { walls: false })), { boxId: 'a', face: '+y' }, { boxId: 'd', face: '+y' });
assert.equal(litPath, null);

const shadowed = resolveWorld(l1, 0, {
  shadowMasks: [{
    boxId: 'c', face: '+y', lightId: 'glow', origin: [3.43, 1, 2.3],
    shape: {
      start: [3.43, 1, 2.3], tip: [4.7, 1.94, 6.8], direction: [0.27, 0, 0.96], length: 5.1, width: 0.78,
      path: [[3.43, 1, 2.3], [4.19, 1, 5.01], [4.41, 1.94, 5.8], [4.7, 1.94, 6.8]]
    }
  }]
});
const shadowGraph = buildGraph(shadowed, walkableFaces(shadowed, { walls: false }));
const shadowPath = findPath(shadowGraph, { boxId: 'c', face: '+y' }, { boxId: 'd', face: '+y' });
assert.equal(findPath(shadowGraph, { boxId: 'a', face: '+y' }, { boxId: 'd', face: '+y' }), null);
assert.equal(shadowPath?.length, 6);

for (const level of LEVELS) {
  assert.ok((level.views || []).length >= 1, level.id);
}

console.log(JSON.stringify({ levels: 'ok', l1path: shadowPath.length }));
