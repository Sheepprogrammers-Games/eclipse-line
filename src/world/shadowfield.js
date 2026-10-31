import * as THREE from 'three';
import { boxId } from '../engine/aabb.js';

const INK = 0x000000;
const EDGE = 0xd8d8d6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function caster(box) {
  const role = box.role || 'solid';
  const height = box.max[1] - box.min[1];
  return height > 0.35 && (role === 'pillar' || role === 'crate' || role === 'shadow' || box.walkable === false);
}

function planeMesh(points, opacity, name) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    ...points[0], ...points[1], ...points[2],
    ...points[0], ...points[2], ...points[3]
  ], 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    color: INK,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = 4;
  return mesh;
}

function disposeTree(root) {
  root.traverse(object => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach(material => material?.dispose?.());
    else object.material?.dispose?.();
  });
}

function projectedShadow(box, light) {
  const cx = (box.min[0] + box.max[0]) / 2;
  const cz = (box.min[2] + box.max[2]) / 2;
  let dx = cx - light.origin[0];
  let dz = cz - light.origin[2];
  const horizontal = Math.hypot(dx, dz) || 1;
  dx /= horizontal;
  dz /= horizontal;
  const px = -dz;
  const pz = dx;
  const width = Math.max(0.24, Math.hypot(box.max[0] - box.min[0], box.max[2] - box.min[2]) * 0.72);
  const height = box.max[1] - box.min[1];
  const rise = Math.max(0.5, light.origin[1] - box.min[1]);
  const length = clamp(height * horizontal / rise * 1.25, 0.75, 6.5);
  const near = width * 0.48;
  const far = width * 0.34;
  const y = box.min[1] + 0.012;
  const startX = cx + dx * width * 0.28;
  const startZ = cz + dz * width * 0.28;
  const endX = startX + dx * length;
  const endZ = startZ + dz * length;
  const mesh = planeMesh([
    [startX - px * near, y, startZ - pz * near],
    [startX + px * near, y, startZ + pz * near],
    [endX + px * far, y, endZ + pz * far],
    [endX - px * far, y, endZ - pz * far]
  ], box.role === 'shadow' ? 0.78 : 0.5, 'cast-shadow');
  mesh.userData = { casterId: boxId(box), lightId: light.id };
  return mesh;
}

function imprint(mask, world) {
  const box = (world.boxes || []).find(item => boxId(item) === mask.boxId);
  if (!box || !Array.isArray(mask.origin)) return null;
  const shape = mask.shape;
  const start = Array.isArray(shape?.start) ? shape.start : mask.origin;
  const tip = Array.isArray(shape?.tip)
    ? shape.tip
    : [(box.min[0] + box.max[0]) / 2, box.max[1], (box.min[2] + box.max[2]) / 2];
  const cx = tip[0];
  const cz = tip[2];
  let dx = cx - start[0];
  let dz = cz - start[2];
  const length = Math.hypot(dx, dz) || 1;
  dx /= length;
  dz /= length;
  const px = -dz;
  const pz = dx;
  const targetWidth = Number.isFinite(Number(shape?.width))
    ? Number(shape.width) * 0.5
    : Math.min(1.25, Math.max(0.52, Math.min(box.max[0] - box.min[0], box.max[2] - box.min[2]) * 0.62));
  const nearY = start[1] + 0.026;
  const farY = tip[1] + 0.026;
  const nearX = start[0] + dx * 0.12;
  const nearZ = start[2] + dz * 0.12;
  const rootWidth = Math.max(0.1, targetWidth * 0.28);
  const mesh = planeMesh([
    [nearX - px * rootWidth, nearY, nearZ - pz * rootWidth],
    [nearX + px * rootWidth, nearY, nearZ + pz * rootWidth],
    [cx + px * targetWidth, farY, cz + pz * targetWidth],
    [cx - px * targetWidth, farY, cz - pz * targetWidth]
  ], 0.86, 'player-shadow');
  mesh.renderOrder = 6;

  const outline = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(nearX - px * rootWidth, nearY + 0.004, nearZ - pz * rootWidth),
      new THREE.Vector3(cx - px * targetWidth, farY + 0.004, cz - pz * targetWidth),
      new THREE.Vector3(nearX + px * rootWidth, nearY + 0.004, nearZ + pz * rootWidth),
      new THREE.Vector3(cx + px * targetWidth, farY + 0.004, cz + pz * targetWidth)
    ]),
    new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: 0.68, depthWrite: false })
  );
  outline.name = 'shadow-edge';
  outline.renderOrder = 7;
  mesh.add(outline);
  mesh.userData = { mask, baseOpacity: 0.86, pinned: !!shape };
  return mesh;
}

