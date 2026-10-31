import * as THREE from 'three';
import { boxId, FACE_IDS, faceCenter, faceNormal } from '../engine/aabb.js';

const SEAM_CORE = 0xfffdf6;
const SEAM_GLOW = 0xfff6e2;

function edgeKey(a, b) {
  const pa = a.map(v => v.toFixed(3)).join(',');
  const pb = b.map(v => v.toFixed(3)).join(',');
  return pa < pb ? `${pa}|${pb}` : `${pb}|${pa}`;
}

function corners(box, face) {
  const n = faceNormal(face);
  const axis = n[0] ? 0 : n[1] ? 1 : 2;
  const [u, v] = [0, 1, 2].filter(i => i !== axis);
  const plane = face[0] === '+' ? box.max[axis] : box.min[axis];
  const pts = [];
  for (const ua of [box.min[u], box.max[u]]) {
    for (const vb of [box.min[v], box.max[v]]) {
      const p = [0, 0, 0];
      p[axis] = plane;
      p[u] = ua;
      p[v] = vb;
      pts.push(p);
    }
  }
  return [
    [pts[0], pts[1]],
    [pts[1], pts[3]],
    [pts[3], pts[2]],
    [pts[2], pts[0]]
  ];
}

function pushRibbon(positions, a, b, n, width, lift) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  let sx = (dy * n[2] - dz * n[1]) / len;
  let sy = (dz * n[0] - dx * n[2]) / len;
  let sz = (dx * n[1] - dy * n[0]) / len;
  const sl = Math.hypot(sx, sy, sz);
  if (sl < 1e-6) {
    sx = n[1] ? 1 : 0;
    sy = n[1] ? 0 : 1;
    sz = 0;
  } else {
    sx /= sl;
    sy /= sl;
    sz /= sl;
  }
  const hw = width * 0.5;
  const ox = n[0] * lift;
  const oy = n[1] * lift;
  const oz = n[2] * lift;
  const ax = a[0] + ox - sx * hw;
  const ay = a[1] + oy - sy * hw;
  const az = a[2] + oz - sz * hw;
  const bx = a[0] + ox + sx * hw;
  const by = a[1] + oy + sy * hw;
  const bz = a[2] + oz + sz * hw;
  const cx = b[0] + ox + sx * hw;
  const cy = b[1] + oy + sy * hw;
  const cz = b[2] + oz + sz * hw;
  const dx2 = b[0] + ox - sx * hw;
  const dy2 = b[1] + oy - sy * hw;
  const dz2 = b[2] + oz - sz * hw;
  positions.push(
    ax, ay, az, bx, by, bz, cx, cy, cz,
    ax, ay, az, cx, cy, cz, dx2, dy2, dz2
  );
}

function ribbonMesh(positions, opacity, additive, color = 0xffffff) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    fog: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = additive ? 7 : 6;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildSeams(world, counts, quality = 'high') {
  const group = new THREE.Group();
  group.name = 'seams';
  const linePos = [];
  const core = [];
  const glow = [];
  const halo = [];
  const boxes = new Map(world.boxes.map((box, i) => [boxId(box, i), box]));
  for (const [id, box] of boxes) {
    if (box.walkable === false || box.role === 'crate' || box.role === 'shadow') continue;
    for (const face of FACE_IDS) {
      if (face !== '+y') continue;
      const count = counts.get(`${id}:${face}`) ?? 0;
      if (count !== 1) continue;
      const n = faceNormal(face);
      for (const [a, b] of corners(box, face)) {
        linePos.push(
          a[0] + n[0] * 0.016, a[1] + n[1] * 0.016, a[2] + n[2] * 0.016,
          b[0] + n[0] * 0.016, b[1] + n[1] * 0.016, b[2] + n[2] * 0.016
        );
        pushRibbon(core, a, b, n, 0.03, 0.018);
        if (quality !== 'low') {
          pushRibbon(glow, a, b, n, 0.1, 0.02);
          pushRibbon(halo, a, b, n, 0.26, 0.022);
        }
      }
    }
  }
  if (!core.length) return group;

  group.add(ribbonMesh(core, quality === 'low' ? 0.72 : 0.92, false, SEAM_CORE));
  if (glow.length) {
    group.add(ribbonMesh(glow, 0.34, true, SEAM_GLOW));
    group.add(ribbonMesh(halo, 0.13, true, SEAM_GLOW));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: SEAM_CORE,
    transparent: true,
    opacity: quality === 'low' ? 0.7 : 0.9,
    depthWrite: false,
    fog: false
  }));
  lines.renderOrder = 8;
  group.add(lines);
  return group;
}

export { edgeKey, faceCenter };
