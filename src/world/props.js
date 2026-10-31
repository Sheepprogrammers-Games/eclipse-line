import * as THREE from 'three';
import { dirFromYawTilt } from '../engine/resolve.js';
import { makeGlowSprite } from '../fx/atmosphere.js';

const CORE = 0xffffff;
const CORE_OFF = 0x141416;
const PAPER = 0xf0f0ed;
const INK = 0x101012;
const SEAM = 0xffffff;

function seamMat(opacity = 0.86) {
  return new THREE.LineBasicMaterial({ color: SEAM, transparent: true, opacity });
}

function boxEdges(w, h, d, opacity = 0.86) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 1.014, h * 1.014, d * 1.014)),
    seamMat(opacity)
  );
}

function inkBox(w, h, d, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = false;
  return mesh;
}

function coreMat(hex = CORE) {
  return new THREE.MeshBasicMaterial({ color: hex });
}

let poolMap = null;
function poolTexture() {
  if (poolMap) return poolMap;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.32)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.88, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  poolMap = new THREE.CanvasTexture(canvas);
  poolMap.colorSpace = THREE.SRGBColorSpace;
  poolMap.generateMipmaps = false;
  return poolMap;
}

function makePoolMesh() {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    new THREE.MeshBasicMaterial({
      map: poolTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.NormalBlending,
      fog: false
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1.02, 36),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  mesh.add(ring);
  mesh.userData.ring = ring;
  return mesh;
}

function beamHitFloor(world, origin, dir) {
  let best = null;
  let bestT = Infinity;
  for (const box of world.boxes || []) {
    if (box.walkable === false) continue;
    const y = box.max[1];
    if (Math.abs(dir.y) < 1e-5) continue;
    const t = (y - origin[1]) / dir.y;
    if (t < 0.28 || t > 18) continue;
    const x = origin[0] + dir.x * t;
    const z = origin[2] + dir.z * t;
    if (x < box.min[0] - 0.25 || x > box.max[0] + 0.25 || z < box.min[2] - 0.25 || z > box.max[2] + 0.25) continue;
    if (t < bestT) {
      bestT = t;
      best = { x, y, z, t };
    }
  }
  return best;
}

function floorYAt(world, x, z, fallback = 0.41) {
  let y = fallback;
  let hit = false;
  for (const box of world.boxes || []) {
    if (box.walkable === false) continue;
    if (x < box.min[0] || x > box.max[0] || z < box.min[2] || z > box.max[2]) continue;
    y = Math.max(y, box.max[1]);
    hit = true;
  }
  return hit ? y : fallback;
}

let shaftMap = null;
function shaftTexture() {
  if (shaftMap) return shaftMap;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.06, 'rgba(255,255,255,0.36)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 128);
  shaftMap = new THREE.CanvasTexture(canvas);
  shaftMap.colorSpace = THREE.SRGBColorSpace;
  shaftMap.generateMipmaps = false;
  return shaftMap;
}

function makeShaftMesh() {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 24, 1, true),
    new THREE.MeshBasicMaterial({
      map: shaftTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      fog: false
    })
  );
  mesh.name = 'shaft';
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  return mesh;
}

function makeLightFx() {
  const g = new THREE.Group();
  g.userData.fx = true;
  const pool = makePoolMesh();
  pool.name = 'pool';
  g.add(pool, makeShaftMesh());
  return g;
}

const Y_UP = new THREE.Vector3(0, 1, 0);
const SHAFT_AIM = new THREE.Vector3();
const HEAD = new THREE.Vector3();
const HIT = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

function lampHeadOf(root, id) {
  const props = root.getObjectByName('props');
  if (!props) return null;
  for (const child of props.children) {
    if (child.userData.kind !== 'lamp' || child.userData.id !== id) continue;
    const obj = child.userData.core || child.userData.shade;
    if (!obj) return null;
    return obj.getWorldPosition(HEAD);
  }
  return null;
}

