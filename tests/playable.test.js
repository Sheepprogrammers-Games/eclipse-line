import assert from 'node:assert/strict';
import { LEVELS } from '../src/content/levels.js';
import { resolveWorld } from '../src/engine/resolve.js';
import { walkableFaces, faceKey } from '../src/engine/walkable.js';
import { buildGraph, findPath } from '../src/engine/path.js';
import { lightCount } from '../src/engine/lights.js';
import { faceCenter } from '../src/engine/aabb.js';
import { bodyOverlapsRaisedSolid, bodyPathClearsRaisedSolids } from '../src/engine/collision.js';
import { selectContextAction } from '../src/input/context.js';
import { dragCrate } from '../src/engine/crate.js';

function worldOf(lv, extras = {}, time = 0) {
  const first = resolveWorld(lv, time, { ...extras, shadows: lv.shadows || [] });
  const remain = (lv.shadows || []).filter(shadow => lightCount(first, { boxId: shadow.id, face: '+y' }) === 0);
  return resolveWorld(lv, time, { ...extras, shadows: remain });
}

function path(lv, extras = {}, from = null, time = 0) {
  const world = worldOf(lv, extras, time);
  const faces = walkableFaces(world, { walls: lv.walls });
  return findPath(
    buildGraph(world, faces, { walls: lv.walls }),
    from || { boxId: lv.spawn.boxId, face: '+y' },
    { boxId: lv.goal.boxId, face: '+y' }
  );
}

function lanternExtras(lv, pos, face = '+y') {
  const n = face === '-x' ? [-1, 0, 0]
    : face === '+x' ? [1, 0, 0]
      : face === '-z' ? [0, 0, -1]
        : face === '+z' ? [0, 0, 1]
          : [0, 1, 0];
  const out = face === '+y' ? 0 : 0.28;
  const enabled = Object.fromEntries((lv.lights || []).map(item => [item.id, item.id === 'porch' ? false : item.enabled !== false]));
  enabled.porch = false;
  return {
    enabled,
    lantern: {
      light: {
        id: 'lantern',
        type: 'point',
        origin: [pos[0] + n[0] * out, pos[1] + 1.05, pos[2] + n[2] * out],
        range: 3.4,
        enabled: true,
        ignoreBoxIds: ['player', ...(lv.lanternIgnore || [])],
        skipBoxIds: lv.lanternSkip || []
      }
    }
  };
}

function lanternReachable(lv, start) {
  const vis = new Set([faceKey(start)]);
  const queue = [start];
  const levers = {};
  while (queue.length) {
    const cur = queue.shift();
    const box = lv.boxes.find(item => item.id === cur.boxId);
    const c = faceCenter(box, cur.face);
    const extras = { ...lanternExtras(lv, c, cur.face), levers: { ...levers } };
    const world = worldOf(lv, extras);
    for (const sw of lv.switches || []) {
      if (sw.kind === 'lit' && world.closed?.[sw.id]) levers[sw.id] = true;
    }
    const faces = walkableFaces(world, { walls: lv.walls });
    const graph = buildGraph(world, faces, { walls: lv.walls });
    const node = graph.nodes.get(faceKey(cur));
    if (!node) continue;
    for (const next of node.neighbors) {
      const key = faceKey(next);
      if (vis.has(key)) continue;
      vis.add(key);
      queue.push(next);
    }
  }
  return vis;
}

