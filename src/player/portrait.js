import * as THREE from 'three';

let portraitTexture = null;
const portraitMaterials = new Set();
export const PORTRAIT_ASPECT = 0.625;

function configureTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makePortraitTexture() {
  if (portraitTexture) return portraitTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  // The cover figure is deliberately anonymous: a round head, a folded
  // paper coat and two narrow legs. Keeping this as the source texture means
  // the body and its cast shadow always share one exact silhouette.
  const polygon = (points, fill, stroke = '#050607', width = 1.2) => {
    context.beginPath();
    points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.stroke();
  };

  // 方块人：头、躯干、双臂、双腿都是矩形，正面顶面各差一档明度，
  // 让剪影在纸面上仍读得出体积。
  const slab = (x, y, w, h, fill, stroke = '#d4d5d1', width = 1.1) => {
    polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, stroke, width);
  };

  slab(60, 20, 40, 38, '#101214');
  slab(64, 24, 32, 10, '#26292c', '#babcb8', 0.8);

  slab(70, 58, 20, 8, '#0a0b0c', '#babcb8', 0.9);

  slab(56, 66, 48, 74, '#111315');
  slab(60, 70, 40, 12, '#2b2e31', '#babcb8', 0.8);
  slab(60, 96, 40, 6, '#33363a', '#babcb8', 0.8);

  slab(38, 68, 18, 62, '#1b1d1f', '#babcb8', 0.9);
  slab(104, 68, 18, 62, '#090a0b', '#babcb8', 0.9);
  slab(38, 130, 18, 12, '#08090a', '#c8c9c5', 0.9);
  slab(104, 130, 18, 12, '#08090a', '#c8c9c5', 0.9);

  slab(58, 140, 20, 76, '#0b0c0d', '#c8c9c5', 1);
  slab(82, 140, 20, 76, '#151719', '#c8c9c5', 1);
  slab(52, 216, 30, 16, '#08090a', '#d4d5d1', 1);
  slab(80, 216, 30, 16, '#08090a', '#d4d5d1', 1);

  portraitTexture = configureTexture(new THREE.CanvasTexture(canvas));
  return portraitTexture;
}

export function createPortraitSprite(options = {}) {
  const material = new THREE.SpriteMaterial({
    color: options.color ?? 0xffffff,
    transparent: true,
    opacity: options.opacity ?? 1,
    alphaTest: 0.025,
    depthWrite: false,
    fog: true
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = options.name || 'portrait';
  sprite.center.set(0.5, 0.01);
  const size = options.size ?? 1.58;
  sprite.scale.set(size * PORTRAIT_ASPECT, size, 1);
  sprite.renderOrder = options.renderOrder ?? 5;
  material.map = makePortraitTexture();
  portraitMaterials.add(material);
  material.needsUpdate = true;
  sprite.visible = options.visible !== false;
  options.onReady?.(sprite);
  return sprite;
}

export function registerPortraitMaterial(material) {
  if (!material) return material;
  portraitMaterials.add(material);
  if (portraitTexture) {
    material.map = portraitTexture;
    material.needsUpdate = true;
  }
  return material;
}
