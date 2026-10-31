import assert from 'node:assert/strict';
import { LEVELS } from '../src/content/levels.js';
import { resolveWorld } from '../src/engine/resolve.js';
import { lightCount } from '../src/engine/lights.js';
import { walkableFaces, faceKey } from '../src/engine/walkable.js';
import { buildGraph, findPath } from '../src/engine/path.js';
import { faceCenter } from '../src/engine/aabb.js';
import { foldShadowPath, freezeShadowShape, projectShadowPoint, shadowShapeAt, shadowTipNearTarget } from '../src/engine/shadow.js';
import { dragCrate } from '../src/engine/crate.js';

const byId = id => LEVELS.find(level => level.id === id);

function worldOf(level, state = {}, time = 0) {
  const first = resolveWorld(level, time, { ...state, shadows: level.shadows || [] });
  const shadows = (level.shadows || []).filter(shadow => (
    lightCount({ ...first, boxes: [...first.boxes, shadow] }, { boxId: shadow.id, face: '+y' }) === 0
  ));
  return resolveWorld(level, time, { ...state, shadows });
}

function route(level, state = {}, from = null, time = 0) {
  const world = worldOf(level, state, time);
  const faces = walkableFaces(world, { walls: level.walls });
  return findPath(
    buildGraph(world, faces, { walls: level.walls }),
    from || { boxId: level.spawn.boxId, face: level.spawn.face || '+y' },
    { boxId: level.goal.boxId, face: '+y' }
  );
}

function assertSpawnSafe(level) {
  const world = worldOf(level);
  assert.equal(
    lightCount(world, { boxId: level.spawn.boxId, face: level.spawn.face || '+y' }),
    1,
    `${level.id} must start on stable single-light paper`
  );
}

function lanternState(level, point, face = '+y', levers = {}) {
  const normal = face === '-x' ? [-1, 0, 0]
    : face === '+x' ? [1, 0, 0]
      : face === '-z' ? [0, 0, -1]
        : face === '+z' ? [0, 0, 1]
          : [0, 1, 0];
  const offset = face === '+y' ? 0 : 0.28;
  return {
    levers,
    enabled: Object.fromEntries((level.lights || []).map(light => [light.id, false])),
    lantern: {
      light: {
        id: 'lantern',
        type: 'point',
        origin: [point[0] + normal[0] * offset, point[1] + 1.05, point[2] + normal[2] * offset],
        range: 3.4,
        enabled: true,
        ignoreBoxIds: ['player', ...(level.lanternIgnore || [])],
        skipBoxIds: level.lanternSkip || []
      }
    }
  };
}

