import assert from 'node:assert/strict';
import {
  cloneShadowPose,
  clampShadowToTether,
  foldShadowPath,
  freezeShadowShape,
  nearestShadowSurface,
  projectShadowPoint,
  shadowProjection,
  shadowShapeAt,
  shadowHitBlockedBySolid,
  shadowRay,
  shadowSurfaceAt,
  shadowSurfacePath,
  shadowPoseNearSwitch,
  shadowTipNearTarget,
  shadowPoseSignature,
  swapShadowPositions
} from '../src/engine/shadow.js';

const light = { id: 'lamp', origin: [0, 4, 0] };
const body = { x: 1, y: 0.4, z: 1 };

const projected = projectShadowPoint(body, light, 0.4, { height: 1.02 });
assert.ok(projected);
assert.equal(projected.lightId, 'lamp');
assert.ok(projected.x > body.x);
assert.ok(projected.z > body.z);
const projection = shadowProjection(body, light, 0.4, { height: 1.02 });
assert.ok(projection);
assert.deepEqual([projection.endpoint[0], projection.endpoint[2]], [projected.x, projected.z]);
assert.ok(Math.abs(projection.length - projected.distance) < 1e-9);
assert.ok(projection.source[1] > body.y);
const frozen = freezeShadowShape([1, 0.4, 1], [4, 0.4, 5], { width: 0.8 });
assert.ok(frozen);
assert.equal(frozen.length, 5);
assert.equal(frozen.width, 0.8);
assert.equal(Object.isFrozen(frozen), true);
assert.equal(Object.isFrozen(frozen.tip), true);
assert.equal(freezeShadowShape([1, 0, 1], [1, 0, 1]), null);
assert.ok(shadowShapeAt(frozen, 1, 1));
assert.ok(shadowShapeAt(frozen, 2.5, 3));
assert.ok(shadowShapeAt(frozen, 4, 5));
assert.equal(shadowShapeAt(frozen, 4.8, 5.8), null);
assert.equal(shadowShapeAt(frozen, 2.5, 4.2), null);
assert.equal(projectShadowPoint(body, { origin: [0, 0.4, 0] }, 0.4), null);
assert.equal(projectShadowPoint(body, { origin: [0, 5, 0] }, 0.4, { maxDistance: 0.01 }), null);

const foldedPath = foldShadowPath(
  [0, 1, 0],
  [0, 1, 6],
  [{ id: 'high', min: [-1, 1, 4], max: [1, 2, 7], role: 'solid' }],
  { rampRun: 0.8 }
);
assert.ok(foldedPath.length >= 4);
assert.ok(foldedPath.some(point => point[1] === 2));
const upperLanding = foldedPath.find(point => point[1] === 2);
assert.ok(upperLanding[2] <= 3.72, `upper landing must clear the wall before z=4, got ${upperLanding[2]}`);
assert.ok(foldedPath.some(point => point[1] === 2 && point[2] >= 4), 'fold must continue from the landing onto the high top');
const folded = freezeShadowShape([0, 1, 0], foldedPath.at(-1), { width: 0.7, path: foldedPath });
assert.equal(Object.isFrozen(folded.path), true);
assert.equal(Object.isFrozen(folded.path[0]), true);
const rampA = foldedPath[1];
const rampB = foldedPath[2];
const lowRamp = shadowShapeAt(folded, (rampA[0] * 3 + rampB[0]) / 4, (rampA[2] * 3 + rampB[2]) / 4, 0.02, 1.25);
const highRamp = shadowShapeAt(folded, (rampA[0] + rampB[0] * 3) / 4, (rampA[2] + rampB[2] * 3) / 4, 0.02, 1.75);
assert.ok(lowRamp.y < highRamp.y);
const justPastCrease = shadowShapeAt(
  folded,
  rampA[0] + (rampB[0] - rampA[0]) * 0.12,
  rampA[2] + (rampB[2] - rampA[2]) * 0.12,
  0.16,
  1
);
assert.ok(justPastCrease.y > 1.08, 'the low segment must not extend through the internal crease');
const raisedWall = { id: 'high', min: [-1, 1, 4], max: [1, 2, 7], role: 'solid' };
assert.equal(
  shadowHitBlockedBySolid([raisedWall], { x: 0, y: 1, z: 4.04 }),
  true,
  'a widened low shadow must never carry the player inside a raised platform wall'
);
assert.equal(shadowHitBlockedBySolid([raisedWall], { x: 0, y: 2, z: 4.04 }), false, 'the same shadow remains valid on the platform top');
assert.equal(shadowHitBlockedBySolid([raisedWall], { x: 0, y: 1, z: 3.7 }), false, 'the exterior ramp remains traversable');
const foldedClone = cloneShadowPose({ x: 1, y: 0.435, z: 1, boxId: 'near', face: '+y', path: foldedPath });
assert.deepEqual(foldedClone.path, foldedPath);
assert.notEqual(foldedClone.path, foldedPath);