function chaseLevel(lv, speed = 3.15, dt = 0.05, limit = 40) {
  const order = lv.boxes.filter(box => box.id.startsWith('s')).map(box => box.id);
  const boxes = Object.fromEntries(lv.boxes.map(box => [box.id, box]));
  let face = lv.spawn.boxId;
  let t = 0;
  let movingTo = null;
  let moveT = 0;
  let moveDur = 0;
  while (t < limit) {
    const world = worldOf(lv, {}, t);
    if (lightCount(world, { boxId: face, face: '+y' }) !== 1) return { ok: false, at: face, t };
    if (face === lv.goal.boxId && !movingTo) return { ok: true, t };
    if (movingTo) {
      moveT += dt;
      if (moveT >= moveDur) {
        face = movingTo;
        movingTo = null;
      }
    } else {
      const nextId = order[order.indexOf(face) + 1];
      if (nextId && lightCount(world, { boxId: nextId, face: '+y' }) === 1) {
        const a = faceCenter(boxes[face], '+y');
        const b = faceCenter(boxes[nextId], '+y');
        moveDur = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / speed;
        movingTo = nextId;
        moveT = 0;
      }
    }
    t += dt;
  }
  return { ok: false, at: face, t };
}

const byId = id => LEVELS.find(level => level.id === id);
const frozenShape = (start, tip) => {
  const length = Math.hypot(tip[0] - start[0], tip[2] - start[2]);
  return { start, tip, direction: [(tip[0] - start[0]) / length, 0, (tip[2] - start[2]) / length], length, width: 0.7 };
};

for (const level of LEVELS) {
  for (const time of [0, 0.5, 1, 2]) {
    const spawnWorld = worldOf(level, {}, time);
    assert.equal(
      lightCount(spawnWorld, { boxId: level.spawn.boxId, face: level.spawn.face || '+y' }),
      1,
      `${level.id} spawn must remain single-light safe at ${time}s`
    );
  }
}

const l1Path = [[3.43, 1, 2.3], [4.19, 1, 5.01], [4.41, 1.94, 5.8], [4.7, 1.94, 6.8]];
const l1Pin = {
  boxId: 'c',
  face: '+y',
  lightId: 'glow',
  origin: l1Path[0],
  shape: { ...frozenShape(l1Path[0], l1Path.at(-1)), length: 5.1, width: 0.78, path: l1Path }
};
const l1Shadow = {
  shadowMasks: [l1Pin],
  shadowCast: l1Pin
};
assert.equal(path(byId('L1')), null);
assert.equal(path(byId('L1'), l1Shadow), null);
assert.equal(path(byId('L1'), l1Shadow, { boxId: 'c', face: '+y' })?.length, 6);
const l1Pressed = worldOf(byId('L1'), l1Shadow);
assert.equal(l1Pressed.closed.shade, true);
assert.equal(l1Pressed.lights.find(light => light.id === 'sun')?.enabled, true, 'pinning must not mutate the high-platform light');
assert.equal(worldOf(byId('L1')).closed.shade, false, 'releasing the frozen shadow must release the marker without changing platform light');
assert.equal(path(byId('L1')), null);
assert.equal(path(byId('L4')), null);
assert.equal(path(byId('L4'), { levers: { noonGate: true } }), null);
assert.ok(path(byId('L4'), { levers: { noonGate: true }, yaw: { noon: 0.75 } }));
assert.equal(path(byId('L6')), null);
assert.equal(lightCount(resolveWorld(byId('L6'), 0), { boxId: 'hall', face: '+y' }), 1);
assert.equal(lightCount(resolveWorld(byId('L6'), 0), { boxId: 'pad', face: '+y' }), 1);
assert.equal(lightCount(resolveWorld(byId('L6'), 0), { boxId: 'neck', face: '+y' }), 0);
assert.equal(path(byId('L6'), { yaw: { fold: 0.95 } }), null);
assert.ok(path(byId('L6'), { yaw: { fold: 0.95 }, levers: { pad: true } }));
assert.equal(path(byId('L8')), null);
assert.equal(path(byId('L8'), { levers: { burnGate: true } }), null);
assert.ok(path(byId('L8'), { levers: { burnGate: true }, yaw: { burn: 0.7 } }));
assert.equal(path(byId('L5')), null);
assert.ok(path(byId('L5'), { yaw: { left: 0.18, right: -0.4 } }));