function lanternCanReachGoal(level) {
  const start = { boxId: level.spawn.boxId, face: level.spawn.face || '+y' };
  const seen = new Set([faceKey(start)]);
  const queue = [start];
  const levers = {};
  while (queue.length) {
    const current = queue.shift();
    if (current.boxId === level.goal.boxId) return true;
    const box = level.boxes.find(item => item.id === current.boxId);
    const point = faceCenter(box, current.face);
    const state = lanternState(level, point, current.face, { ...levers });
    let world = worldOf(level, state);
    for (const sw of level.switches || []) {
      if (sw.kind === 'lit' && world.closed?.[sw.id]) levers[sw.id] = true;
    }
    if (Object.keys(levers).length) world = worldOf(level, lanternState(level, point, current.face, { ...levers }));
    const graph = buildGraph(world, walkableFaces(world, { walls: level.walls }), { walls: level.walls });
    for (const next of graph.nodes.get(faceKey(current))?.neighbors || []) {
      const key = faceKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return false;
}

function lighthouseRun(level) {
  const order = level.boxes.filter(box => box.id.startsWith('s')).map(box => box.id);
  const boxes = Object.fromEntries(level.boxes.map(box => [box.id, box]));
  let current = level.spawn.boxId;
  let moving = null;
  let moveTime = 0;
  let moveDuration = 0;
  for (let time = 0; time < 42; time += 0.05) {
    const world = worldOf(level, {}, time);
    assert.equal(lightCount(world, { boxId: current, face: '+y' }), 1, `L7 lost the player at ${current}`);
    if (current === level.goal.boxId && !moving) return true;
    if (moving) {
      moveTime += 0.05;
      if (moveTime >= moveDuration) {
        current = moving;
        moving = null;
      }
      continue;
    }
    const next = order[order.indexOf(current) + 1];
    if (!next || lightCount(world, { boxId: next, face: '+y' }) !== 1) continue;
    const a = faceCenter(boxes[current], '+y');
    const b = faceCenter(boxes[next], '+y');
    moveDuration = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 3.15;
    moveTime = 0;
    moving = next;
  }
  return false;
}

LEVELS.forEach(assertSpawnSafe);

const l1 = byId('L1');
assert.equal(route(l1), null, 'L1 should require a pinned shadow ladder');
const l1Body = { x: 3.43, y: 1, z: 2.3 };
const l1Lamp = l1.lights.find(light => light.id === 'glow');
const l1Tip = projectShadowPoint(l1Body, l1Lamp, 1);
const foldedPath = foldShadowPath(
  [l1Body.x, l1Body.y, l1Body.z],
  [l1Tip.x, l1Tip.y, l1Tip.z],
  l1.boxes,
  { rampRun: l1.shadowControl.rampRun }
);
const foldedTip = foldedPath.at(-1);
assert.ok(foldedPath.length >= 4, 'L1 shadow must crease at the high platform edge');
assert.ok(foldedPath.some(point => point[1] >= 1.9), 'L1 folded shadow must reach the high platform top');
assert.ok(shadowTipNearTarget({ x: foldedTip[0], y: foldedTip[1], z: foldedTip[2] }, l1.shadowTargets[0]), 'L1 folded tip must land in the high marker');
const l1Shape = freezeShadowShape(l1Body, foldedTip, { width: 0.78, path: foldedPath });
assert.ok(l1Shape.length <= l1.shadowControl.pinMaxLength);
const lampDirection = [l1Lamp.origin[0] - l1Body.x, 0, l1Lamp.origin[2] - l1Body.z];
const lampHorizontal = Math.hypot(lampDirection[0], lampDirection[2]);
const lampAtDistance = distance => ({
  ...l1Lamp,
  origin: [
    l1Body.x + lampDirection[0] / lampHorizontal * distance,
    l1Lamp.origin[1],
    l1Body.z + lampDirection[2] / lampHorizontal * distance
  ]
});
const nearTip = projectShadowPoint(l1Body, lampAtDistance(l1Lamp.moveRange[0]), 1);
const farTip = projectShadowPoint(l1Body, lampAtDistance(l1Lamp.moveRange[1]), 1);
assert.ok(nearTip.distance < farTip.distance, 'bringing the lamp closer must shorten the physical shadow');
const frozenTip = l1Shape.tip.slice();
assert.notDeepEqual([farTip.x, farTip.y, farTip.z], frozenTip, 'moving the lamp must change the live projection');
assert.deepEqual(l1Shape.tip, frozenTip, 'moving the lamp must not mutate the pinned endpoint');
for (let segment = 1; segment < foldedPath.length; segment += 1) {
  const a = foldedPath[segment - 1];
  const b = foldedPath[segment];
  for (let step = 0; step <= 10; step += 1) {
    const t = step / 10;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    const hit = shadowShapeAt(l1Shape, x, z, 0.08, y);
    assert.ok(hit && Math.abs(hit.y - y) < 0.08, `L1 frozen fold must carry the player on segment ${segment} at t=${t}`);
  }
}
const l1Pinned = {
  shadowMasks: [{ boxId: 'c', face: '+y', lightId: 'glow', origin: l1Shape.start, shape: l1Shape }],
  shadowCast: { boxId: 'c', face: '+y', lightId: 'glow', origin: l1Shape.start, shape: l1Shape }
};
assert.equal(route(l1, l1Pinned), null, 'the static graph must not invent a ground-to-high-platform step');
assert.ok(route(l1, l1Pinned, { boxId: 'c', face: '+y' }), 'after climbing the frozen fold, the authored high route must reach the goal');

const l2 = byId('L2');
assert.equal(route(l2), null, 'L2 should begin with the crate blocking the route');
const crate = l2.crates[0];
const pushedCrate = { ...crate, min: crate.min.slice(), max: crate.max.slice() };
for (let press = 0; press < 3; press += 1) dragCrate(pushedCrate, pushedCrate.axis, 0.55, pushedCrate.limit);
assert.ok(route(l2, { cratePos: { box: pushedCrate } }), 'L2 default push action must reveal a route in three presses');

assert.equal(lanternCanReachGoal(byId('L3')), true, 'L3 lantern chain must be traversable');

const l4 = byId('L4');
assert.equal(route(l4), null);
assert.equal(route(l4, { levers: { noonGate: true } }), null);
assert.ok(route(l4, { levers: { noonGate: true }, yaw: { noon: 0.75 } }), 'L4 powered and aimed noon lamp must open');

const l5 = byId('L5');
const l5Body = { x: 3.2, y: 0.64, z: 0.12 };
const l5Tip = projectShadowPoint(l5Body, l5.lights.find(light => light.id === 'left'), 0.64);
assert.ok(shadowTipNearTarget(l5Tip, l5.shadowTargets[0]), 'L5 authored body/lamp pose must put the physical tip on the paper eye');
const l5Shape = freezeShadowShape(l5Body, l5Tip, { width: 0.66 });
assert.ok(l5Shape.length <= l5.shadowControl.pinMaxLength);
const l5Pin = { boxId: 'shade', face: '+y', lightId: 'left', origin: l5Shape.start, shape: l5Shape };
assert.equal(route(l5, { shadowMasks: [l5Pin], shadowCast: l5Pin }), null, 'L5 pin alone should only power the second lamp');
assert.ok(route(l5, { shadowMasks: [l5Pin], shadowCast: l5Pin, yaw: { left: 0.18, right: -0.4 } }), 'L5 pinned switch plus aimed lamps must open');

const l6 = byId('L6');
assert.equal(route(l6), null);
assert.equal(route(l6, { levers: { pad: true } }), null);
assert.ok(route(l6, { levers: { pad: true }, yaw: { fold: 0.95 } }), 'L6 powered mirror must complete the bridge');

assert.equal(lighthouseRun(byId('L7')), true, 'L7 authored chase timing must reach the goal');

const l8 = byId('L8');
assert.equal(route(l8), null);
assert.equal(route(l8, { levers: { burnGate: true } }), null);
assert.ok(route(l8, { levers: { burnGate: true }, yaw: { burn: 0.7 } }), 'L8 aimed burn lamp must clear both blockers');

assert.equal(lanternCanReachGoal(byId('L9')), true, 'L9 lantern climb and roof relay must be traversable');

const l10 = byId('L10');
assert.equal(route(l10, { yaw: { two: 0.7 } }), null);
assert.ok(route(l10, { yaw: { two: 0.7 }, levers: { sunPad: true } }), 'L10 final relay must open the eclipse route');

console.log(JSON.stringify({ campaign: 'ok', levels: LEVELS.length, frozenShadowLevels: ['L1', 'L5'] }));