export function syncCones(root, world, quality = 'high', options = {}) {
  let group = root.getObjectByName('cones');
  if (!group) {
    group = new THREE.Group();
    group.name = 'cones';
    root.add(group);
  }
  if (quality === 'low') {
    group.visible = false;
    return;
  }
  group.visible = true;
  if (group.children.some(child => !child.userData.fx)) {
    while (group.children.length) group.remove(group.children[0]);
  }
  const lights = (world.lights || []).filter(light => (
    light.enabled !== false
    && light.type !== 'directional'
    && light.origin
    && (!options.referenceStyle || light.coverBeam)
  ));
  while (group.children.length > lights.length) {
    group.remove(group.children[group.children.length - 1]);
  }
  lights.forEach((light, index) => {
    let fx = group.children[index];
    const dir = new THREE.Vector3(...(light.direction || dirFromYawTilt(light.yaw || 0, light.tilt || 0)));
    if (dir.lengthSq() < 1e-6) dir.set(0, -1, 0);
    dir.normalize();
    if (!fx) {
      fx = makeLightFx();
      group.add(fx);
    }
    const pool = fx.getObjectByName('pool');
    const shaft = fx.getObjectByName('shaft');
    if (pool?.userData.ring) pool.userData.ring.visible = !light.coverBeam;
    const lantern = !light.coverBeam && (light.id === 'lantern' || light.type === 'point');
    if (lantern) {
      const x = light.origin[0];
      const z = light.origin[2];
      const y = floorYAt(world, x, z);
      pool.visible = true;
      shaft.visible = false;
      pool.material.opacity = 0.22;
      pool.scale.set(1.05, 1.05, 1);
      pool.position.set(x, y + 0.03, z);
      return;
    }
    const hit = beamHitFloor(world, light.origin, dir) || (() => {
      const floorY = 0.41;
      const t = (floorY - light.origin[1]) / dir.y;
      if (!Number.isFinite(t) || t < 0.4 || t > 18) return null;
      return { x: light.origin[0] + dir.x * t, y: floorY, z: light.origin[2] + dir.z * t, t };
    })();
    if (!hit) {
      pool.visible = false;
      shaft.visible = false;
      return;
    }
    const rawRadius = Math.tan(Number(light.angle) || 0.4) * hit.t;
    const radius = light.coverBeam
      ? Math.min(2.35, Math.max(0.58, rawRadius * 0.62))
      : Math.min(4.2, Math.max(0.4, rawRadius));
    pool.visible = !light.coverBeam;
    pool.material.opacity = light.coverBeam ? 0.18 : light.type === 'virtual' ? 0.14 : 0.28;
    pool.scale.set(radius, radius, 1);
    pool.position.set(hit.x, hit.y + 0.028, hit.z);
    const head = lampHeadOf(root, light.id);
    HIT.set(hit.x, hit.y + 0.04, hit.z);
    if (head) HEAD.copy(head);
    else HEAD.set(light.origin[0], light.origin[1], light.origin[2]);
    SHAFT_AIM.copy(HIT).sub(HEAD);
    const len = SHAFT_AIM.length();
    shaft.visible = quality === 'high' && len > 0.35;
    if (shaft.visible) {
      SHAFT_AIM.multiplyScalar(1 / len);
      shaft.scale.set(radius, len, radius);
      shaft.position.copy(HEAD).addScaledVector(SHAFT_AIM, len * 0.5);
      SHAFT_AIM.multiplyScalar(-1);
      shaft.quaternion.setFromUnitVectors(Y_UP, SHAFT_AIM);
      shaft.material.opacity = light.coverBeam ? 0.92 : light.type === 'virtual' ? 0.1 : 0.16;
      shaft.material.blending = light.coverBeam ? THREE.AdditiveBlending : THREE.NormalBlending;
      shaft.material.depthTest = !light.coverBeam;
      shaft.material.needsUpdate = true;
      shaft.renderOrder = light.coverBeam ? 12 : 1;
    }
  });
}