const world = {
  boxes: [
    { id: 'near', min: [0, 0, 0], max: [2, 0.4, 2], role: 'solid' },
    { id: 'far', min: [4, 1, 4], max: [6, 1.4, 6], role: 'goal' },
    { id: 'fixture', min: [0, 0.4, 0], max: [1, 1.2, 1], role: 'solid', walkable: false }
  ]
};
const surface = nearestShadowSurface(world, projected, 0.4);
assert.equal(surface.boxId, 'near');
assert.equal(surface.face, '+y');
assert.ok(Math.abs(surface.y - 0.435) < 1e-9);
assert.equal(nearestShadowSurface(world, { x: 100, y: 0, z: 100 }, 0.4), null);

const pose = { x: 1, y: 0.435, z: 1, boxId: 'near', face: '+y', yaw: 0.25, detached: true, lightId: 'lamp' };
const sw = { id: 'eye', kind: 'shadow', origin: [1.45, 0.4, 1], shadowRadius: 0.5 };
assert.equal(shadowPoseNearSwitch(pose, sw), true);
assert.equal(shadowPoseNearSwitch({ ...pose, x: 2.2 }, sw), false);
assert.equal(shadowPoseNearSwitch(pose, { ...sw, origin: null }, null), false);
assert.equal(shadowTipNearTarget(pose, { origin: [1.45, 0.4, 1], captureRadius: 0.5 }), true);
assert.equal(shadowTipNearTarget({ ...pose, z: 2 }, { origin: [1.45, 0.4, 1], captureRadius: 0.5 }), false);
assert.equal(shadowTipNearTarget(pose, { boxId: 'missing-origin' }), false);

const cloned = cloneShadowPose(pose);
assert.deepEqual(cloned, pose);
assert.notEqual(cloned, pose);
assert.equal(shadowPoseSignature(pose), 'near:20:20');
assert.equal(shadowPoseSignature(null), 'none');

const ray = shadowRay(body, light, { height: 1.02 });
assert.ok(ray);
assert.equal(ray.lightId, 'lamp');
assert.ok(ray.direction[1] < 0);

const routeWorld = {
  boxes: [
    { id: 'near', min: [0, 0, 0], max: [3, 0.4, 2], role: 'solid' },
    { id: 'far', min: [3, 0.7, 0], max: [6, 1.1, 2], role: 'solid' },
    { id: 'dark', min: [6, 0, 0], max: [8, 0.4, 2], role: 'solid' }
  ]
};
const routeLight = { id: 'route', origin: [-2, 4, 1] };
const route = shadowSurfacePath(routeWorld, { x: 1, y: 0.4, z: 1 }, routeLight, {
  floorY: 0.4,
  maxDistance: 12,
  maxStep: 2
});
assert.ok(route.length >= 1);
assert.equal(route[0].boxId, 'near');
assert.equal(shadowSurfaceAt(routeWorld, { x: 1, y: 0.4, z: 1 }, routeLight, {
  floorY: 0.4,
  maxDistance: 12,
  maxStep: 2
}).boxId, 'near');

const tethered = clampShadowToTether({ x: 10, y: 0.4, z: 0 }, { x: 0, y: 0.4, z: 0 }, 3);
assert.equal(tethered.clamped, true);
assert.ok(Math.abs(tethered.x - 3) < 1e-9);
assert.equal(clampShadowToTether({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 3).clamped, false);

const swapped = swapShadowPositions(
  { x: 1, y: 0.4, z: 1, boxId: 'body', face: '+y', yaw: 0.2 },
  { x: 4, y: 0.9, z: 2, boxId: 'shadow', face: '+y', yaw: -0.4, detached: true, lightId: 'lamp' }
);
assert.deepEqual(swapped.body, {
  x: 4, y: 0.9, z: 2, boxId: 'shadow', face: '+y', yaw: -0.4, detached: false, lightId: 'lamp'
});
assert.equal(swapped.shadow.boxId, 'body');
assert.equal(swapped.shadow.detached, true);
assert.deepEqual(swapped.anchor, { x: 1, y: 0.4, z: 1, boxId: 'body', face: '+y', yaw: 0.2 });
assert.equal(swapShadowPositions(null, swapped.shadow), null);

console.log(JSON.stringify({ shadow: 'ok' }));
