import { boxId, faceSamples, rayHitsBox, sub, length, normalize, dot, faceNormal } from './aabb.js';

function findBox(world, id) {
  return world.boxes.find(box => boxId(box) === id) || null;
}

function lightEnabled(light) {
  return light.enabled !== false;
}

function masked(world, light, face, box) {
  const id = box ? boxId(box) : '';
  return (world.shadowMasks || []).some(mask => (
    mask?.shape
    && Number(mask.shape.length) >= 0.05
    && mask?.boxId === id
    && (!mask.face || mask.face === face)
    && (!mask.lightId || mask.lightId === light.id)
  ));
}

function inRange(light, point) {
  if (light.type === 'directional') return true;
  const range = Number(light.range) || 0;
  if (range <= 0) return false;
  return length(sub(point, light.origin)) <= range + 1e-6;
}

function inCone(light, point) {
  if (light.type !== 'spot') return true;
  const dir = normalize(light.direction || [0, -1, 0]);
  const toPoint = normalize(sub(point, light.origin));
  const angle = Number(light.angle) || Math.PI / 6;
  return dot(dir, toPoint) >= Math.cos(angle) - 1e-6;
}

function halfSpace(light, point) {
  if (light.plane?.point && light.plane?.normal) {
    return dot(normalize(light.plane.normal), sub(point, light.plane.point)) >= -1e-6;
  }
  if (light.type !== 'virtual' || !light.direction) return true;
  return dot(normalize(light.direction), sub(point, light.origin)) >= -1e-6;
}

function occluded(world, light, point) {
  const origin = light.origin;
  if (!origin) return false;
  const delta = sub(point, origin);
  const dist = length(delta);
  if (dist < 1e-5) return false;
  const dir = normalize(delta);
  const ignore = new Set(light.ignoreBoxIds || []);
  const bodies = [...(world.boxes || []), ...(world.occluders || [])];
  for (const box of bodies) {
    const id = boxId(box);
    if (ignore.has(id)) continue;
    if (rayHitsBox(origin, dir, box, 1e-4, dist - 1e-4)) return true;
  }
  return false;
}

function lightHitsSample(world, light, sample, face, box) {
  if (!lightEnabled(light)) return false;
  if (box && Array.isArray(light.onlyBoxIds) && !light.onlyBoxIds.includes(boxId(box))) return false;
  if (box && (light.skipBoxIds || []).includes(boxId(box))) return false;
  if (masked(world, light, face, box)) return false;
  if (!inRange(light, sample) || !inCone(light, sample) || !halfSpace(light, sample)) return false;
  const n = faceNormal(face);
  const toLight = light.type === 'directional'
    ? normalize(light.direction ? light.direction.map(v => -v) : [0, 1, 0])
    : normalize(sub(light.origin, sample));
  if (dot(n, toLight) <= 0.02) return false;
  if (light.type !== 'directional' && occluded(world, light, sample)) return false;
  return true;
}

export function lightHitsFace(world, light, faceRef) {
  const box = findBox(world, faceRef.boxId);
  if (!box || !light) return false;
  const samples = faceSamples(box, faceRef.face);
  const needed = Math.max(1, Math.ceil(samples.length / 2));
  const hits = samples.filter(sample => lightHitsSample(world, light, sample, faceRef.face, box)).length;
  return hits >= needed;
}

export function lightCount(world, faceRef) {
  return lightsOnFace(world, faceRef).length;
}

export function lightsOnFace(world, faceRef) {
  const box = findBox(world, faceRef.boxId);
  if (!box) return [];
  const samples = faceSamples(box, faceRef.face);
  const needed = Math.max(1, Math.ceil(samples.length / 2));
  return (world.lights || []).filter(light => {
    const hits = samples.filter(sample => lightHitsSample(world, light, sample, faceRef.face, box)).length;
    return hits >= needed;
  });
}

export function countsForWorld(world) {
  const map = new Map();
  (world.boxes || []).forEach((box, index) => {
    const id = boxId(box, index);
    for (const face of ['+x', '-x', '+y', '-y', '+z', '-z']) {
      map.set(`${id}:${face}`, lightCount(world, { boxId: id, face }));
    }
  });
  return map;
}