function paperLamp(spec, materials) {
  const g = new THREE.Group();
  const tall = !!spec.tall;
  const small = !!spec.small;
  const poleH = tall ? 2.55 : small ? 0.92 : 1.42;
  const ink = materials.ink;
  const baseW = small ? 0.26 : 0.36;
  const base = inkBox(baseW, 0.08, baseW, ink);
  base.position.y = 0.04;
  const baseRim = boxEdges(baseW, 0.08, baseW, 0.9);
  baseRim.position.copy(base.position);

  const poleW = small ? 0.055 : 0.07;
  const pole = inkBox(poleW, poleH, poleW, ink);
  pole.position.y = poleH / 2;
  const poleRim = boxEdges(poleW, poleH, poleW, 0.72);
  poleRim.position.copy(pole.position);

  const shadeR = small ? 0.11 : tall ? 0.19 : 0.145;
  const headY = poleH + shadeR * 0.15;
  const paper = (materials.paper || new THREE.MeshLambertMaterial({ color: PAPER })).clone();
  paper.emissive = new THREE.Color(0xffffff);
  paper.emissiveIntensity = 0;
  const shadeGeo = new THREE.SphereGeometry(shadeR, 10, 8);
  const shade = new THREE.Mesh(shadeGeo, paper);
  shade.scale.set(1, 1.12, 1);
  shade.castShadow = true;
  shade.receiveShadow = false;
  const shadeSeam = new THREE.LineSegments(
    new THREE.EdgesGeometry(shadeGeo, 28),
    new THREE.LineBasicMaterial({ color: 0x29292b, transparent: true, opacity: 0.38 })
  );
  shadeSeam.scale.copy(shade.scale);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(shadeR * 0.78, shadeR * 0.48, 6), paper);
  cap.position.set(0, shadeR * 0.78, 0);
  cap.castShadow = true;
  const capSeam = new THREE.LineSegments(
    new THREE.EdgesGeometry(cap.geometry),
    new THREE.LineBasicMaterial({ color: 0x29292b, transparent: true, opacity: 0.34 })
  );
  capSeam.position.copy(cap.position);

  const lampCore = coreMat(CORE);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(small ? 0.038 : tall ? 0.068 : 0.05, 10, 8),
    lampCore
  );
  core.position.set(0, -shadeR * 0.08, 0);

  const glow = makeGlowSprite(small ? 0.55 : tall ? 0.82 : 0.68, 0.32, 0xffffff);
  const halo = makeGlowSprite(small ? 0.9 : tall ? 1.25 : 1.05, 0.08, 0xffffff);

  const bulb = new THREE.PointLight(0xf7f7f4, 0, small ? 1.8 : tall ? 2.8 : 2.4, 1.7);
  bulb.position.copy(core.position);
  bulb.castShadow = false;

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = headY;
  head.add(shade, shadeSeam, cap, capSeam, core, glow, halo, bulb);

  const padH = poleH + shadeR * 2.4;
  const padR = small ? 0.72 : 1.25;
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(padR, padR, padH, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pad.position.y = padH / 2;
  pad.name = 'click-pad';

  // 底座的一圈刻痕：只有能转或能挪的灯才画，固定灯没有。
  const markR = baseW * 1.5;
  const turnMark = new THREE.Mesh(
    new THREE.RingGeometry(markR * 0.76, markR, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfffdf6,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  turnMark.rotation.x = -Math.PI / 2;
  turnMark.position.y = 0.012;
  turnMark.name = 'turn-mark';
  turnMark.visible = false;
  turnMark.renderOrder = 4;

  g.add(base, baseRim, pole, poleRim, head, pad, turnMark);
  g.position.set(spec.origin[0], 0, spec.origin[2]);
  g.userData = { kind: 'lamp', id: spec.id, tall, core, glow, halo, shade, bulb, head, home: spec.origin.slice() };
  return g;
}

function switchOrigin(sw, level) {
  if (sw.origin) return sw.origin;
  const box = (level.boxes || []).find(item => item.id === sw.boxId);
  if (!box) return [0, 0.4, 0];
  return [(box.min[0] + box.max[0]) / 2, box.max[1], (box.min[2] + box.max[2]) / 2];
}

function makeSeal(sw, level, materials) {
  const g = new THREE.Group();
  const base = inkBox(0.62, 0.05, 0.62, materials.ink, false);
  base.position.y = 0.03;
  const rim = boxEdges(0.62, 0.05, 0.62, 0.95);
  rim.position.y = 0.03;
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.025, 0.38),
    new THREE.MeshBasicMaterial({ color: PAPER })
  );
  paper.position.y = 0.065;
  const glow = makeGlowSprite(0.95, 0.16, 0xffffff);
  glow.position.y = 0.12;
  glow.visible = false;
  g.add(base, rim, paper, glow);
  const o = switchOrigin(sw, level);
  g.position.set(o[0], o[1], o[2]);
  g.userData = { kind: 'seal', id: sw.id, glow, paper };
  return g;
}

