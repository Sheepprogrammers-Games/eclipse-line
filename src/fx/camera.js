import * as THREE from 'three';

// The cover uses a near-black void so the paper route carries the frame.
const VOID = 0x0d0e0f;
const PAPER = 0xf6f6f2;

export function createApp(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(VOID, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VOID);
  scene.fog = new THREE.Fog(VOID, 72, 150);

  // A long-lens camera keeps the spaces graphic and almost orthographic while
  // preserving a perspective camera for the optional first-person view.
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 120);
  const clock = new THREE.Clock();
  // 恒定环境光压到最低限度，让真实灯光承担照明，影子才有对比可言。
  const ambient = new THREE.AmbientLight(PAPER, 1.08);
  ambient.intensity = 0.3;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2d31, 0.3);
  hemi.name = 'hemi';
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.name = 'paper-key';
  key.position.set(-10, 20, -8);
  const fill = new THREE.DirectionalLight(0xbfc1c2, 0.12);
  fill.name = 'paper-fill';
  fill.position.set(10, 7, -12);
  scene.add(ambient, hemi, key, fill);

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x9fa1a0);
  const envLift = new THREE.Mesh(
    new THREE.SphereGeometry(6, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xe8e8e5, side: THREE.BackSide })
  );
  envLift.position.y = 2.4;
  envScene.add(envLift);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  return { scene, camera, renderer, clock, key: ambient, resize };
}

export function cameraOffset(spec = {}) {
  const pitch = THREE.MathUtils.degToRad(spec.pitch ?? 38);
  const dist = spec.dist ?? 16;
  const yaw = THREE.MathUtils.degToRad(spec.yaw ?? -38);
  return new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch) * dist,
    Math.sin(pitch) * dist,
    Math.cos(yaw) * Math.cos(pitch) * dist
  );
}

function applyLens(camera, spec = {}) {
  const fov = spec.fov ?? 24;
  if (Math.abs(camera.fov - fov) < 0.01) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

export function rigCamera(camera, target, spec, intro = 0) {
  applyLens(camera, spec);
  const offset = cameraOffset(spec);
  const extra = 1 + intro * 0.45;
  camera.position.set(
    target.x + offset.x * extra,
    target.y + offset.y * extra,
    target.z + offset.z * extra
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(target.x, target.y + 0.22, target.z);
  if (spec.roll) {
    camera.rotateZ(THREE.MathUtils.degToRad(spec.roll * (1 - intro)));
  }
}

export function springLook(camera, target, spec, dt, spring = { yaw: 0 }) {
  applyLens(camera, spec);
  const yaw = (spec.yaw ?? -38) + (spring.yaw || 0);
  const offset = cameraOffset({ ...spec, yaw });
  const pos = new THREE.Vector3(
    target.x + offset.x,
    target.y + offset.y,
    target.z + offset.z
  );
  camera.position.lerp(pos, 1 - Math.exp(-dt * 5.2));
  camera.up.set(0, 1, 0);
  camera.lookAt(target.x, target.y + 0.22, target.z);
  if (spec.roll) camera.rotateZ(THREE.MathUtils.degToRad(spec.roll));
  spring.yaw *= Math.exp(-dt * 6);
}

export function applyFirstPerson(camera, feet, lookYaw, lookPitch, eye = 1.22) {
  camera.position.set(feet.x, feet.y + eye, feet.z);
  camera.up.set(0, 1, 0);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = lookYaw;
  camera.rotation.x = lookPitch;
  camera.rotation.z = 0;
}

export { PAPER };
