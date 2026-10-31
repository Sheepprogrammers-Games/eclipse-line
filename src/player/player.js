import * as THREE from 'three';
import { faceCenter, boxId } from '../engine/aabb.js';
import { faceKey } from '../engine/walkable.js';
import { groundHeightAt } from '../engine/collision.js';
import { makeContactShadow, makeHurtGlow } from '../fx/atmosphere.js';
import { createPortraitSprite } from './portrait.js';

const PAPER = 0xf2eee5;
const INK = 0x151719;
const EDGE = 0xf7f3e9;
const BLUSH = 0xbfc3c5;

function stroke(mesh, opacity = 0.55) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 18),
    new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity })
  );
  mesh.add(edges);
  return mesh;
}


function cutoutMaterial(materials, color = INK) {
  return new THREE.MeshStandardMaterial({
    color,
    map: materials?.hatch || null,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide
  });
}



export function createPlayer(materials, _texture, silhouette = 0) {
  const group = new THREE.Group();
  group.name = 'player';
  const body = new THREE.Group();
  body.name = 'body';
  const dark = cutoutMaterial(materials);
  const darker = cutoutMaterial(materials, 0x090a0b);

  // 方块人：所有部件都是轴对齐的盒子，关节留在肩与胯，
  // 剪影优先，转身时仍读得出朝向。
  const block = (w, h, d, material, edgeOpacity = 0.7) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity: edgeOpacity })
    );
    mesh.add(edges);
    return mesh;
  };

  const torso = block(0.42, 0.46, 0.26, dark, 0.72);
  torso.position.y = 0.76;
  torso.name = 'torso';

  const hips = block(0.38, 0.13, 0.25, darker, 0.6);
  hips.position.y = 0.46;

  const neck = block(0.13, 0.06, 0.13, darker, 0.5);
  neck.position.y = 1.02;

  const head = block(0.32, 0.3, 0.3, darker, 0.78);
  head.position.y = 1.2;
  head.name = 'head';

  const brow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.035),
    new THREE.MeshBasicMaterial({ color: EDGE, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  brow.position.set(0, 1.23, 0.151);
  head.add(brow);

  const legGeoY = -0.22;
  const leftLeg = new THREE.Group();
  leftLeg.name = 'leftLeg';
  leftLeg.position.set(-0.1, 0.46, 0);
  const leftShin = block(0.16, 0.44, 0.18, dark, 0.6);
  leftShin.position.y = legGeoY;
  leftLeg.add(leftShin);

  const rightLeg = new THREE.Group();
  rightLeg.name = 'rightLeg';
  rightLeg.position.set(0.1, 0.46, 0);
  const rightShin = block(0.16, 0.44, 0.18, dark, 0.6);
  rightShin.position.y = legGeoY;
  rightLeg.add(rightShin);

  const leftArm = new THREE.Group();
  leftArm.name = 'leftArm';
  leftArm.position.set(-0.26, 0.94, 0);
  const leftUpper = block(0.11, 0.36, 0.15, dark, 0.56);
  leftUpper.position.y = -0.16;
  leftArm.add(leftUpper);

  const rightArm = new THREE.Group();
  rightArm.name = 'rightArm';
  rightArm.position.set(0.26, 0.94, 0);
  const rightUpper = block(0.11, 0.36, 0.15, dark, 0.56);
  rightUpper.position.y = -0.16;
  rightArm.add(rightUpper);

  // 通关进度刻线，贴在躯干正面。
  const marks = new THREE.Group();
  marks.name = 'marks';
  const folds = Math.min(5, Math.max(1, silhouette));
  for (let i = 0; i < folds; i += 1) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2 - i * 0.02, 0.012),
      new THREE.MeshBasicMaterial({ color: EDGE, transparent: true, opacity: 0.22 + i * 0.05, side: THREE.DoubleSide })
    );
    line.position.set(0, 0.62 + i * 0.07, 0.132);
    marks.add(line);
  }

  body.add(torso, hips, neck, head, leftLeg, rightLeg, leftArm, rightArm, marks);

  const portrait = createPortraitSprite({
    name: 'portrait',
    size: 1.68,
    color: 0xd7d8d4,
    visible: true
  });
  portrait.visible = false;
  portrait.position.set(0, 0.012, 0.08);

  const lantern = new THREE.Group();
  lantern.name = 'held-lantern';
  lantern.visible = false;
  const shade = stroke(new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    new THREE.MeshLambertMaterial({ color: PAPER })
  ), 0.72);
  shade.scale.set(1, 1.15, 1);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  const glow = new THREE.PointLight(0xf7f7f4, 0.5, 2.6);
  lantern.add(shade, core, glow);
  lantern.position.set(0.24, 0.67, 0.08);

  // 只作接地暗部。真正的影子由投影灯投出，这里压低以免看起来像第二个影子。
  const blob = makeContactShadow(0.62);
  blob.material.opacity = 0.16;
  const hurt = makeHurtGlow(1.45);

  group.add(body, portrait, lantern, blob, hurt);
  group.userData = { yaw: Math.PI / 2, phase: 0, moving: false, bob: 0, portrait };
  group.rotation.y = Math.PI / 2;
  return group;
}