function makeSigil(sw, level) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.06, 0.5),
    new THREE.MeshBasicMaterial({ color: INK })
  );
  const mark = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.04, 0.22),
    new THREE.MeshBasicMaterial({ color: PAPER })
  );
  mark.position.y = 0.05;
  mark.rotation.y = Math.PI / 4;
  const rim = boxEdges(0.5, 0.06, 0.5, 0.9);
  const glow = makeGlowSprite(0.9, 0.14, 0xffffff);
  glow.position.y = 0.1;
  glow.visible = false;
  g.add(plate, mark, rim, glow);
  const o = switchOrigin(sw, level);
  g.position.set(o[0], o[1], o[2]);
  g.userData = { kind: 'sigil', id: sw.id, glow, mark };
  return g;
}

function makeLever(sw, level, materials) {
  const g = new THREE.Group();
  const plate = inkBox(0.46, 0.06, 0.46, materials.ink);
  plate.position.y = 0.03;
  const seam = boxEdges(0.46, 0.06, 0.46, 0.92);
  seam.position.y = 0.03;
  const notch = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.02, 0.22),
    new THREE.MeshBasicMaterial({ color: PAPER })
  );
  notch.position.set(0, 0.07, 0);

  const handle = new THREE.Group();
  handle.name = 'handle';
  const stick = inkBox(0.07, 0.48, 0.07, materials.ink);
  stick.position.y = 0.24;
  const stickRim = boxEdges(0.07, 0.48, 0.07, 0.7);
  stickRim.position.copy(stick.position);
  const knob = inkBox(0.16, 0.13, 0.16, new THREE.MeshBasicMaterial({ color: PAPER }), false);
  knob.position.y = 0.5;
  const knobRim = boxEdges(0.16, 0.13, 0.16, 1);
  knobRim.position.copy(knob.position);
  handle.add(stick, stickRim, knob, knobRim);
  handle.position.y = 0.06;
  handle.rotation.z = 0.62;

  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  pad.position.y = 0.3;
  g.add(plate, seam, notch, handle, pad);
  const o = switchOrigin(sw, level);
  g.position.set(o[0], o[1], o[2]);
  g.userData = { kind: 'lever', id: sw.id, handle };
  return g;
}

function makeEye(sw, level) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.07, 0.56),
    new THREE.MeshBasicMaterial({ color: INK })
  );
  const slit = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.045, 0.08),
    new THREE.MeshBasicMaterial({ color: PAPER })
  );
  slit.position.y = 0.045;
  slit.name = 'slit';
  const rim = boxEdges(0.56, 0.07, 0.56, 0.92);
  g.add(ring, slit, rim);
  const o = switchOrigin(sw, level);
  g.position.set(o[0], o[1], o[2]);
  g.userData = { kind: 'eye', id: sw.id, slit };
  return g;
}