const l5 = byId('L5');
const l5Base = worldOf(l5);
assert.equal(lightCount(l5Base, { boxId: 'shade', face: '+y' }), 1);
assert.equal(l5Base.closed.shade, false);
const l5Shadow = worldOf(l5, {
  shadowMasks: [{ boxId: 'shade', face: '+y', lightId: 'left', origin: [1.2, 0.42, 1.2], shape: frozenShape([1.2, 0.42, 1.2], [3.83, 0.64, 0.48]) }]
});
assert.equal(lightCount(l5Shadow, { boxId: 'shade', face: '+y' }), 0);
assert.equal(l5Shadow.closed.shade, true);
assert.equal(l5Shadow.lights.find(light => light.id === 'right')?.enabled, true);
assert.equal(lightCount(l5Shadow, { boxId: 'west', face: '+y' }), 1);
assert.equal(path(byId('L10'), { yaw: { two: 0.7 } }), null);
assert.ok(path(byId('L10'), { yaw: { two: 0.7 }, levers: { sunPad: true } }));

const l2 = byId('L2');
assert.equal(path(l2), null);
const crate = l2.crates[0];
const l2Approach = { x: 3.68, y: 0.6, z: 2.4 };
assert.equal(bodyOverlapsRaisedSolid([crate], l2Approach, { radius: 0.31 }), false, 'L2 player must be able to stand beside the crate');
const nearestCratePoint = [
  Math.max(crate.min[0], Math.min(crate.max[0], l2Approach.x)),
  (crate.min[1] + crate.max[1]) / 2,
  Math.max(crate.min[2], Math.min(crate.max[2], l2Approach.z))
];
assert.equal(
  selectContextAction([{ kind: 'crate', id: crate.id, origin: nearestCratePoint }], l2Approach, { x: 1, z: 0 })?.id,
  crate.id,
  'L2 crate must remain interactable outside the body collision radius'
);
const pushedCrate = { ...crate, min: crate.min.slice(), max: crate.max.slice() };
for (let press = 0; press < 3; press += 1) dragCrate(pushedCrate, pushedCrate.axis, 0.55, pushedCrate.limit);
const dragged = {
  cratePos: {
    box: pushedCrate
  }
};
assert.ok(path(l2, dragged));
const pushedWorld = worldOf(l2, dragged);
assert.equal(lightCount(pushedWorld, { boxId: 'bridge', face: '+y' }), 1, 'three visible push actions must reveal the straight bridge');
assert.equal(
  bodyPathClearsRaisedSolids(
    pushedWorld.boxes,
    [[l2.spawn.x, l2.spawn.y, l2.spawn.z], [3.65, 0.6, 1.75], [5.6, 0.6, 1.75], [8.5, 0.6, 1.75], [10.4, 0.6, 2.4]],
    { radius: 0.31, height: 1.45 }
  ),
  true,
  'L2 must leave a body-width route around the pushed crate from spawn to goal'
);

const l3 = byId('L3');
const l3reach = lanternReachable(l3, { boxId: 'start', face: '+y' });
assert.ok(l3reach.has('end:+y'), 'L3 lantern chain should reach the goal');

const l7 = chaseLevel(byId('L7'));
assert.ok(l7.ok, `L7 chase should finish, died at ${l7.at} t=${l7.t}`);
assert.equal(path(byId('L7')), null, 'L7 goal must not be reachable by walking backward from spawn');
assert.equal(byId('L7').boxes.filter(box => box.id.startsWith('s')).length, 16);

const l9 = byId('L9');
const l9reach = lanternReachable(l9, { boxId: 'ground', face: '+y' });
assert.ok(l9reach.has('roof:+y'), `L9 climb should reach roof, got ${[...l9reach].join(',')}`);

console.log(JSON.stringify({ playable: 'ok', l7t: Number(l7.t.toFixed(2)), l9: [...l9reach].length }));
