import * as THREE from 'three';

function radialTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  for (const [t, color] of stops) g.addColorStop(t, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

let glowMap = null;
let blobMap = null;

export function makeGlowSprite(scale = 1.2, opacity = 0.24, color = 0xffffff) {
  if (!glowMap) {
    glowMap = radialTexture([
      [0, 'rgba(255,255,255,0.96)'],
      [0.3, 'rgba(255,255,255,0.34)'],
      [1, 'rgba(255,255,255,0)']
    ]);
  }
  const mat = new THREE.SpriteMaterial({
    map: glowMap,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(scale);
  sprite.renderOrder = 6;
  sprite.material.depthTest = true;
  return sprite;
}

export function makeHurtGlow(scale = 1.15) {
  const map = radialTexture([
    [0, 'rgba(255,255,255,0.92)'],
    [0.35, 'rgba(210,210,210,0.36)'],
    [1, 'rgba(255,255,255,0)']
  ]);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  mesh.scale.set(scale, scale, 1);
  mesh.name = 'hurt-glow';
  mesh.renderOrder = 8;
  mesh.visible = false;
  return mesh;
}

export function createAtmosphere(_quality = 'high') {
  const group = new THREE.Group();
  group.name = 'atmosphere';
  return group;
}

export function tickAtmosphere() {}

export function makeContactShadow(scale = 0.7) {
  if (!blobMap) {
    blobMap = radialTexture([
      [0, 'rgba(0,0,0,0.92)'],
      [0.38, 'rgba(0,0,0,0.42)'],
      [1, 'rgba(0,0,0,0)']
    ]);
  }
  const mat = new THREE.MeshBasicMaterial({
    map: blobMap,
    color: 0x000000,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    fog: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(scale, scale, 1);
  mesh.position.y = 0.02;
  mesh.name = 'blob-shadow';
  mesh.renderOrder = 2;
  return mesh;
}
