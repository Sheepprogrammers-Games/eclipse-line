import { FACE_IDS, boxId } from './aabb.js';
import { countsForWorld } from './lights.js';

export function faceKey(ref) {
  return `${ref.boxId}:${ref.face}`;
}

export function isWalkRole(box) {
  if (box.walkable === false) return false;
  const role = box.role || 'solid';
  return role === 'solid' || role === 'floor' || role === 'goal';
}

export function isClimbBox(box) {
  if (!box) return false;
  if (box.climb === true) return true;
  return (box.max[1] - box.min[1]) >= 0.7;
}

export function walkableFaces(world, { walls = false } = {}) {
  const counts = countsForWorld(world);
  const out = [];
  (world.boxes || []).forEach((box, index) => {
    if (!isWalkRole(box)) return;
    const id = boxId(box, index);
    for (const face of FACE_IDS) {
      if (face === '-y') continue;
      if (face !== '+y' && (!walls || !isClimbBox(box))) continue;
      if ((counts.get(`${id}:${face}`) || 0) === 1) {
        out.push({ boxId: id, face });
      }
    }
  });
  return out;
}

export function parseFaceKey(key) {
  const i = key.lastIndexOf(':');
  return { boxId: key.slice(0, i), face: key.slice(i + 1) };
}