function targetMarker(target, world, referenceStyle = false) {
  const box = (world.boxes || []).find(item => boxId(item) === target.boxId);
  if (!box || (target.face || '+y') !== '+y') return null;
  const size = clamp(
    Math.min(box.max[0] - box.min[0], box.max[2] - box.min[2]) * (referenceStyle ? 0.22 : 0.18),
    referenceStyle ? 0.26 : 0.18,
    referenceStyle ? 0.36 : 0.3
  );
  const group = new THREE.Group();
  group.name = 'shadow-target';
  const markerOrigin = Array.isArray(target.origin)
    ? target.origin
    : [(box.min[0] + box.max[0]) / 2, box.max[1], (box.min[2] + box.max[2]) / 2];
  group.position.set(markerOrigin[0], markerOrigin[1] + 0.038, markerOrigin[2]);
  const ink = new THREE.Mesh(
    new THREE.RingGeometry(size * 0.42, size, 4),
    new THREE.MeshBasicMaterial({ color: referenceStyle ? 0xf3f3ef : INK, side: THREE.DoubleSide, depthWrite: false })
  );
  const paper = new THREE.Mesh(
    new THREE.RingGeometry(size * 1.04, size * 1.14, 4),
    new THREE.MeshBasicMaterial({ color: EDGE, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
  );
  ink.rotation.x = -Math.PI / 2;
  paper.rotation.x = -Math.PI / 2;
  ink.rotation.z = paper.rotation.z = Math.PI / 4;
  ink.renderOrder = 8;
  paper.renderOrder = 7;
  group.add(paper, ink);
  group.userData = {
    active: (world.shadowMasks || []).some(mask => sameMask(mask, target)),
    baseScale: 1,
    referenceStyle
  };
  return group;
}

function sameMask(mask, target) {
  return mask?.boxId === target?.boxId
    && (mask.face || '+y') === (target.face || '+y')
    && mask.lightId === target.lightId;
}

export function syncShadowField(root, world, quality = 'high', options = {}) {
  const previous = root.getObjectByName('shadow-field');
  if (previous) {
    previous.removeFromParent();
    disposeTree(previous);
  }
  const group = new THREE.Group();
  group.name = 'shadow-field';
  const lights = (world.lights || []).filter(light => light.enabled !== false && Array.isArray(light.origin) && light.type !== 'virtual');
  if (quality !== 'low' && lights.length) {
    for (const box of (world.boxes || []).filter(caster)) {
      let nearest = null;
      let distance = Infinity;
      const cx = (box.min[0] + box.max[0]) / 2;
      const cz = (box.min[2] + box.max[2]) / 2;
      for (const light of lights) {
        const next = Math.hypot(cx - light.origin[0], cz - light.origin[2]);
        if (next < distance) {
          nearest = light;
          distance = next;
        }
      }
      if (nearest) group.add(projectedShadow(box, nearest));
    }
  }
  for (const mask of world.shadowMasks || []) {
    // Frozen player silhouettes are rendered by shadowavatar with the same
    // cutout texture as the body. A second solid trapezoid here would visibly
    // deform that silhouette.
    if (mask.shape) continue;
    const mesh = imprint(mask, world);
    if (mesh) group.add(mesh);
  }
  for (const target of options.targets || []) {
    const marker = targetMarker(target, world, !!options.referenceStyle);
    if (marker) group.add(marker);
  }
  root.add(group);
  return group;
}

export function tickShadowField(root, time = 0) {
  const group = root?.getObjectByName('shadow-field');
  if (!group) return;
  for (const mesh of group.children) {
    if (mesh.name === 'player-shadow' && mesh.material) {
      mesh.material.opacity = mesh.userData.pinned
        ? mesh.userData.baseOpacity
        : mesh.userData.baseOpacity + Math.sin(time * 4.2) * 0.07;
      const edge = mesh.getObjectByName('shadow-edge');
      if (edge?.material) edge.material.opacity = mesh.userData.pinned
        ? 0.68
        : 0.46 + Math.sin(time * 4.2) * 0.18;
    }
    if (mesh.name === 'shadow-target') {
      if (mesh.userData.referenceStyle) {
        mesh.scale.setScalar(1);
        mesh.rotation.y = 0;
        continue;
      }
      const pulse = mesh.userData.active ? 1.08 + Math.sin(time * 4.2) * 0.1 : 1 + Math.sin(time * 2.4) * 0.06;
      mesh.scale.setScalar(pulse);
      mesh.rotation.y = Math.sin(time * 1.6) * 0.08;
    }
  }
}