function makeWire(wire, level) {
  const sw = (level.switches || []).find(item => item.id === wire.from);
  const lamp = (level.lamps || []).find(item => item.id === wire.to);
  const a = switchOrigin(sw || {}, level);
  const b = lamp?.origin ? [lamp.origin[0], 0.4, lamp.origin[2]] : [a[0] + 4, 0.4, a[2]];
  const g = new THREE.Group();
  g.userData = { kind: 'wire', from: wire.from, to: wire.to, beads: [] };
  const n = 12;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const bead = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.035, 0.09),
      new THREE.MeshLambertMaterial({ color: 0x161616, emissive: PAPER, emissiveIntensity: 0 })
    );
    bead.position.set(
      a[0] + (b[0] - a[0]) * t,
      0.06 + Math.sin(t * Math.PI) * 0.1,
      a[2] + (b[2] - a[2]) * t
    );
    const rim = boxEdges(0.09, 0.035, 0.09, 0.45);
    bead.add(rim);
    g.add(bead);
    g.userData.beads.push(bead);
  }
  return g;
}

function makeSpikeField(spec) {
  const group = new THREE.Group();
  group.name = `hazard-${spec.id || 'spikes'}`;
  group.userData = { kind: 'hazard', id: spec.id || 'spikes', hazardType: spec.type || 'spikes' };
  const width = Math.max(0.4, Number(spec.w) || 2);
  const depth = Math.max(0.4, Number(spec.d) || 2);
  const baseY = Number(spec.y) || 0;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.16, depth),
    new THREE.MeshStandardMaterial({
      color: 0x0a0b0c,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.94,
      metalness: 0
    })
  );
  base.position.y = baseY - 0.08;
  base.receiveShadow = true;
  group.add(base);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width * 1.012, 0.18, depth * 1.012)),
    new THREE.LineBasicMaterial({ color: 0xfffdf6, transparent: true, opacity: 0.94 })
  );
  edge.position.y = baseY - 0.07;
  group.add(edge);

  const rows = Math.max(2, Math.floor(Number(spec.rows) || 4));
  const columns = Math.max(2, Math.floor(Number(spec.columns) || 8));
  const spikeHeight = Math.min(0.72, Math.max(0.32, Number(spec.spikeHeight) || 0.58));
  const spikeRadius = Math.min(width / columns, depth / rows) * 0.3;
  const geometry = new THREE.ConeGeometry(spikeRadius, spikeHeight, 5);
  const material = new THREE.MeshStandardMaterial({
    color: 0x101113,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.62,
    metalness: 0.1
  });
  const tipMaterial = new THREE.MeshBasicMaterial({ color: 0xfffdf6, transparent: true, opacity: 0.9 });
  const tipGeometry = new THREE.ConeGeometry(spikeRadius * 0.34, spikeHeight * 0.3, 5);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const spike = new THREE.Mesh(geometry, material);
      spike.position.set(
        -width / 2 + (column + 0.5) * width / columns,
        baseY + spikeHeight / 2,
        -depth / 2 + (row + 0.5) * depth / rows
      );
      spike.rotation.y = ((row + column) % 2) * Math.PI / 5;
      spike.castShadow = true;
      const tip = new THREE.Mesh(tipGeometry, tipMaterial);
      tip.position.y = spikeHeight * 0.35;
      spike.add(tip);
      group.add(spike);
    }
  }
  group.position.set(Number(spec.x) + width / 2, 0, Number(spec.z) + depth / 2);
  return group;
}

function standY(level, x, z) {
  let bestY = 0.4;
  let best = Infinity;
  for (const box of level.boxes || []) {
    if (box.walkable === false) continue;
    const role = box.role || 'solid';
    if (role === 'pillar' || role === 'crate' || role === 'shadow') continue;
    const dx = Math.max(box.min[0] - x, 0, x - box.max[0]);
    const dz = Math.max(box.min[2] - z, 0, z - box.max[2]);
    const dist = Math.hypot(dx, dz);
    if (dist < best) {
      best = dist;
      bestY = box.max[1];
    }
  }
  return bestY;
}

