import * as THREE from 'three';

export const PAPER = 0xf6f6f2;
export const VOID = 0x0d0e0f;
export const SEAM = 0xffffff;
export const FLASH_GREY = 0xccccca;

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function finishMap(texture, repeat = 1) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}

function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  return new THREE.CanvasTexture(canvas);
}

export function makeHatchMap() {
  return finishMap(canvasTexture(128, (ctx, size) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(12,12,12,0.22)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'square';
    for (let i = -size; i < size * 2; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(12,12,12,0.08)';
    for (let i = -size; i < size * 2; i += 11) {
      ctx.beginPath();
      ctx.moveTo(i, size);
      ctx.lineTo(i + size, 0);
      ctx.stroke();
    }
  }), 5);
}

export function makeHalftonePaper() {
  return finishMap(canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    for (let y = 3; y < size; y += 6) {
      const stagger = Math.floor(y / 6) % 2 === 0 ? 3 : 6;
      for (let x = stagger; x < size; x += 6) {
        const n = hash(x, y);
        const r = 0.55 + n * 0.85;
        ctx.fillStyle = `rgba(12,12,12,${0.22 + n * 0.38})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }), 3.1);
}

export function makeGrainMap() {
  return finishMap(canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const p = i / 4;
      const x = p % size;
      const y = (p / size) | 0;
      const n = hash(x * 0.37, y * 0.41);
      const speck = (n * 28) | 0;
      data[i] = 255 - speck;
      data[i + 1] = 255 - speck;
      data[i + 2] = 255 - speck;
    }
    ctx.putImageData(image, 0, 0);
  }), 1.8);
}

function makePrintedPaperMap() {
  return finishMap(canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const p = i / 4;
      const x = p % size;
      const y = (p / size) | 0;
      const tooth = (hash(x * 0.33, y * 0.29) * 22) | 0;
      data[i] = 255 - tooth;
      data[i + 1] = 255 - tooth;
      data[i + 2] = 255 - tooth;
    }
    ctx.putImageData(image, 0, 0);
    ctx.lineWidth = 0.55;
    ctx.lineCap = 'square';
    for (let i = 0; i < 168; i += 1) {
      const x = hash(i + 7, 13) * size;
      const y = hash(i + 19, 29) * size;
      const length = 4 + hash(i + 31, 47) * 18;
      const bend = (hash(i + 53, 61) - 0.5) * 1.8;
      ctx.strokeStyle = `rgba(24,24,24,${0.008 + hash(i + 71, 79) * 0.018})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + length * 0.5, y + bend, x + length, y + bend * 0.35);
      ctx.stroke();
    }
    for (let y = 8; y < size; y += 14) {
      const stagger = Math.floor(y / 14) % 2 === 0 ? 7 : 14;
      for (let x = stagger; x < size; x += 14) {
        const n = hash(x + 2, y + 5);
        if (n < 0.55) continue;
        ctx.fillStyle = `rgba(40,40,40,${0.04 + n * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }), 2.8);
}

export function makeDitherGlow() {
  return finishMap(canvasTexture(64, (ctx, size) => {
    const g = ctx.createRadialGradient(32, 8, 1, 32, 22, 38);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(240,240,237,0.28)');
    g.addColorStop(1, 'rgba(240,240,237,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    for (let y = 0; y < size; y += 2) {
      for (let x = y % 4 === 0 ? 0 : 1; x < size; x += 2) {
        if (hash(x, y) > 0.45) ctx.fillRect(x, y, 1, 1);
      }
    }
  }), 1);
}

export function createPaperMaterials(_renderer, _settings = {}) {
  const grain = makePrintedPaperMap();
  const hatch = makeHatchMap();
  grain.repeat.set(2.2, 2.2);
  grain.anisotropy = Math.min(8, _renderer.capabilities?.getMaxAnisotropy?.() || 1);
  hatch.anisotropy = grain.anisotropy;

  const paper = new THREE.MeshStandardMaterial({
    color: PAPER,
    map: grain,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.26,
    emissive: 0x171815,
    emissiveIntensity: 0.09,
    fog: true
  });
  paper.shadowSide = THREE.FrontSide;

  const floor = new THREE.MeshStandardMaterial({
    color: 0xf4f4f0,
    map: grain,
    roughness: 0.97,
    metalness: 0,
    envMapIntensity: 0.28,
    emissive: 0x1b1c19,
    emissiveIntensity: 0.1,
    fog: true
  });
  floor.shadowSide = THREE.FrontSide;

  const over = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  });
  const litTop = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: grain,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.3,
    emissive: 0x1b1c19,
    emissiveIntensity: 0.1,
    fog: true
  });
  const litSide = new THREE.MeshStandardMaterial({ color: 0x46484c, map: hatch, roughness: 0.96, metalness: 0 });
  const crate = new THREE.MeshStandardMaterial({ color: 0x151719, map: hatch, roughness: 0.98, metalness: 0 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 1, metalness: 0 });
  const dim = new THREE.MeshBasicMaterial({ color: VOID });
  const side = new THREE.MeshStandardMaterial({
    color: 0x4b4d52,
    map: hatch,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.18
  });
  return { paper, floor, over, litTop, litSide, crate, ink, dim, side, grain, hatch, halftone: null };
}

export function shredsAt(scene, origin, kind, quality) {
  if (quality === 'low') return;
  const group = new THREE.Group();
  const color = kind === 'overexposure' ? 0xffffff : 0x111111;
  for (let i = 0; i < 10; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12 + Math.random() * 0.16, 0.04 + Math.random() * 0.08),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      })
    );
    mesh.position.set(
      origin.x + (Math.random() - 0.5) * 0.5,
      origin.y + 0.3,
      origin.z + (Math.random() - 0.5) * 0.5
    );
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.userData.v = new THREE.Vector3(
      (Math.random() - 0.5) * 1.4,
      0.8 + Math.random(),
      (Math.random() - 0.5) * 1.4
    );
    group.add(mesh);
  }
  group.userData.life = 0.7;
  scene.add(group);
  return group;
}

export function tickShreds(group, dt) {
  if (!group) return false;
  group.userData.life -= dt;
  for (const child of group.children) {
    child.position.addScaledVector(child.userData.v, dt);
    child.userData.v.y -= 2.4 * dt;
    child.material.opacity = Math.max(0, group.userData.life / 0.7);
  }
  if (group.userData.life <= 0) {
    group.removeFromParent();
    return false;
  }
  return true;
}
