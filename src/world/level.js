import * as THREE from 'three';
import { boxId, faceCenter } from '../engine/aabb.js';
import { countsForWorld, lightHitsFace } from '../engine/lights.js';
import { buildSeams } from '../fx/seam.js';

function sizeOf(box) {
  return [
    box.max[0] - box.min[0],
    box.max[1] - box.min[1],
    box.max[2] - box.min[2]
  ];
}

function place(mesh, box) {
  mesh.position.set(
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2
  );
}

function isFixture(box) {
  const role = box.role || 'solid';
  return role === 'pillar' || role === 'crate' || role === 'shadow' || box.walkable === false;
}

function pickInk(materials) {
  return materials.ink || materials.side || materials.dim
    || new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
}

function pickSide(materials) {
  return materials.side || materials.ink || materials.dim
    || new THREE.MeshBasicMaterial({ color: 0x101010 });
}

function pickOver(materials) {
  if (materials.over) return materials.over.clone();
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false
  });
}

const RIM_VOID = 0x858a90;
const RIM_LIT = 0x25282b;
const RIM_BURN = 0x111315;

function rim(w, h, d, opacity = 0.7, color = RIM_LIT) {
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 1.008, h * 1.008, d * 1.008)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  lines.name = 'rim';
  return lines;
}

function exposureMark(w, h, d) {
  const y = h / 2 + 0.024;
  const points = [
    new THREE.Vector3(-w * 0.28, y, -d * 0.2),
    new THREE.Vector3(w * 0.28, y, d * 0.2),
    new THREE.Vector3(-w * 0.28, y, d * 0.2),
    new THREE.Vector3(w * 0.28, y, -d * 0.2),
    new THREE.Vector3(-w * 0.18, y, 0),
    new THREE.Vector3(w * 0.18, y, 0)
  ];
  const mesh = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: 0x111315,
      transparent: true,
      opacity: 0.46,
      depthWrite: false
    })
  );
  mesh.name = 'burn-mark';
  mesh.visible = false;
  mesh.renderOrder = 6;
  return mesh;
}

function styleOf(box, counts) {
  const id = boxId(box);
  const top = counts.get(`${id}:+y`) ?? 0;
  const fixture = isFixture(box);
  const over = !fixture && top >= 2;
  const lit = fixture || (!over && top === 1);
  return {
    id,
    top,
    over,
    lit,
    fixture,
    void: !fixture && top < 1
  };
}

function syncSeams(root, world, counts, quality) {
  const signature = `${quality || 'high'}|${world.boxes.map(box => {
    const id = boxId(box);
    return `${id}:${counts.get(`${id}:+y`) ?? 0}`;
  }).join('|')}`;
  if (root.userData.seamSignature === signature && root.getObjectByName('seams')) return;
  root.userData.seamSignature = signature;
  const old = root.getObjectByName('seams');
  if (old) {
    old.removeFromParent();
    old.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material?.dispose?.());
      else object.material?.dispose?.();
    });
  }
  root.add(buildSeams(world, counts, quality));
}

function makeSolid(box, materials, referenceStyle = false) {
  const [w, h, d] = sizeOf(box);
  const side = pickSide(materials).clone();
  const top = (materials.floor || materials.paper).clone();
  if (referenceStyle) {
    // The cover uses pressed grey paper on the walls, not a high-contrast
    // hatch. Repeating the tooth map at a larger scale keeps the slab edges
    // tactile without turning them into striped masonry.
    side.color.setHex(0x3a3c3e);
    if (materials.grain) {
      side.map = materials.grain.clone();
      side.map.repeat.set(3.4, 3.4);
      side.needsUpdate = true;
    }
    top.color.setHex(0x696c6e);
  }
  const geo = new THREE.BoxGeometry(w, h, d);
  const paperMats = [side, side.clone(), top, side.clone(), side.clone(), side.clone()];
  const voidSide = side.clone();
  voidSide.color.setHex(referenceStyle ? 0x303336 : 0x0e1012);
  const voidTop = top.clone();
  voidTop.color.setHex(referenceStyle ? 0x606366 : 0x16181a);
  voidTop.roughness = 0.98;
  voidTop.metalness = 0;
  if (voidTop.emissive) {
    voidTop.emissive.setHex(referenceStyle ? 0x1e2022 : 0x000000);
    voidTop.emissiveIntensity = referenceStyle ? 0.16 : 0;
  }
  const voidMats = [voidSide, voidSide.clone(), voidTop, voidSide.clone(), voidSide.clone(), voidSide.clone()];
  const burnSide = side.clone();
  burnSide.color.setHex(referenceStyle ? 0x505255 : 0xaeb2b6);
  const burnTop = top.clone();
  burnTop.color.setHex(referenceStyle ? 0x646668 : 0xffffff);
  burnTop.roughness = 0.82;
  burnTop.metalness = 0;
  if (burnTop.emissive) {
    burnTop.emissive.setHex(0xffffff);
    burnTop.emissiveIntensity = referenceStyle ? 0.04 : 0.48;
  }
  const burnMats = [burnSide, burnSide.clone(), burnTop, burnSide.clone(), burnSide.clone(), burnSide.clone()];
  const mesh = new THREE.Mesh(geo, paperMats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  place(mesh, box);
  const cap = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(0.02, w - 0.04), Math.max(0.02, d - 0.04)),
    pickOver(materials)
  );
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = h / 2 + 0.01;
  cap.name = 'cap';
  cap.receiveShadow = false;
  cap.castShadow = false;
  cap.visible = false;
  cap.renderOrder = 3;
  mesh.add(cap);
  const edge = rim(w, h, d, 0.68, RIM_LIT);
  edge.visible = true;
  if (referenceStyle && edge.material) {
    edge.material.color.setHex(0x9a9da0);
    edge.material.opacity = 0.28;
  }
  mesh.add(edge);
  mesh.add(exposureMark(w, h, d));
  mesh.userData.paperMats = paperMats;
  mesh.userData.stateMats = { void: voidMats, lit: paperMats, over: burnMats };
  mesh.userData.overMat = cap.material;
  mesh.userData.baseRough = top.roughness ?? 0.58;
  return mesh;
}