function monumentEdge(mesh, color = 0xe8e9e6, opacity = 0.62) {
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 24),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(edge);
  return mesh;
}

function makeMonument(spec, materials) {
  if (!spec?.kind || !Array.isArray(spec.origin)) return null;
  const group = new THREE.Group();
  group.name = `monument-${spec.kind}`;
  group.userData = { kind: 'monument', id: spec.kind };
  const grey = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.96, metalness: 0 });
  const dark = (materials.ink || new THREE.MeshBasicMaterial({ color: INK })).clone();
  const white = new THREE.MeshStandardMaterial({
    color: 0xf6f6f2,
    roughness: 0.94,
    metalness: 0,
    emissive: 0x4a4a46,
    emissiveIntensity: 0.24
  });

  if (spec.kind === 'gate') {
    const width = spec.width || 3.2;
    const height = spec.height || 2.5;
    const left = monumentEdge(new THREE.Mesh(new THREE.BoxGeometry(0.42, height, 0.72), grey));
    left.position.set(-width / 2, height / 2, 0);
    left.castShadow = true;
    const right = left.clone();
    right.position.x = width / 2;
    const lintel = monumentEdge(new THREE.Mesh(new THREE.BoxGeometry(width + 0.42, 0.46, 0.72), white), 0x222528, 0.52);
    lintel.position.y = height - 0.22;
    lintel.castShadow = true;
    group.add(left, right, lintel);
  } else if (spec.kind === 'prism') {
    const body = monumentEdge(new THREE.Mesh(new THREE.OctahedronGeometry(spec.radius || 1.15, 0), grey));
    body.name = 'monument-body';
    body.scale.y = 1.45;
    body.position.y = spec.height || 2.5;
    body.rotation.y = Math.PI / 4;
    body.castShadow = true;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry((spec.radius || 1.15) * 0.38, 0), white);
    core.name = 'monument-core';
    core.position.copy(body.position);
    core.rotation.y = Math.PI / 4;
    const halo = makeGlowSprite((spec.radius || 1.15) * 3.1, 0.12, 0xffffff);
    halo.name = 'monument-halo';
    halo.userData.baseScale = halo.scale.x;
    halo.position.copy(body.position);
    group.add(body, core, halo);
  } else if (spec.kind === 'lighthouse') {
    const base1 = monumentEdge(new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.56, 0.34, 8), grey));
    base1.position.y = 0.17;
    const base2 = monumentEdge(new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.34, 0.28, 8), white), 0x25282b, 0.54);
    base2.position.y = 0.48;
    const tower = monumentEdge(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.96, 4.2, 8), grey));
    tower.position.y = 2.67;
    tower.castShadow = true;
    const room = monumentEdge(new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.64, 8), dark));
    room.position.y = 4.92;
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lens.name = 'monument-lens';
    lens.position.set(0, 4.94, 0.76);
    const glow = makeGlowSprite(1.55, 0.34, 0xffffff);
    glow.name = 'monument-halo';
    glow.userData.baseScale = glow.scale.x;
    glow.position.copy(lens.position);
    const roof = monumentEdge(new THREE.Mesh(new THREE.ConeGeometry(1, 0.72, 8), white), 0x25282b, 0.52);
    roof.position.y = 5.6;
    group.add(base1, base2, tower, room, lens, glow, roof);
  } else if (spec.kind === 'eclipse') {
    const radius = spec.radius || 1.6;
    const halo = makeGlowSprite(radius * 3.3, 0.46, 0xffffff);
    halo.name = 'monument-halo';
    halo.userData.baseScale = halo.scale.x;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.01, radius * 1.18, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.94, side: THREE.DoubleSide })
    );
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 64),
      new THREE.MeshBasicMaterial({ color: 0x030405, side: THREE.DoubleSide })
    );
    disc.name = 'monument-disc';
    ring.rotation.y = disc.rotation.y = THREE.MathUtils.degToRad(spec.yaw || 0);
    ring.rotation.x = disc.rotation.x = THREE.MathUtils.degToRad(spec.pitch || 0);
    group.add(halo, ring, disc);
  }

  group.position.set(spec.origin[0], spec.origin[1], spec.origin[2]);
  if (spec.scale) group.scale.setScalar(spec.scale);
  return group;
}

