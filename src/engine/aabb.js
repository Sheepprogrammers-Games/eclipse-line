/** @typedef {{ min: [number, number, number], max: [number, number, number], id?: string }} Box */
/** @typedef {'+x'|'-x'|'+y'|'-y'|'+z'|'-z'} FaceId */

export const FACE_IDS = Object.freeze(['+x', '-x', '+y', '-y', '+z', '-z']);

export function boxId(box, index = 0) {
  return box.id || `box-${index}`;
}

export function facesOf(box) {
  const id = boxId(box);
  return FACE_IDS.map(face => ({ boxId: id, face }));
}

function axisIndex(face) {
  return face[1] === 'x' ? 0 : face[1] === 'y' ? 1 : 2;
}

export function faceCenter(box, face) {
  const mid = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2
  ];
  const axis = axisIndex(face);
  mid[axis] = face[0] === '+' ? box.max[axis] : box.min[axis];
  return mid;
}

export function faceNormal(face) {
  const axis = axisIndex(face);
  const sign = face[0] === '+' ? 1 : -1;
  const n = [0, 0, 0];
  n[axis] = sign;
  return n;
}

export function faceSamples(box, face, inset = 0.15) {
  const axis = axisIndex(face);
  const others = [0, 1, 2].filter(index => index !== axis);
  const spanU = box.max[others[0]] - box.min[others[0]];
  const spanV = box.max[others[1]] - box.min[others[1]];
  const padU = Math.min(Math.max(inset, spanU * 0.28), spanU * 0.45);
  const padV = Math.min(Math.max(inset, spanV * 0.28), spanV * 0.45);
  const us = [box.min[others[0]] + padU, box.max[others[0]] - padU];
  const vs = [box.min[others[1]] + padV, box.max[others[1]] - padV];
  const points = [];
  for (const ua of us) {
    for (const vb of vs) {
      const p = [0, 0, 0];
      p[axis] = face[0] === '+' ? box.max[axis] : box.min[axis];
      p[others[0]] = ua;
      p[others[1]] = vb;
      points.push(p);
    }
  }
  return points;
}

export function rayHitsBox(origin, dir, box, minT = 1e-4, maxT = 1 - 1e-4) {
  let tMin = minT;
  let tMax = maxT;
  for (let axis = 0; axis < 3; axis += 1) {
    const d = dir[axis];
    if (Math.abs(d) < 1e-8) {
      if (origin[axis] < box.min[axis] || origin[axis] > box.max[axis]) return false;
      continue;
    }
    const inv = 1 / d;
    let t0 = (box.min[axis] - origin[axis]) * inv;
    let t1 = (box.max[axis] - origin[axis]) * inv;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    if (tMin > tMax) return false;
  }
  return true;
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function length(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function normalize(a) {
  const len = length(a) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}