function makeCutout(box, materials) {
  const [w, h, d] = sizeOf(box);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pickInk(materials).clone());
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  place(mesh, box);
  mesh.add(rim(w, h, d, 0.42));
  return mesh;
}

function makeReferenceBackdrop(world, materials) {
  const walkable = (world.boxes || []).filter(box => box.walkable !== false);
  if (!walkable.length) return null;
  const minX = Math.min(...walkable.map(box => box.min[0]));
  const maxX = Math.max(...walkable.map(box => box.max[0]));
  const minZ = Math.min(...walkable.map(box => box.min[2]));
  const maxZ = Math.max(...walkable.map(box => box.max[2]));
  // Extend well beyond the camera frustum so the studio surface reads as a
  // deliberate grey set instead of ending at a hard horizon line.
  const width = Math.max(72, maxX - minX + 28);
  const depth = Math.max(86, maxZ - minZ + 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0x2c2f32,
    map: materials.grain ? materials.grain.clone() : null,
    roughness: 1,
    metalness: 0,
    emissive: 0x111315,
    emissiveIntensity: 0.18,
    envMapIntensity: 0.08,
    fog: true
  });
  if (material.map) {
    material.map.repeat.set(3.2, 3.2);
    material.map.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.name = 'reference-backdrop';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, -0.16, (minZ + maxZ) / 2);
  mesh.receiveShadow = true;
  mesh.renderOrder = -3;
  return mesh;
}

export function createLevelRoot() {
  const root = new THREE.Group();
  root.name = 'level';
  return root;
}

export function buildLevel(root, world, materials, settings = {}) {
  while (root.children.length) root.remove(root.children[0]);
  root.userData.seamSignature = '';
  const counts = countsForWorld(world);
  const pickables = [];
  const solids = new THREE.Group();
  solids.name = 'solids';
  world.boxes.forEach((box, index) => {
    const id = boxId(box, index);
    const role = box.role || 'solid';
    const [w, h, d] = sizeOf(box);
    if (w <= 0 || h <= 0 || d <= 0) return;
    let mesh;
    if (role === 'crate') {
      mesh = makeCutout(box, { ink: materials.crate || pickInk(materials) });
      mesh.userData = { kind: 'crate', boxId: id, box, fixture: true };
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.02, 0.05, d * 1.02),
        new THREE.MeshBasicMaterial({ color: 0xf0f0ed })
      );
      band.position.y = h * 0.12;
      mesh.add(band);
    } else if (role === 'shadow') {
      mesh = makeCutout(box, materials);
      mesh.userData = { kind: 'shadow', boxId: id, fixture: true };
      const eye = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.04),
        new THREE.MeshBasicMaterial({ color: 0xf0f0ed })
      );
      eye.position.set(-0.12, h * 0.18, d / 2 + 0.01);
      const eye2 = eye.clone();
      eye2.position.x = 0.12;
      mesh.add(eye, eye2);
    } else if (isFixture(box)) {
      mesh = makeCutout(box, materials);
      mesh.userData = { kind: 'solid', boxId: id, box, fixture: true };
    } else {
      mesh = makeSolid(box, materials, !!settings.referenceStyle);
      mesh.userData.kind = 'solid';
      mesh.userData.boxId = id;
      mesh.userData.box = box;
      mesh.userData.goal = role === 'goal';
      if (role === 'goal') {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(
            Math.min(w, d) * (settings.referenceStyle ? 0.055 : 0.18),
            Math.min(w, d) * (settings.referenceStyle ? 0.08 : 0.24),
            settings.referenceStyle ? 4 : 32
          ),
          new THREE.MeshBasicMaterial({
            color: settings.referenceStyle ? 0xf2f2ef : 0x111315,
            transparent: true,
            opacity: settings.referenceStyle ? 0.96 : 0.92,
            side: THREE.DoubleSide
          })
        );
        ring.rotation.x = -Math.PI / 2;
        if (settings.referenceStyle) ring.rotation.z = Math.PI / 4;
        ring.position.y = h / 2 + 0.02;
        ring.name = 'goal-ring';
        const core = new THREE.Mesh(
          new THREE.CircleGeometry(Math.min(w, d) * (settings.referenceStyle ? 0.045 : 0.07), 4),
          new THREE.MeshBasicMaterial({ color: settings.referenceStyle ? 0x2b2d2e : 0x111315, side: THREE.DoubleSide })
        );
        core.rotation.x = -Math.PI / 2;
        core.rotation.z = Math.PI / 4;
        core.position.y = h / 2 + 0.023;
        core.visible = !settings.referenceStyle;
        mesh.add(ring, core);
      }
    }
    solids.add(mesh);
    pickables.push(mesh);
  });
  root.add(solids);
  if (settings.referenceStyle) {
    const backdrop = makeReferenceBackdrop(world, materials);
    if (backdrop) root.add(backdrop);
  }
  syncLevel(root, world, materials, settings);
  return { counts, pickables };
}