export function addProps(root, level, materials) {
  const group = new THREE.Group();
  group.name = 'props';
  const monument = makeMonument(level.monument, materials);
  if (monument) group.add(monument);
  for (const hazard of level.hazards || []) {
    group.add(makeSpikeField(hazard));
  }
  for (const spec of level.lamps || []) {
    const lamp = paperLamp(spec, materials);
    lamp.position.set(spec.origin[0], standY(level, spec.origin[0], spec.origin[2]), spec.origin[2]);
    group.add(lamp);
  }
  if (!level.referenceStyle) {
    for (const sw of level.switches || []) {
      if (sw.kind === 'shadow') group.add(makeEye(sw, level));
      else if (sw.kind === 'plate') group.add(makeSeal(sw, level, materials));
      else if (sw.kind === 'lit') group.add(makeSigil(sw, level));
      else group.add(makeLever(sw, level, materials));
    }
    for (const wire of level.wires || []) {
      group.add(makeWire(wire, level));
    }
  }
  for (const mirror of level.mirrors || []) {
    const frame = new THREE.Group();
    const backing = inkBox(0.04, 1.74, 1.29, materials.ink, false);
    backing.position.x = -0.03;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.66, 1.21),
      new THREE.MeshBasicMaterial({ color: PAPER })
    );
    const rim = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.08, 1.74, 1.29)),
      new THREE.LineBasicMaterial({ color: SEAM })
    );
    frame.add(backing, board, rim);
    frame.position.set(mirror.origin[0], mirror.origin[1], mirror.origin[2]);
    frame.rotation.y = mirror.yaw || 0;
    frame.userData = { kind: 'mirror', id: mirror.id };
    group.add(frame);
  }
  if (level.pickup) {
    const lantern = new THREE.Group();
    const body = inkBox(0.2, 0.26, 0.2, materials.ink);
    const bodyRim = boxEdges(0.2, 0.26, 0.2, 0.82);
    const bail = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.012, 5, 12, Math.PI),
      materials.ink
    );
    bail.rotation.z = Math.PI;
    bail.position.y = 0.14;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), coreMat(CORE));
    const glow = makeGlowSprite(0.85, 0.38, 0xffffff);
    lantern.add(body, bodyRim, bail, core, glow);
    lantern.position.set(level.pickup.x, level.pickup.y + 0.52, level.pickup.z);
    lantern.userData = { kind: 'pickup', glow };
    lantern.name = 'pickup';
    group.add(lantern);
  }
  if (level.ending && level.monument?.kind !== 'eclipse') {
    const sun = new THREE.Group();
    sun.name = 'sun-disc';
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
    );
    const halo = makeGlowSprite(4.2, 0.32, 0xffffff);
    sun.add(disc, halo);
    sun.position.set(10.6, 4.4, 1.3);
    sun.lookAt(6, 1, 1);
    group.add(sun);
  }
  root.add(group);
  return group;
}

