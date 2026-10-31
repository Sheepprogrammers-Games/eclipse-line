import * as THREE from 'three';

const SPOT = 0xf7f7f4;
const HEAD = new THREE.Vector3();
const AIM = new THREE.Vector3();

function rank(light) {
  if (light.type === 'point') return 2;
  if (light.type === 'virtual') return 1;
  return 0;
}

function intensityOf(light) {
  if (light.coverBeam) return 19.2;
  if (light.type === 'point') return 14;
  if (light.type === 'virtual') return 16.8;
  return 22.4;
}

function configureShadow(spot, quality, dist) {
  spot.castShadow = true;
  const size = quality === 'low' ? 512 : 2048;
  spot.shadow.mapSize.set(size, size);
  spot.shadow.bias = -0.00018;
  spot.shadow.normalBias = 0.035;
  spot.shadow.radius = quality === 'low' ? 1 : 1.5;
  spot.shadow.intensity = 0.94;
  spot.shadow.camera.near = 0.35;
  spot.shadow.camera.far = Math.max(dist, 4);
  spot.shadow.camera.updateProjectionMatrix();
}

function lampHead(scene, id) {
  const level = scene.getObjectByName('level');
  const props = level?.getObjectByName('props');
  if (!props) return null;
  for (const child of props.children) {
    if (child.userData.kind !== 'lamp' || child.userData.id !== id) continue;
    const obj = child.userData.core || child.userData.shade;
    if (!obj) return null;
    return obj.getWorldPosition(HEAD);
  }
  return null;
}

export function syncSceneLights(scene, world, quality = 'high', options = {}) {
  let group = scene.getObjectByName('scene-lights');
  if (!group) {
    group = new THREE.Group();
    group.name = 'scene-lights';
    scene.add(group);
  }

  const lights = (world.lights || [])
    .filter(light => light.enabled !== false && light.origin && (!options.referenceStyle || light.coverBeam))
    .slice()
    .sort((a, b) => rank(a) - rank(b));
  const budget = quality === 'low' ? 2 : 4;
  const keep = new Set();
  // 光来自越多方向，影子被别的光填得越淡；只剩一盏时才是硬投影。
  const casting = Math.max(1, lights.slice(0, budget).filter(light => !light.carried).length);
  const shadowFill = 0.96 / Math.sqrt(casting);

  lights.slice(0, budget).forEach(light => {
    const name = `spot-${light.id}`;
    keep.add(name);
    let spot = group.getObjectByName(name);
    const dir = new THREE.Vector3(...(light.direction || [0, -1, 0]));
    if (dir.lengthSq() < 1e-6) dir.set(0, -1, 0);
    dir.normalize();
    const angle = Math.min(Math.max(Number(light.angle) || Math.PI / 4.5, 0.12), Math.PI / 2.05);
    const dist = Math.min(Number(light.range) || 10, 18);
    const intensity = intensityOf(light);
    if (!spot) {
      spot = new THREE.SpotLight(SPOT, intensity, dist, angle, 0.06, 1.28);
      spot.name = name;
      const target = new THREE.Object3D();
      target.name = `${name}-target`;
      spot.target = target;
      configureShadow(spot, quality, dist);
      group.add(spot, target);
    }
    const head = lampHead(scene, light.id);
    if (head) spot.position.copy(head);
    else spot.position.set(light.origin[0], light.origin[1], light.origin[2]);
    AIM.copy(spot.position).addScaledVector(dir, 8);
    spot.target.position.copy(AIM);
    spot.color.setHex(SPOT);
    spot.intensity = intensity;
    spot.distance = dist;
    spot.angle = angle;
    spot.penumbra = 0.06;
    spot.decay = 1;
    // 点光源同样要投影，否则玩家转灯时脚下的影子不会跟着动。
    // 低画质下仍只让锥形灯投影，控制阴影贴图数量。
    spot.castShadow = !light.carried
      && (light.coverBeam || light.type !== 'point' || quality !== 'low');
    spot.shadow.intensity = shadowFill;
    if (light.coverBeam) {
      spot.penumbra = 0.015;
      spot.shadow.radius = 1;
      spot.shadow.intensity = Math.min(0.98, shadowFill + 0.1);
    }
    spot.shadow.camera.far = Math.max(dist, 4);
    spot.shadow.camera.updateProjectionMatrix();
    spot.visible = true;
    spot.target.visible = true;
  });

  for (const child of [...group.children]) {
    const id = child.name.replace(/-target$/, '');
    if (child.name && !keep.has(id) && !keep.has(child.name)) {
      if (child.shadow?.map) child.shadow.map.dispose();
      child.removeFromParent();
    }
  }
}