export function syncLevel(root, world, materials, settings = {}) {
  const counts = countsForWorld(world);
  const solids = root.getObjectByName('solids');
  const pickables = [];
  const present = new Set(world.boxes.map(box => boxId(box)));
  if (solids) {
    for (const mesh of solids.children) {
      const box = world.boxes.find(item => boxId(item) === mesh.userData.boxId);
      const role = mesh.userData.kind;
      if (role === 'shadow') {
        mesh.visible = present.has(mesh.userData.boxId);
        pickables.push(mesh);
        continue;
      }
      if (role === 'crate' && box) {
        place(mesh, box);
        mesh.visible = true;
        pickables.push(mesh);
        continue;
      }
      if (!box) {
        mesh.visible = false;
        continue;
      }
      const style = styleOf(box, counts);
      const focus = settings.focusLamp;
      const aimed = !!(focus && lightHitsFace(world, focus, { boxId: boxId(box), face: '+y' }));
      if (mesh.userData.fixture) {
        mesh.visible = true;
        pickables.push(mesh);
        continue;
      }
      const visualState = style.over ? 'over' : style.lit ? 'lit' : 'void';
      const previousState = mesh.userData.visualState;
      mesh.visible = true;
      const popReveal = previousState && previousState !== visualState
        && visualState !== 'void' && settings.quality !== 'low'
        && !settings.continuousRelight;
      if (popReveal) {
        mesh.userData.reveal = 0.34;
        mesh.scale.y = 0.08;
      } else if (visualState === 'void') {
        mesh.userData.reveal = 0;
        mesh.scale.set(1, 1, 1);
      }
      if (mesh.userData.stateMats?.[visualState]) mesh.material = mesh.userData.stateMats[visualState];
      mesh.userData.visualState = visualState;
      const rimLine = mesh.getObjectByName('rim');
      if (rimLine?.material) {
        rimLine.material.color.setHex(style.over ? RIM_BURN : aimed ? 0xffffff : style.lit ? RIM_LIT : RIM_VOID);
        rimLine.material.opacity = style.over ? 0.96 : aimed ? 0.9 : style.lit ? 0.62 : 0.46;
      }
      const cap = mesh.getObjectByName('cap');
      if (cap) {
        cap.visible = !!style.over;
        if (cap.material) cap.material.opacity = style.over ? (settings.referenceStyle ? 0.04 : 0.26) : 0;
      }
      const burnMark = mesh.getObjectByName('burn-mark');
      if (burnMark) burnMark.visible = !!style.over && !settings.referenceStyle;
      const ring = mesh.getObjectByName('goal-ring');
      if (ring) ring.visible = style.lit && !style.over && !settings.referenceStyle;
      mesh.userData.counts = { top: style.top };
      mesh.userData.style = style;
      pickables.push(mesh);
    }
  }
  if (settings.referenceStyle) {
    const seams = root.getObjectByName('seams');
    if (seams) seams.visible = false;
  } else {
    syncSeams(root, world, counts, settings.quality);
  }
  return { counts, pickables };
}

export function tickReveals(root, dt) {
  const solids = root?.getObjectByName('solids');
  if (!solids) return;
  for (const mesh of solids.children) {
    const remaining = mesh.userData.reveal || 0;
    if (remaining <= 0) continue;
    const next = Math.max(0, remaining - dt);
    const progress = 1 - next / 0.34;
    mesh.scale.y = 0.08 + (1 - 0.08) * (1 - Math.pow(1 - progress, 3));
    mesh.userData.reveal = next;
    if (next === 0) mesh.scale.set(1, 1, 1);
  }
}

export function faceFromHit(hit) {
  if (!hit.face) return '+y';
  const n = hit.face.normal.clone();
  n.transformDirection(hit.object.matrixWorld);
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  if (ay >= ax && ay >= az) return n.y >= 0 ? '+y' : '-y';
  if (ax >= az) return n.x >= 0 ? '+x' : '-x';
  return n.z >= 0 ? '+z' : '-z';
}

export function worldToFaceRef(hit) {
  const boxIdValue = hit.object.userData.boxId || hit.object.parent?.userData?.boxId;
  if (!boxIdValue) return null;
  return { boxId: boxIdValue, face: faceFromHit(hit) };
}

export { faceCenter };