export function tickPlayer(player, dt, moving) {
  const data = player.userData;
  data.moving = moving;
  const targetYaw = data.yaw ?? player.rotation.y;
  player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, targetYaw, 1 - Math.exp(-dt * 8));
  data.phase += dt * (moving ? 9.5 : 2.2);
  const swing = moving ? Math.sin(data.phase) * 0.28 : 0;
  const left = player.getObjectByName('leftLeg');
  const right = player.getObjectByName('rightLeg');
  const leftArm = player.getObjectByName('leftArm');
  const rightArm = player.getObjectByName('rightArm');
  const body = player.getObjectByName('body');
  const portrait = player.getObjectByName('portrait');
  // 关节在肩胯，只绕前后轴摆，方块人不做侧向扭动。
  if (left) left.rotation.x = swing;
  if (right) right.rotation.x = -swing;
  if (leftArm) leftArm.rotation.x = -swing * 0.75;
  if (rightArm) rightArm.rotation.x = swing * 0.75;
  const bob = moving ? Math.abs(Math.sin(data.phase)) * 0.045 : Math.sin(data.phase * 0.5) * 0.012;
  if (body) body.position.y = bob;
  if (portrait) portrait.position.y = 0.012 + bob;
}

export function placePlayer(group, pose, box) {
  if (box) {
    const c = faceCenter(box, pose.face || '+y');
    group.position.set(pose.x ?? c[0], pose.y ?? c[1], pose.z ?? c[2]);
  } else {
    group.position.set(pose.x, pose.y, pose.z);
  }
}

export function followPath(player, world, path, t, speed = 3.15, origin = null) {
  if (!path || path.length === 0) return { done: true, face: null };
  const boxes = new Map(world.boxes.map(box => [box.id || boxId(box), box]));
  const stepBoxes = new Set();
  for (const ref of path) {
    const box = boxes.get(ref.boxId);
    if (box) stepBoxes.add(box);
  }
  const pts = [];
  if (origin) pts.push([origin.x, origin.y, origin.z]);
  const skipCurrent = origin && path.length > 1;
  for (let n = skipCurrent ? 1 : 0; n < path.length; n += 1) {
    const ref = path[n];
    const box = boxes.get(ref.boxId);
    pts.push(box ? faceCenter(box, ref.face) : [player.position.x, player.position.y, player.position.z]);
  }
  if (pts.length < 2) {
    const last = path[path.length - 1];
    return { done: true, face: last, key: last ? faceKey(last) : null };
  }
  let dist = Math.max(0, t) * speed;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 0.001;
    if (dist <= seg) {
      const k = dist / seg;
      const px = a[0] + (b[0] - a[0]) * k;
      const pz = a[2] + (b[2] - a[2]) * k;
      const ramp = a[1] + (b[1] - a[1]) * k;
      const ground = groundHeightAt(world.boxes, px, pz, Math.min(a[1], b[1]), {
        stepUp: Math.abs(b[1] - a[1]) + 0.05,
        standable: box => stepBoxes.has(box)
      });
      player.position.set(px, ground == null ? ramp : ground, pz);
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      if (Math.abs(dx) + Math.abs(dz) > 0.01) player.userData.yaw = Math.atan2(dx, dz);
      const fromIdx = i;
      const toIdx = i + 1;
      const face = path[Math.min(path.length - 1, k >= 0.82 ? toIdx : fromIdx)];
      return { done: false, face, key: face ? faceKey(face) : null };
    }
    dist -= seg;
  }
  const last = pts[pts.length - 1];
  player.position.set(last[0], last[1], last[2]);
  return { done: true, face: path[path.length - 1], key: faceKey(path[path.length - 1]) };
}

export function lanternLight(player, on, face = '+y', extra = {}) {
  const n = face === '-x' ? [-1, 0, 0]
    : face === '+x' ? [1, 0, 0]
      : face === '-z' ? [0, 0, -1]
        : face === '+z' ? [0, 0, 1]
          : [0, 1, 0];
  const out = face === '+y' ? 0 : 0.28;
  return {
    id: 'lantern',
    type: 'point',
    // 灯提在自己手上，不能拿它给自己投影，否则人一动影子就绕着人甩。
    carried: true,
    origin: [
      player.position.x + n[0] * out,
      player.position.y + 1.05,
      player.position.z + n[2] * out
    ],
    range: 3.4,
    enabled: on,
    ignoreBoxIds: ['player', ...(extra.ignoreBoxIds || [])],
    skipBoxIds: extra.skipBoxIds || []
  };
}