export function syncProps(group, level, extras, world) {
  if (!group) return;
  const pickup = group.getObjectByName('pickup');
  if (pickup) pickup.visible = !extras.lanternHeld;
  for (const child of group.children) {
    if (child.userData.kind === 'mirror') {
      child.rotation.y = extras.yaw?.[child.userData.id] ?? child.rotation.y;
    }
    if (child.userData.kind === 'lamp') {
      const light = world?.lights?.find(item => item.id === child.userData.id);
      const authoredLight = (level.lights || []).find(item => item.id === child.userData.id);
      if (light?.origin && authoredLight?.origin && child.userData.home) {
        child.position.x = child.userData.home[0] + light.origin[0] - authoredLight.origin[0];
        child.position.z = child.userData.home[2] + light.origin[2] - authoredLight.origin[2];
      }
      const on = !!(light && light.enabled !== false);
      const turnMark = child.getObjectByName('turn-mark');
      if (turnMark) {
        const canTurn = !!authoredLight
          && !authoredLight.rotate
          && (authoredLight.aimable !== false || authoredLight.movable);
        // 没通电的灯转不动，环要暗下来，表示「这盏以后有用，但现在还不行」。
        const powered = !authoredLight?.power || !!world?.closed?.[authoredLight.power];
        turnMark.visible = canTurn && !level.referenceStyle;
        turnMark.material.opacity = powered ? 0.62 : 0.16;
      }
      if (child.userData.core) child.userData.core.material.color.setHex(on ? CORE : CORE_OFF);
      if (child.userData.glow) {
        child.userData.glow.visible = on;
        child.userData.glow.material.opacity = on ? 0.72 : 0;
        child.userData.glow.material.color.setHex(on ? CORE : CORE_OFF);
      }
      if (child.userData.halo) {
        child.userData.halo.visible = on;
        child.userData.halo.material.opacity = on ? 0.26 : 0;
      }
      if (child.userData.shade?.material) {
        // 灭掉的灯罩要读成死物：不发光，纸面也压暗。
        const shadeMat = child.userData.shade.material;
        if (shadeMat.emissive) {
          shadeMat.emissive.setHex(on ? CORE : 0x000000);
          shadeMat.emissiveIntensity = on ? 0.85 : 0;
        }
        shadeMat.color.setHex(on ? PAPER : 0x2a2c2e);
      }
      if (child.userData.bulb) {
        child.userData.bulb.intensity = on ? (child.userData.tall ? 1.1 : 0.75) : 0;
        child.userData.bulb.visible = on;
      }
      if (child.userData.head && light?.direction) {
        const dir = new THREE.Vector3(...light.direction);
        if (dir.lengthSq() < 1e-6) dir.set(0, -1, 0);
        dir.normalize();
        child.userData.head.quaternion.setFromUnitVectors(DOWN, dir);
      }
    }
    if (child.userData.kind === 'lever' && child.userData.handle) {
      const on = !!world?.closed?.[child.userData.id];
      child.userData.handle.rotation.z = on ? -0.55 : 0.62;
    }
    if (child.userData.kind === 'seal' || child.userData.kind === 'sigil') {
      const on = !!world?.closed?.[child.userData.id];
      if (child.userData.glow) {
        child.userData.glow.visible = on;
        if (child.userData.glow.material) child.userData.glow.material.opacity = on ? 0.55 : 0.12;
      }
      if (child.userData.paper?.material) child.userData.paper.material.color.setHex(on ? 0xffffff : PAPER);
      if (child.userData.mark?.material) child.userData.mark.material.color.setHex(on ? 0xffffff : PAPER);
    }
    if (child.userData.kind === 'eye' && child.userData.slit) {
      const on = !!world?.closed?.[child.userData.id];
      child.userData.slit.material.color.setHex(on ? 0x111111 : PAPER);
    }
    if (child.userData.kind === 'wire') {
      const on = !!world?.closed?.[child.userData.from];
      for (const bead of child.userData.beads || []) {
        bead.material.emissiveIntensity = on ? 0.55 : 0;
        bead.material.color.setHex(on ? PAPER : 0x161616);
      }
    }
  }
}

export function rotateDetent(current, stepDeg = 15, dir = 1) {
  const step = (stepDeg * Math.PI) / 180;
  return current + step * dir;
}
