import * as THREE from 'three';
import { LEVELS } from './content/levels.js?v=113';
import { COPY, CHAPTERS } from './content/copy.js?v=113';
import { loadSave, writeSave, setLevelCount, RESUME_VERSION } from './save.js?v=113';
import { lightCount, lightsOnFace } from './engine/lights.js';
import { walkableFaces, faceKey, isWalkRole } from './engine/walkable.js';
import { bodyOverlapsRaisedSolid, bodyPathClearsRaisedSolids } from './engine/collision.js?v=113';
import { dragCrate } from './engine/crate.js?v=113';
import { buildGraph, findPath, facesStepAdjacent, facesShareEdge } from './engine/path.js';
import { createRunState, stamp, fall as checkpointFall, inputLocked, checkpointIsSafe } from './engine/checkpoint.js';
import { hazardAtPoint } from './engine/hazard.js';
import { resolveWorld } from './engine/resolve.js';
import { boxId, faceCenter } from './engine/aabb.js';
import {
  cloneShadowPose,
  foldShadowPath,
  freezeShadowShape,
  nearestShadowSurface,
  projectShadowPoint,
  shadowSurfacePath,
  shadowSurfaceAt,
  shadowControlState,
  clampShadowToTether,
  shadowPoseNearSwitch,
  shadowShapeAt,
  shadowHitBlockedBySolid,
  shadowTipNearTarget,
  shadowPoseSignature,
  swapShadowPositions
} from './engine/shadow.js?v=113';
import { createApp, rigCamera, springLook, applyFirstPerson } from './fx/camera.js';
import { createPaperMaterials, shredsAt, tickShreds } from './fx/paper.js';
import { createAtmosphere, tickAtmosphere } from './fx/atmosphere.js';
import { createLevelRoot, buildLevel, syncLevel, tickReveals, worldToFaceRef } from './world/level.js';
import { addProps, syncProps, syncCones, rotateDetent } from './world/props.js';
import { createPlayer, followPath, lanternLight, tickPlayer } from './player/player.js';
import { createAudio } from './audio/music.js';
import { coachState, resolveCoachTarget } from './ui/coach.js';
import { formatRunTime, mergeRunRecord } from './ui/run.js';
import { syncSceneLights } from './world/lights3d.js';
import { syncShadowField, tickShadowField } from './world/shadowfield.js';
import { createShadowAvatar, syncShadowAvatar, tickShadowAvatar } from './world/shadowavatar.js?v=107';
import { createGamepadTracker, selectGamepad } from './input/gamepad.js';
import { selectContextAction } from './input/context.js';

const canvas = document.getElementById('view');
const bootScreen = document.getElementById('boot-screen');
const app = createApp(canvas);
const audio = createAudio();
setLevelCount(LEVELS.length);
let save = loadSave();
const materials = createPaperMaterials(app.renderer, save);
const gamepadTracker = createGamepadTracker();

const overlays = {
  title: document.getElementById('title'),
  guide: document.getElementById('guide'),
  chapters: document.getElementById('chapters'),
  pause: document.getElementById('pause'),
  settings: document.getElementById('settings'),
  confirm: document.getElementById('confirm'),
  chapter: document.getElementById('chapter-card'),
  clear: document.getElementById('clear-card'),
  credits: document.getElementById('credits')
};

let focusRequest = 0;

function focusableElements(root) {
  if (!root) return [];
  return [...root.querySelectorAll('button, input, [tabindex]')].filter(el => (
    !el.disabled
    && !el.classList.contains('hidden')
    && el.getAttribute('aria-hidden') !== 'true'
    && el.getClientRects().length > 0
  ));
}

function show(name) {
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle('open', key === name);
  }
  const token = ++focusRequest;
  if (!name) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return;
  }
  requestAnimationFrame(() => {
    const root = overlays[name];
    if (token !== focusRequest || !root?.classList.contains('open')) return;
    const choices = focusableElements(root);
    const target = choices.find(el => el.hasAttribute('data-autofocus'))
      || choices.find(el => el.classList.contains('primary'))
      || choices[0];
    target?.focus({ preventScroll: true });
  });
}

const hud = document.getElementById('hud');
const objective = document.getElementById('objective');
const objectiveText = document.getElementById('objective-text');
const checkpointState = document.getElementById('checkpoint-state');
const levelState = document.getElementById('level-state');
const flashEl = document.getElementById('flash');
const actionPrompt = document.getElementById('action-prompt');
const nearbyPrompt = document.getElementById('nearby-prompt');
const nearbyPromptKey = document.getElementById('nearby-prompt-key');
const nearbyPromptText = document.getElementById('nearby-prompt-text');
const shadowAction = document.getElementById('shadow-action');
const shadowConsole = document.getElementById('shadow-console');
const shadowLengthValue = document.getElementById('shadow-length-value');
const shadowPin = document.getElementById('shadow-pin');
const shadowRelease = document.getElementById('shadow-release');
const shadowSwitch = document.getElementById('shadow-switch');
const controlState = document.getElementById('control-state');
const controlStateMark = document.getElementById('control-state-mark');
const controlStateText = document.getElementById('control-state-text');
const controlStateHint = document.getElementById('control-state-hint');
const exposureMeter = document.getElementById('exposure-meter');
const pauseBtn = document.getElementById('pause-btn');
const coachEl = document.getElementById('coach');
const coachText = document.getElementById('coach-text');
const inputStatus = document.getElementById('input-status');
const pauseReason = document.getElementById('pause-reason');
const levelIntro = document.getElementById('level-intro');
document.getElementById('credits-body').innerHTML = COPY.creditsBody.map(line => `<div>${line}</div>`).join('');
overlays.title.style.setProperty('--hero', "url('./assets/title-hero-v78.png')");
app.camera.position.set(8, 6.5, 12);
app.camera.lookAt(0, 0.4, 0);

const markerGeo = new THREE.RingGeometry(0.34, 0.5, 40);
const markerMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.88,
  side: THREE.DoubleSide,
  depthTest: false
});
const marker = new THREE.Mesh(markerGeo, markerMat);
marker.rotation.x = -Math.PI / 2;
marker.renderOrder = 12;
marker.visible = false;
app.scene.add(marker);

let guideStep = 0;
let guideMode = 'how';
let levelIntroTimer = 0;
const LEVEL_INTRO_SECONDS = 1.2;
const START_INPUT_GRACE_MS = 800;

function hasProgress() {
  return save.started || save.highest > 0;
}

function setPlayChrome(on) {
  hud.classList.toggle('hidden', !on);
  objective.classList.toggle('hidden', !on);
  pauseBtn.classList.toggle('hidden', !on);
  coachEl.classList.add('hidden');
  document.getElementById('stick').classList.toggle('hidden', !on);
  document.getElementById('views').classList.toggle('hidden', !on);
  exposureMeter.classList.toggle('hidden', !on);
  if (!on) {
    shadowAction.classList.add('hidden');
    shadowConsole.classList.add('hidden');
    shadowSwitch.classList.add('hidden');
    controlState.classList.add('hidden');
    shadowAvatar.visible = false;
  }
  if (!on) {
    marker.visible = false;
    document.exitPointerLock?.();
    game.lookDrag = null;
    clearTimeout(levelIntroTimer);
    levelIntro.classList.add('hidden');
    levelIntro.classList.remove('reveal');
    nearbyPrompt.classList.add('hidden');
  }
  syncFpsHud(on);
  if (on) updateControlUi();
}

function showLevelIntro(resumed = false) {
  const lv = level();
  clearTimeout(levelIntroTimer);
  if (lv.referenceStyle) {
    levelIntro.classList.add('hidden');
    levelIntro.classList.remove('reveal');
    return;
  }
  document.getElementById('level-intro-kicker').textContent = `第 ${lv.chapter} 章 · ${String(game.index + 1).padStart(2, '0')} / ${String(LEVELS.length).padStart(2, '0')}`;
  document.getElementById('level-intro-name').textContent = lv.name;
  document.getElementById('level-intro-note').textContent = resumed ? '从固化的蚀线继续' : '纸城正在显影';
  levelIntro.classList.remove('hidden', 'reveal');
  void levelIntro.offsetWidth;
  levelIntro.classList.add('reveal');
  levelIntroTimer = setTimeout(() => {
    levelIntro.classList.add('hidden');
    levelIntro.classList.remove('reveal');
  }, 2650);
}

function refreshTitleButtons() {
  const progress = hasProgress();
  const start = document.getElementById('btn-start');
  const cont = document.getElementById('btn-continue');
  start.textContent = progress ? COPY.newGame : COPY.start;
  start.classList.toggle('primary', !progress);
  const resumedLevel = save.resume?.index === save.current ? LEVELS[save.current] : null;
  cont.textContent = resumedLevel ? `继续检查点 · ${resumedLevel.name}` : COPY.continue;
  cont.classList.toggle('hidden', !progress);
  cont.classList.toggle('primary', progress);
}

function fillGuideRules() {
  const wrap = document.getElementById('guide-rules');
  wrap.innerHTML = COPY.rules.map(rule => (
    `<div class="rule ${rule.tone}"><strong>${rule.name}</strong><span>${rule.line}</span></div>`
  )).join('');
}

function renderGuide() {
  const page = COPY.guide[guideStep];
  const last = guideStep >= COPY.guide.length - 1;
  document.getElementById('guide-kicker').textContent = page.kicker;
  document.getElementById('guide-title').textContent = page.title;
  document.getElementById('guide-body').textContent = page.body;
  document.getElementById('guide-rules').classList.toggle('hidden', guideStep !== 1);
  const next = document.getElementById('guide-next');
  if (!last) next.textContent = COPY.next;
  else if (guideMode === 'start') next.textContent = COPY.begin;
  else if (guideMode === 'pause') next.textContent = COPY.resume;
  else next.textContent = COPY.gotIt;
}

function openGuide(mode) {
  guideMode = mode;
  guideStep = 0;
  game.screen = 'guide';
  renderGuide();
  setPlayChrome(false);
  show('guide');
}

function leaveGuide() {
  if (guideMode === 'start') {
    save = writeSave({ seenTutorial: true, started: true, current: 0 });
    startPlay(0);
    return;
  }
  if (guideMode === 'pause') {
    game.screen = 'pause';
    resumeGame();
    return;
  }
  openTitle();
}

const levelRoot = createLevelRoot();
app.scene.add(levelRoot);
const atmosphere = createAtmosphere(save.quality);
app.scene.add(atmosphere);
let player = createPlayer(materials, null, save.highest);
app.scene.add(player);
const shadowAvatar = createShadowAvatar();
app.scene.add(shadowAvatar);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = app.clock;

const game = {
  screen: 'title',
  prevScreen: 'title',
  index: save.current || 0,
  time: 0,
  intro: LEVEL_INTRO_SECONDS,
  yaw: {},
  enabled: {},
  cratePos: {},
  lampPos: {},
  lanternHeld: false,
  lanternOn: false,
  path: null,
  pathT: 0,
  pathFrom: null,
  face: null,
  run: null,
  world: null,
  graph: null,
  pickables: [],
  shreds: [],
  drag: null,
  hazardStep: null,
  hintUntil: 0,
  hintTarget: null,
  slowmo: 1,
  slowmoUntil: 0,
  sawWhite: false,
  revealFired: false,
  revealUntil: 0,
  ending: 0,
  hiddenHold: 0,
  coachMiss: null,
  coachMissUntil: 0,
  lastFall: null,
  lastFallUntil: 0,
  dying: false,
  won: false,
  levers: {},
  viewIndex: 0,
  firstPerson: false,
  lookYaw: Math.PI,
  lookPitch: 0.08,
  aim: null,
  lookDrag: null,
  focusLamp: null,
  freeMoving: false,
  wasFreeMoving: false,
  handLamp: null,
  checkpoint: null,
  checkpointLabel: '起点',
  checkpointPulse: 0,
  hurt: false,
  lastInput: window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'keyboard',
  pauseReason: '',
  inputGraceUntil: 0,
  runElapsed: 0,
  runFalls: 0,
  runHintUsed: false,
  clearResult: null,
  resumed: false,
  nearbyAction: null,
  shadowCast: null,
  shadowTarget: null,
  lightSync: 0,
  shadowPose: null,
  shadowDetached: false,
  shadowAnchor: null,
  shadowLastSafePose: null,
  shadowRoute: [],
  shadowSwitchLatched: false,
  shadowGraph: null,
  shadowPath: null,
  shadowPathFrom: null,
  shadowWalk: null,
  controlMode: 'body',
  shadowSync: 0,
  shadowLastSignature: 'none',
  awaitingNeutralInput: false
};

// Read-only runtime handle for the local smoke harness. It is intentionally
// non-UI and lets the browser check the authored pose/camera without relying
// on pixel coordinates that change with viewport size.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__eclipseDebug', {
    configurable: true,
    value: { game, app, THREE, getPlayer: () => player, level: () => level() }
  });
}

function level() {
  return LEVELS[game.index] || LEVELS[0];
}

function shadowControlEnabled() {
  if (level().shadowControl) return level().shadowControl.enabled !== false;
  return (level().lights || []).some(light => light.enabled !== false && light.type !== 'virtual');
}

function controlledPosition() {
  if (game.controlMode === 'shadow' && game.shadowPose) {
    return new THREE.Vector3(game.shadowPose.x, game.shadowPose.y, game.shadowPose.z);
  }
  return player.position;
}

function shadowLightForBody() {
  if (!game.world) return null;
  const lights = game.world.lights || [];
  const configuredId = level().shadowControl?.lightId;
  const configured = configuredId
    ? lights.find(light => light.id === configuredId && light.origin && light.enabled !== false)
    : null;
  if (configured) return configured;
  const preferred = game.shadowCast?.lightId
    ? lights.find(light => light.id === game.shadowCast.lightId)
    : null;
  if (preferred?.origin && preferred.enabled !== false) return preferred;
  const targetIds = new Set((level().shadowTargets || []).map(target => target.lightId));
  const targetLight = lights.find(light => targetIds.has(light.id)
    && light.origin
    && light.enabled !== false
    && light.type !== 'virtual');
  if (targetLight) return targetLight;
  const lit = game.face ? lightsOnFace(game.world, game.face) : [];
  const fromFace = lit.find(light => light.origin && light.enabled !== false && light.type !== 'virtual');
  if (fromFace) return fromFace;
  return lights.find(light => light.origin && light.enabled !== false && light.type !== 'virtual') || null;
}

function shadowPoseFromLight(light, floorY) {
  if (!light || !game.world) return null;
  const config = level().shadowControl || {};
  const options = {
    height: config.height || 1.02,
    maxDistance: config.maxDistance || 12,
    maxStep: config.maxStep || 2.4,
    maxGap: config.maxGap || 3.2,
    floorY
  };
  const projected = projectShadowPoint(player.position, light, floorY, options);
  if (!projected) return null;
  const path = foldShadowPath(
    [player.position.x, floorY, player.position.z],
    [projected.x, projected.y, projected.z],
    game.world.boxes,
    { rampRun: config.rampRun || 0.82 }
  );
  const endpoint = path[path.length - 1] || [projected.x, projected.y, projected.z];
  const surfaceLength = path.slice(1).reduce((total, point, index) => {
    const previous = path[index];
    return total + Math.hypot(
      point[0] - previous[0],
      point[1] - previous[1],
      point[2] - previous[2]
    );
  }, 0);
  const surface = shadowSurfaceAt(game.world, player.position, light, options)
    || nearestShadowSurface(game.world, projected, floorY, options);
  game.shadowRoute = shadowSurfacePath(game.world, player.position, light, options);
  return {
    // Keep the visible tip at the physical ray/plane intersection. Surface
    // metadata is only used by the legacy path graph and must not bend the
    // live shadow toward the nearest tile.
    x: endpoint[0],
    y: endpoint[1],
    z: endpoint[2],
    boxId: surface?.boxId || game.face?.boxId || null,
    face: surface?.face || '+y',
    yaw: player.userData.yaw || 0,
    length: surfaceLength || projected.distance,
    path,
    detached: false,
    lightId: projected.lightId || light.id || null
  };
}

function refreshShadowPose(force = false) {
  if (!shadowControlEnabled() || !game.world) {
    game.shadowPose = null;
    game.shadowDetached = false;
    shadowAvatar.visible = false;
    return false;
  }
  const light = shadowLightForBody();
  if ((!game.shadowDetached || force) && light) {
    const bodyBox = findBox(game.face?.boxId);
    const floorY = bodyBox?.max?.[1] ?? player.position.y;
    const next = shadowPoseFromLight(light, floorY);
    if (next) {
      const previous = game.shadowPose;
      // Keep the physical endpoint, but ease visual motion when a lamp turns
      // across adjacent paper surfaces. This removes frame-to-frame snaps
      // without changing which surface can be used by the puzzle graph.
      if (!force && previous && !game.shadowDetached && next.path?.length <= 2) {
        const blend = 1 - Math.exp(-18 * 0.05);
        next.x = previous.x + (next.x - previous.x) * blend;
        next.y = previous.y + (next.y - previous.y) * blend;
        next.z = previous.z + (next.z - previous.z) * blend;
        next.length = previous.length + (next.length - previous.length) * blend;
      }
      game.shadowPose = next;
    } else {
      game.shadowPose = {
        x: player.position.x,
        y: player.position.y + 0.035,
        z: player.position.z,
        boxId: game.face?.boxId || null,
        face: '+y',
        yaw: player.userData.yaw || 0,
        length: 0,
        detached: false,
        lightId: light.id || null
      };
      game.shadowRoute = [];
    }
  }
  if (game.shadowPose) {
    game.shadowPose.detached = !!game.shadowDetached;
    const body = player.position;
    shadowAvatar.userData.active = game.controlMode === 'shadow';
    syncShadowAvatar(shadowAvatar, {
      enabled: game.screen === 'play' && !game.dying && !game.won,
      pose: game.shadowPose,
      bodyPosition: body,
      light,
      route: game.shadowRoute,
      active: game.controlMode === 'shadow',
      pinnedShape: game.shadowCast?.shape || null,
      referenceStyle: !!level().referenceStyle
    });
  }
  return !!game.shadowPose;
}

function updateControlUi() {
  const enabled = game.screen === 'play'
    && level().shadowControl?.swap === true
    && shadowControlEnabled()
    && !!game.shadowPose
    && !game.dying
    && !game.won;
  controlState.classList.toggle('hidden', !enabled);
  shadowSwitch.classList.toggle('hidden', !enabled || game.lastInput !== 'touch');
  if (!enabled) return;
  const state = shadowControlState({
    mode: game.controlMode,
    detached: game.shadowDetached,
    pose: game.shadowPose
  });
  const shadow = state.mode === 'shadow';
  controlState.dataset.mode = state.label;
  controlStateMark.textContent = shadow ? '影' : '身';
  controlStateText.textContent = shadow ? COPY.shadowControlShadow : COPY.shadowControlBody;
  controlStateHint.textContent = COPY.shadowControlHint;
  shadowSwitch.classList.toggle('active', shadow);
  const label = shadow ? COPY.shadowControlReturn : COPY.shadowControlTake;
  shadowSwitch.setAttribute('aria-label', label);
  shadowSwitch.title = label;
}

function shadowSwitchTarget() {
  if (game.controlMode !== 'shadow' || !game.shadowPose) return null;
  const config = level().shadowControl || {};
  for (const sw of level().switches || []) {
    if (sw.kind !== 'shadow') continue;
    if (shadowPoseNearSwitch(game.shadowPose, sw, game.world, config.switchRadius || 0.72)) {
      return sw;
    }
  }
  return null;
}

function toggleShadowControl() {
  if (level().shadowControl?.swap !== true || !shadowControlEnabled() || controlsLocked() || !game.shadowPose) return false;
  if (game.controlMode === 'body' && !playerLit()) {
    flashInputStatus(COPY.shadowControlUnavailable, 1800);
    return false;
  }
  const swapped = swapShadowPositions(poseNow(), game.shadowPose);
  if (!swapped || !findBox(swapped.body.boxId)) {
    flashInputStatus(COPY.shadowControlUnavailable, 1800);
    return false;
  }
  game.path = null;
  game.pathFrom = null;
  game.hazardStep = null;
  game.freeMoving = false;
  game.wasFreeMoving = false;
  game.shadowPath = null;
  game.shadowPathT = 0;
  game.shadowPathFrom = null;
  game.shadowWalk = null;
  game.shadowPose = swapped.shadow;
  game.shadowDetached = true;
  game.shadowAnchor = { ...swapped.anchor };
  game.shadowLastSafePose = cloneShadowPose(game.shadowPose);
  game.shadowSwitchLatched = false;
  game.face = { boxId: swapped.body.boxId, face: swapped.body.face || '+y' };
  player.userData.boxId = game.face.boxId;
  player.userData.yaw = swapped.body.yaw || player.userData.yaw || Math.PI / 2;
  player.position.set(swapped.body.x, swapped.body.y, swapped.body.z);
  player.rotation.y = player.userData.yaw;
  game.controlMode = game.controlMode === 'shadow' ? 'body' : 'shadow';
  game.firstPerson = false;
  game.shadowSync = 0;
  applyCameraMode();
  renderViews();
  syncFpsHud();
  rebuild(false);
  game.shadowSwitchLatched = !!shadowSwitchTarget();
  saveCheckpoint(COPY.checkpointSwap);
  flashInputStatus(game.controlMode === 'shadow' ? COPY.shadowControlTake : COPY.shadowControlReturn, 1800);
  audio.page();
  pulseGamepad(game.controlMode === 'shadow' ? 0.42 : 0.3, 120, 0.3);
  updateControlUi();
  updateNearbyAction();
  return true;
}

function syncShadowCircuit(dt) {
  if (!shadowControlEnabled() || !game.shadowPose || game.screen !== 'play') return;
  game.shadowSync -= dt;
  if (game.shadowSync > 0) return;
  game.shadowSync = save.quality === 'low' ? 0.16 : 0.09;
  const signature = shadowPoseSignature(game.shadowPose);
  if (signature !== game.shadowLastSignature) {
    game.shadowLastSignature = signature;
    rebuild(false);
    game.shadowSwitchLatched = !!shadowSwitchTarget();
  } else {
    refreshShadowPose();
  }
  const shadowSwitch = shadowSwitchTarget();
  if (shadowSwitch?.latch && !game.levers[shadowSwitch.id]) {
    game.levers[shadowSwitch.id] = true;
    game.shadowSwitchLatched = true;
    rebuild(false);
    saveCheckpoint(COPY.checkpointShadow);
    audio.stamp();
    pulseGamepad(0.46, 140, 0.32);
    flashInputStatus(COPY.shadowPinnedRoute, 2200);
  }
}

function currentView() {
  const lv = level();
  const list = lv.views || [lv.camera];
  const view = list[game.viewIndex] || list[0] || lv.camera || { pitch: 44, yaw: -38, dist: 18 };
  if (game.firstPerson) return view;
  // L1 keeps the cover's diagonal, long-lens composition: the figure sits in
  // the lower-left third while the raised paper route recedes to the light.
  const coverView = game.viewIndex === 0 && lv.referenceStyle
    ? {
        ...view,
        pitch: 38,
        yaw: -130,
        dist: 25,
        fov: 30
      }
    : view;
  if (app.camera.aspect >= 0.9) return coverView;
  const portraitScale = 1 + Math.min(0.52, (0.9 - app.camera.aspect) * 1.12);
  return {
    ...coverView,
    yaw: coverView.portraitYaw ?? coverView.yaw,
    dist: (coverView.dist || 18) * portraitScale * (coverView.portraitBoost || 1)
  };
}

function levelFocus() {
  const lv = level();
  if (app.camera.aspect < 0.9 && Array.isArray(lv.portraitFocus)) {
    return new THREE.Vector3(lv.portraitFocus[0], lv.portraitFocus[1] || 0, lv.portraitFocus[2]);
  }
  if (Array.isArray(lv.focus)) return new THREE.Vector3(lv.focus[0], lv.focus[1] || 0, lv.focus[2]);
  const boxes = (lv.boxes || []).filter(box => box.walkable !== false);
  if (!boxes.length) return player.position.clone();
  const minX = Math.min(...boxes.map(box => box.min[0]));
  const maxX = Math.max(...boxes.map(box => box.max[0]));
  const minZ = Math.min(...boxes.map(box => box.min[2]));
  const maxZ = Math.max(...boxes.map(box => box.max[2]));
  const maxY = Math.max(...boxes.map(box => box.max[1]));
  return new THREE.Vector3((minX + maxX) / 2, Math.min(1.6, maxY * 0.36), (minZ + maxZ) / 2);
}

function renderViews() {
  const el = document.getElementById('views');
  const list = level().views || [];
  const icons = ['◇', '◫', '◩'];
  el.innerHTML = '';
  list.forEach((view, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = icons[index % icons.length];
    btn.title = `视角：${view.name}`;
    btn.setAttribute('aria-label', `切换到${view.name}视角`);
    btn.setAttribute('aria-pressed', String(!game.firstPerson && index === game.viewIndex));
    btn.classList.toggle('primary', !game.firstPerson && index === game.viewIndex);
    btn.addEventListener('click', () => {
      if (game.firstPerson) toggleFirstPerson(false);
      if (index !== game.viewIndex) setView(index);
      else renderViews();
    });
    el.appendChild(btn);
  });
  const fp = document.createElement('button');
  fp.type = 'button';
  fp.textContent = '◎';
  fp.title = COPY.firstPerson;
  fp.setAttribute('aria-label', COPY.firstPerson);
  fp.setAttribute('aria-pressed', String(!!game.firstPerson));
  fp.classList.toggle('primary', !!game.firstPerson);
  fp.addEventListener('click', () => toggleFirstPerson(!game.firstPerson));
  el.appendChild(fp);
}

function initLookFromPlayer() {
  game.lookYaw = (player.userData.yaw ?? Math.PI / 2) + Math.PI;
  game.lookPitch = 0.08;
}

function applyCameraMode() {
  app.camera.fov = game.firstPerson ? 66 : 24;
  app.camera.near = game.firstPerson ? 0.06 : 0.1;
  app.camera.updateProjectionMatrix();
  if (app.scene.fog) {
    app.scene.fog.near = game.firstPerson ? 15 : 48;
    app.scene.fog.far = game.firstPerson ? 52 : 112;
  }
}

function syncFpsHud(playing = game.screen === 'play') {
  const show = playing && game.firstPerson;
  document.getElementById('game').classList.toggle('first-person', show);
  document.getElementById('crosshair').classList.toggle('hidden', !show);
  document.getElementById('hands').classList.toggle('hidden', !show);
  if (!show) {
    document.getElementById('lamp-pop').classList.add('hidden');
    document.getElementById('crosshair').classList.remove('aim');
    actionPrompt.classList.add('hidden');
    game.aim = null;
  } else {
    syncHands();
  }
}

function toggleFirstPerson(on = !game.firstPerson) {
  if (game.controlMode === 'shadow') return false;
  game.firstPerson = !!on;
  game.path = game.hazardStep ? game.path : null;
  game.lookDrag = null;
  if (game.firstPerson) {
    game.intro = 0;
    initLookFromPlayer();
  } else {
    player.userData.yaw = game.lookYaw - Math.PI;
    player.rotation.y = player.userData.yaw;
    document.exitPointerLock?.();
  }
  if (game.screen === 'play') player.visible = !game.firstPerson;
  applyCameraMode();
  renderViews();
  syncFpsHud();
  audio.page();
}

function setView(index) {
  const list = level().views || [];
  if (!list[index] || index === game.viewIndex) return;
  const prev = game.viewIndex;
  game.viewIndex = index;
  if (commitLights()) {
    renderViews();
    audio.page();
    return;
  }
  game.viewIndex = prev;
  rebuild(false);
  setMiss(COPY.missSelf);
}

function toggleLever(id) {
  const prev = !!game.levers[id];
  game.levers[id] = !prev;
  if (commitLights()) {
    saveCheckpoint(COPY.checkpointSwitch);
    audio.page();
    fireReveal('lever');
    pulseGamepad(0.28, 70);
    return true;
  }
  game.levers[id] = prev;
  rebuild(false);
  setMiss(COPY.missSelf);
  return false;
}

function syncSettingsUi() {
  document.getElementById('vol-music').value = Math.round(save.music * 100);
  document.getElementById('vol-sfx').value = Math.round(save.sfx * 100);
  document.getElementById('mute-audio').checked = save.muted;
  document.getElementById('reduce-flash').checked = save.reduceFlash;
  document.getElementById('show-timer').checked = save.showTimer;
  document.getElementById('gamepad-vibration').checked = save.vibration;
  document.getElementById('q-high').classList.toggle('primary', save.quality !== 'low');
  document.getElementById('q-low').classList.toggle('primary', save.quality === 'low');
  const fullscreen = document.getElementById('fullscreen-toggle');
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  const fullscreenSupported = !!(
    document.documentElement.requestFullscreen
    || document.documentElement.webkitRequestFullscreen
  );
  fullscreen.disabled = !fullscreenSupported;
  fullscreen.textContent = fullscreenSupported
    ? fullscreenElement ? '退出全屏' : '进入全屏'
    : '当前不可用';
  fullscreen.setAttribute('aria-pressed', fullscreenElement ? 'true' : 'false');
  audio.setMusic(save.music);
  audio.setSfx(save.sfx);
  audio.muteAll(save.muted || (save.music <= 0 && save.sfx <= 0));
}

function extrasNow() {
  const extras = {
    yaw: game.yaw,
    enabled: level().lantern && game.lanternHeld ? { ...game.enabled, porch: false } : game.enabled,
    cratePos: game.cratePos,
    lampPos: game.lampPos,
    lanternHeld: game.lanternHeld,
    levers: game.levers,
    shadowMasks: game.shadowCast && game.shadowCast.boxId !== '__free-shadow__'
      ? [game.shadowCast]
      : [],
    shadowCast: game.shadowCast ? cloneShadowCast(game.shadowCast) : null,
    shadowPose: game.shadowPose ? cloneShadowPose(game.shadowPose) : null,
    shadowDetached: !!game.shadowDetached,
    shadowAnchor: game.shadowAnchor ? { ...game.shadowAnchor } : null,
    shadowRadius: level().shadowControl?.switchRadius || 0.72,
    face: game.face,
    view: currentView()
  };
  if (game.lanternHeld && game.lanternOn) {
    extras.lantern = {
      light: lanternLight(player, true, game.face?.face || '+y', {
        skipBoxIds: level().lanternSkip || [],
        ignoreBoxIds: level().lanternIgnore || []
      })
    };
  }
  return extras;
}

function liveShadows(baseWorld) {
  const list = level().shadows || [];
  if (!list.length) return list;
  return list.filter(shadow => {
    const boxed = { ...baseWorld, boxes: [...baseWorld.boxes, shadow] };
    return lightCount(boxed, { boxId: shadow.id, face: '+y' }) === 0;
  });
}

function absorbSeals(world) {
  let hit = false;
  for (const sw of level().switches || []) {
    if (sw.kind !== 'plate' && sw.kind !== 'lit') continue;
    if (game.levers[sw.id]) continue;
    if (!world?.closed?.[sw.id]) continue;
    game.levers[sw.id] = true;
    hit = true;
    fireReveal(sw.kind);
  }
  return hit;
}

function rebuild(hard = false) {
  const lv = level();
  const extras = extrasNow();
  let world = resolveWorld(lv, game.time, { ...extras, shadows: lv.shadows || [] });
  extras.shadows = liveShadows(world);
  world = resolveWorld(lv, game.time, extras);
  if (absorbSeals(world)) {
    extras.levers = game.levers;
    world = resolveWorld(lv, game.time, extras);
    audio.page();
  }
  game.world = world;
  const faces = walkableFaces(world, { walls: lv.walls });
  game.graph = buildGraph(world, faces, { walls: lv.walls });
  const shadowFaces = world.boxes
    .filter(box => isWalkRole(box))
    .map(box => ({ boxId: boxId(box), face: '+y' }));
  game.shadowGraph = buildGraph(world, shadowFaces, { walls: false });
  const mats = {
    paper: materials.paper,
    floor: materials.floor,
    over: materials.over,
    crate: materials.crate,
    ink: materials.ink,
    dim: materials.dim,
    side: materials.side
  };
  const settings = {
    ...save,
    referenceStyle: !!lv.referenceStyle,
    // 提着亮灯或关卡有旋转灯时，纸面状态每帧都在变，
    // 播「显影」弹跳会让整座城一直抖，这类关卡一律不播。
    continuousRelight: (game.lanternHeld && game.lanternOn)
      || (lv.lights || []).some(light => light.rotate),
    focusLamp: (world.lights || []).find(item => item.id === (game.drag?.kind === 'lamp' ? game.drag.id : game.focusLamp))
  };
  if (hard || !levelRoot.getObjectByName('solids')) {
    const built = buildLevel(levelRoot, world, mats, settings);
    game.pickables = built.pickables;
    addProps(levelRoot, lv, materials);
  } else {
    const built = syncLevel(levelRoot, world, mats, settings);
    game.pickables = built.pickables;
  }
  syncProps(levelRoot.getObjectByName('props'), lv, extras, world);
  syncCones(levelRoot, world, save.quality, { referenceStyle: !!lv.referenceStyle });
  syncSceneLights(app.scene, world, save.quality, { referenceStyle: !!lv.referenceStyle });
  syncShadowField(levelRoot, world, save.quality, {
    targets: lv.shadowTargets || [],
    referenceStyle: !!lv.referenceStyle
  });
  refreshShadowPose();
  updateControlUi();
  return world;
}

function shadowMoveTo(ref) {
  if (game.controlMode !== 'shadow' || !game.shadowPose || !ref) return false;
  const start = { boxId: game.shadowPose.boxId, face: game.shadowPose.face || '+y' };
  const path = findPath(game.shadowGraph, start, ref);
  if (!path || path.length < 2) return false;
  game.shadowPath = path;
  game.shadowPathT = 0;
  game.shadowPathFrom = { x: game.shadowPose.x, y: game.shadowPose.y, z: game.shadowPose.z };
  return true;
}

function followShadowPath(dt) {
  if (!game.shadowPath || !game.shadowPose) return false;
  const path = game.shadowPath;
  const points = [game.shadowPathFrom || game.shadowPose];
  for (let i = 1; i < path.length; i += 1) {
    const box = findBox(path[i].boxId);
    if (box) {
      const c = faceCenter(box, path[i].face || '+y');
      points.push({ x: c[0], y: c[1] + 0.035, z: c[2] });
    }
  }
  let distance = Math.max(0, game.shadowPathT) * 3.35;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 0.001;
    if (distance <= seg) {
      const k = distance / seg;
      const next = clampShadowToTether({
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        z: a.z + (b.z - a.z) * k
      }, game.shadowAnchor, level().shadowControl?.maxDistance || 10);
      game.shadowPose.x = next.x;
      game.shadowPose.y = next.y;
      game.shadowPose.z = next.z;
      game.shadowPose.length = Math.hypot(
        game.shadowPose.x - player.position.x,
        game.shadowPose.z - player.position.z
      );
      if (Math.abs(b.x - a.x) + Math.abs(b.z - a.z) > 0.01) {
        game.shadowPose.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      }
      game.shadowPose.boxId = path[Math.min(path.length - 1, i + (k >= 0.82 ? 1 : 0))].boxId;
      game.shadowPose.face = '+y';
      game.shadowPose.detached = true;
      game.shadowLastSafePose = cloneShadowPose(game.shadowPose);
      game.shadowPathT += dt;
      return true;
    }
    distance -= seg;
  }
  const last = points[points.length - 1];
  const next = clampShadowToTether(last, game.shadowAnchor, level().shadowControl?.maxDistance || 10);
  game.shadowPose.x = next.x;
  game.shadowPose.y = next.y;
  game.shadowPose.z = next.z;
  game.shadowPose.length = Math.hypot(
    game.shadowPose.x - player.position.x,
    game.shadowPose.z - player.position.z
  );
  game.shadowPose.boxId = path[path.length - 1].boxId;
  game.shadowPose.face = '+y';
  game.shadowPose.detached = true;
  game.shadowLastSafePose = cloneShadowPose(game.shadowPose);
  game.shadowPath = null;
  game.shadowPathT = 0;
  return true;
}

function findBox(id) {
  return game.world?.boxes.find(box => boxId(box) === id);
}

function restoreKnownMap(base, saved, copy = value => value) {
  const result = { ...base };
  for (const [id, value] of Object.entries(saved || {})) {
    if (Object.prototype.hasOwnProperty.call(base, id)) result[id] = copy(value);
  }
  return result;
}

function spawnLevel(index) {
  game.index = index;
  const lv = LEVELS[index];
  const sceneTone = lv.referenceStyle ? 0x191b1d : 0x0d0e0f;
  app.renderer.setClearColor(sceneTone, 1);
  app.scene.background.setHex(sceneTone);
  if (app.scene.fog) app.scene.fog.color.setHex(sceneTone);
  game.time = 0;
  game.intro = lv.referenceStyle ? 0 : LEVEL_INTRO_SECONDS;
  game.levers = {};
  game.viewIndex = 0;
  game.yaw = {};
  game.enabled = {};
  game.focusLamp = null;
  game.lampPos = {};
  for (const light of lv.lights || []) {
    if (!light.rotate) game.yaw[light.id] = light.yaw || 0;
    game.enabled[light.id] = light.enabled !== false;
    game.lampPos[light.id] = (light.origin || [0, 0, 0]).slice();
  }
  for (const mirror of lv.mirrors || []) game.yaw[mirror.id] = mirror.yaw || 0;
  game.cratePos = {};
  for (const crate of lv.crates || []) {
    game.cratePos[crate.id] = {
      ...crate,
      min: crate.min.slice(),
      max: crate.max.slice()
    };
  }
  game.lanternHeld = false;
  game.lanternOn = false;
  game.path = null;
  game.pathT = 0;
  game.pathFrom = null;
  game.hazardStep = null;
  game.slowmo = 1;
  game.slowmoUntil = 0;
  game.sawWhite = false;
  game.revealFired = false;
  game.revealUntil = 0;
  game.hurt = false;
  game.ending = 0;
  game.hiddenHold = 0;
  game.hintUntil = 0;
  game.coachMiss = null;
  game.coachMissUntil = 0;
  game.lastFall = null;
  game.lastFallUntil = 0;
  game.dying = false;
  game.won = false;
  game.handLamp = null;
  game.checkpoint = null;
  game.checkpointLabel = COPY.checkpointStart;
  game.checkpointPulse = 0;
  game.runElapsed = 0;
  game.runFalls = 0;
  game.runHintUsed = false;
  game.clearResult = null;
  game.resumed = false;
  game.nearbyAction = null;
  game.shadowCast = null;
  game.shadowTarget = null;
  game.lightSync = 0;
  game.shadowPose = null;
  game.shadowDetached = false;
  game.shadowAnchor = null;
  game.shadowLastSafePose = null;
  game.shadowRoute = [];
  game.shadowSwitchLatched = false;
  game.shadowPath = null;
  game.shadowPathT = 0;
  game.shadowPathFrom = null;
  game.shadowWalk = null;
  game.controlMode = 'body';
  game.shadowSync = 0;
  game.shadowLastSignature = 'none';
  player.visible = !game.firstPerson;
  levelRoot.visible = true;
  player.removeFromParent();
  player = createPlayer(materials, null, Math.max(save.highest, index));
  app.scene.add(player);
  document.getElementById('game').classList.toggle('reference-style', !!lv.referenceStyle);
  const held = player.getObjectByName('held-lantern');
  if (held) held.visible = false;
  game.run = createRunState({ ...lv.spawn });
  rebuild(true);
  // 方块人有正反面，开局让他面朝镜头，别一上来就是后脑勺。
  player.userData.yaw = THREE.MathUtils.degToRad(currentView()?.yaw ?? -38);
  player.rotation.y = player.userData.yaw;
  player.userData.boxId = lv.spawn.boxId;
  const box = findBox(lv.spawn.boxId);
  const c = box ? faceCenter(box, lv.spawn.face || '+y') : [lv.spawn.x, lv.spawn.y, lv.spawn.z];
  player.position.set(lv.spawn.x ?? c[0], lv.spawn.y ?? c[1], lv.spawn.z ?? c[2]);
  game.face = { boxId: lv.spawn.boxId, face: lv.spawn.face || '+y' };
  refreshShadowPose(true);
  rebuild(false);
  saveCheckpoint(COPY.checkpointStart, false);
  if (game.firstPerson) {
    game.intro = 0;
    initLookFromPlayer();
  }
  applyCameraMode();
  if (lv.referenceStyle && !game.firstPerson) {
    const coverFocus = levelFocus();
    coverFocus.lerp(player.position, lv.focusFollow ?? 0.12);
    rigCamera(app.camera, coverFocus, currentView(), 0);
  }
  hud.innerHTML = `<div class="hud-chapter">${String(index + 1).padStart(2, '0')} / ${String(LEVELS.length).padStart(2, '0')}</div><div class="hud-name">${lv.name}</div>`;
  renderViews();
  syncFpsHud(true);
  save = writeSave({ current: index, started: true });
  audio.layer(lv.chapter);
}

function openTitle() {
  game.screen = 'title';
  game.pauseReason = '';
  pauseReason.textContent = '';
  pauseReason.classList.add('hidden');
  setPlayChrome(false);
  refreshTitleButtons();
  show('title');
}

function startPlay(index, options = {}) {
  clearTransientInput();
  let stored = options.resume && save.resume?.index === index ? save.resume : null;
  spawnLevel(index);
  if (stored && !findBox(stored.snapshot.pose.boxId)) stored = null;
  if (stored) {
    game.checkpoint = stored.snapshot;
    restoreCheckpoint({ resume: stored });
  }
  game.inputGraceUntil = performance.now() + START_INPUT_GRACE_MS;
  game.awaitingNeutralInput = true;
  game.pauseReason = '';
  pauseReason.textContent = '';
  pauseReason.classList.add('hidden');
  game.screen = 'play';
  show();
  setPlayChrome(true);
  showLevelIntro(!!stored);
  updateCoach();
}

function secretIndexForLevel(index) {
  if (index === 4) return 0;
  if (index === 7) return 1;
  if (index === 9) return 2;
  return -1;
}

function fillChapters() {
  const grid = document.getElementById('chapter-grid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const btn = document.createElement('button');
    btn.className = 'chapter-item';
    btn.type = 'button';
    const unlocked = i <= Math.max(save.highest, save.current);
    const cleared = i < save.highest;
    const current = save.started && i === Math.min(save.current, LEVELS.length - 1);
    const record = save.records[i];
    const chapter = CHAPTERS.find(item => item.id === lv.chapter);
    const state = !unlocked ? COPY.locked : cleared ? record?.flawless ? '无痕' : '已显影' : current ? '当前进度' : '可进入';
    btn.classList.toggle('locked', !unlocked);
    btn.classList.toggle('cleared', cleared);
    btn.classList.toggle('current', current);
    btn.classList.toggle('flawless', !!record?.flawless);
    btn.disabled = !unlocked;
    btn.setAttribute('aria-label', `第 ${i + 1} 关，${lv.name}，${state}`);
    if (current) btn.setAttribute('data-autofocus', '');
    if (cleared) {
      const still = lv.chapter >= 4 ? './assets/still-l10-v78.png'
        : lv.chapter === 3 ? './assets/still-l7-v78.png'
          : lv.chapter === 2 ? './assets/still-l4-v78.png'
            : './assets/title-hero-v78.png';
      const img = document.createElement('img');
      img.className = 'chapter-thumb';
      img.src = still;
      img.alt = '';
      img.loading = 'lazy';
      btn.appendChild(img);
    }
    const number = document.createElement('span');
    number.className = 'chapter-number';
    number.textContent = String(i + 1).padStart(2, '0');
    const copy = document.createElement('span');
    copy.className = 'chapter-copy';
    const name = document.createElement('span');
    name.className = 'chapter-name';
    name.textContent = unlocked ? lv.name : COPY.locked;
    const meta = document.createElement('span');
    meta.className = 'chapter-meta';
    meta.textContent = `第 ${lv.chapter} 章 · ${chapter?.name || '光与影'}`;
    copy.append(name, meta);
    const secretIndex = secretIndexForLevel(i);
    if (record?.bestTime != null || (secretIndex >= 0 && save.hidden[secretIndex])) {
      const recordLine = document.createElement('span');
      recordLine.className = 'chapter-record';
      const details = [];
      if (record?.bestTime != null) details.push(`最佳 ${formatRunTime(record.bestTime)}`);
      if (secretIndex >= 0 && save.hidden[secretIndex]) details.push('暗页已收录');
      recordLine.textContent = details.join(' · ');
      copy.appendChild(recordLine);
    }
    const status = document.createElement('span');
    status.className = 'chapter-state';
    status.textContent = state;
    btn.append(number, copy, status);
    btn.addEventListener('click', () => {
      if (!unlocked) return;
      startPlay(i);
    });
    grid.appendChild(btn);
  });
}

function currentCount() {
  if (!game.face || !game.world) return 1;
  return lightCount(game.world, game.face);
}

function cloneShadowCast(mask) {
  if (arguments.length === 0) mask = game.shadowCast;
  if (!mask) return null;
  return {
    ...mask,
    origin: Array.isArray(mask.origin) ? mask.origin.slice(0, 3) : null,
    shape: mask.shape ? {
      start: mask.shape.start?.slice?.(0, 3),
      tip: mask.shape.tip?.slice?.(0, 3),
      direction: mask.shape.direction?.slice?.(0, 3),
      length: Number(mask.shape.length) || 0,
      width: Number(mask.shape.width) || 0.54,
      path: Array.isArray(mask.shape.path)
        ? mask.shape.path.map(point => point.slice(0, 3))
        : null
    } : null
  };
}

function sameShadowTarget(mask, target) {
  return !!(
    mask
    && target
    && mask.boxId === target.boxId
    && (mask.face || '+y') === (target.face || '+y')
    && mask.lightId === target.lightId
  );
}

function findShadowTarget() {
  const lv = level();
  if (!lv.shadowCast || !game.world || !game.face) return null;
  let best = null;
  for (const target of lv.shadowTargets || []) {
    const box = findBox(target.boxId);
    if (!box) continue;
    const face = target.face || '+y';
    const origin = Array.isArray(target.origin) ? target.origin : faceCenter(box, face);
    const active = sameShadowTarget(game.shadowCast, target);
    if (!active && !shadowTipNearTarget(game.shadowPose, { ...target, origin }, target.captureRadius || 1.05)) continue;
    if (!active && !lightsOnFace(game.world, { boxId: target.boxId, face }).some(light => light.id === target.lightId)) continue;
    const tipDistance = Math.hypot(game.shadowPose.x - origin[0], game.shadowPose.z - origin[2]);
    if (!best || tipDistance < best.score) {
      best = { ...target, face, origin, distance: tipDistance, score: tipDistance };
    }
  }
  if (!best) return null;
  const { score: _score, ...target } = best;
  return target;
}

function shadowActionLabel(target = game.shadowTarget) {
  if (!level().shadowCast) return '';
  if (game.shadowCast) return '收回影子';
  return game.shadowPose?.length >= 0.05 ? '钉住影子' : '';
}

function shadowActionKey() {
  return game.lastInput === 'gamepad' ? 'B' : '空格';
}

function updateExposureUi() {
  if (!exposureMeter || game.screen !== 'play' || !game.world) return;
  const count = currentCount();
  const state = count < 1 ? 'void' : count > 1 ? 'white' : 'seam';
  exposureMeter.dataset.state = state;
  exposureMeter.dataset.face = game.face ? `${game.face.boxId}:${game.face.face}` : 'none';
  exposureMeter.dataset.lights = game.face ? lightsOnFace(game.world, game.face).map(light => light.id).join(',') : '';
  exposureMeter.dataset.player = [player.position.x, player.position.y, player.position.z]
    .map(value => value.toFixed(3))
    .join(',');
  exposureMeter.setAttribute('aria-label', count < 1 ? '影渊，无光' : count > 1 ? '日蚀白，过曝' : '蚀线，单光安全');
}

function updateShadowActionUi(target = findShadowTarget()) {
  game.shadowTarget = target;
  const lanternAbility = !!(level().lantern && game.lanternHeld);
  const shadowAbility = !!(game.controlMode === 'body' && level().shadowCast && (game.shadowPose || game.shadowCast));
  const visible = game.screen === 'play'
    && game.lastInput === 'touch'
    && !game.dying
    && !game.won
    && (lanternAbility || shadowAbility);
  shadowAction.classList.toggle('hidden', !visible);
  const consoleVisible = game.screen === 'play'
    && game.lastInput === 'touch'
    && !game.dying
    && !game.won
    && !!level().shadowCast
    && shadowControlEnabled();
  shadowConsole.classList.toggle('hidden', !consoleVisible);
  if (consoleVisible) {
    const measured = game.shadowCast?.shape?.length ?? game.shadowPose?.length;
    const length = Number.isFinite(Number(measured)) ? Number(measured) : 0;
    shadowLengthValue.textContent = `${length.toFixed(1)} m`;
    shadowConsole.dataset.pinned = game.shadowCast ? 'true' : 'false';
    shadowPin.disabled = !!game.shadowCast || !(game.shadowPose?.length >= 0.05);
    shadowRelease.disabled = !game.shadowCast;
    shadowPin.setAttribute('aria-label', game.shadowPose?.length >= 0.05 ? '把当前影子钉住' : '当前影子太短');
    shadowRelease.setAttribute('aria-label', game.shadowCast ? '收回已钉住的影子' : '没有已钉住的影子');
    const movableLight = shadowLightForBody();
    document.getElementById('shadow-light-actions').classList.toggle('hidden', !lampMovable(movableLight));
  }
  if (!visible) return;
  const lantern = lanternAbility && !level().shadowCast;
  const label = lantern
    ? game.lanternOn ? '熄灭提灯' : '点亮提灯'
    : shadowActionLabel(target);
  shadowAction.textContent = lantern ? '☼' : '◒';
  shadowAction.classList.toggle('active', lantern ? game.lanternOn : !!game.shadowCast);
  shadowAction.setAttribute('aria-label', label);
  shadowAction.title = label;
}

function releasePlayerShadow() {
  if (!game.shadowCast || game.controlMode !== 'body' || controlsLocked()) return false;
  const onFrozenShadow = shadowShapeAt(
    game.shadowCast.shape,
    player.position.x,
    player.position.z,
    0.04
  );
  if (onFrozenShadow && !walkHitAt(player.position.x, player.position.z, player.position.y)) {
    setMiss(COPY.missShadowStand);
    return false;
  }
  const previous = cloneShadowCast();
  game.shadowCast = null;
  game.shadowDetached = false;
  game.shadowPose = null;
  rebuild(false);
  // Releasing switches from a frozen shape back to a live projection. Force
  // the first live frame to originate at the player's current feet.
  refreshShadowPose(true);
  if (!playerLit()) {
    game.shadowCast = previous;
    rebuild(false);
    setMiss(COPY.missShadowHold);
    return false;
  }
  saveCheckpoint(COPY.checkpointShadow);
  audio.stamp();
  pulseGamepad(0.22, 70, 0.34);
  flashInputStatus(COPY.shadowReleased, 1800);
  updateShadowActionUi();
  updateCoach();
  return true;
}

function castPlayerShadow() {
  if (!level().shadowCast || game.controlMode !== 'body' || controlsLocked()) return false;
  if (game.shadowCast) return releasePlayerShadow();
  const target = findShadowTarget();
  const previous = cloneShadowCast();
  const pinTip = game.shadowPose
    ? [game.shadowPose.x, game.shadowPose.y, game.shadowPose.z]
    : null;
  const frozenShape = pinTip
    ? freezeShadowShape(
        [player.position.x, player.position.y, player.position.z],
        pinTip,
        { path: game.shadowPose?.path }
      )
    : null;
  if (!frozenShape) {
    setMiss(COPY.missShadowAim);
    return false;
  }
  const maxLength = Number(target?.maxShadowLength ?? level().shadowControl?.pinMaxLength);
  const length = Number(frozenShape.length);
  if (Number.isFinite(maxLength) && length > maxLength) {
    setMiss(`${COPY.shadowTooLong} · ${length.toFixed(1)} m`);
    return false;
  }
  const liveLight = shadowLightForBody();
  game.shadowCast = {
    boxId: target?.boxId || '__free-shadow__',
    face: target?.face || '+y',
    lightId: target?.lightId || liveLight?.id || game.shadowPose.lightId || 'shadow',
    mode: target?.mode || 'bridge',
    origin: frozenShape.start.slice(),
    shape: {
      start: frozenShape.start.slice(),
      tip: frozenShape.tip.slice(),
      direction: frozenShape.direction.slice(),
      length: frozenShape.length,
      width: frozenShape.width,
      path: frozenShape.path.map(point => point.slice())
    }
  };
  rebuild(false);
  if (!playerLit()) {
    game.shadowCast = previous;
    rebuild(false);
    setMiss(COPY.missShadowHold);
    return false;
  }
  if (target) {
    const count = lightCount(game.world, { boxId: target.boxId, face: target.face || '+y' });
    const worked = target.mode === 'switch' ? count === 0 : count === 1;
    if (!worked) {
      game.shadowCast = previous;
      rebuild(false);
      setMiss(COPY.missShadowAim);
      return false;
    }
  }
  saveCheckpoint(COPY.checkpointShadow);
  audio.stamp();
  fireReveal(target ? 'shadowTarget' : 'shadowPinned');
  pulseGamepad(0.5, 150, 0.34);
  flashInputStatus(target ? COPY.shadowPinnedTarget : COPY.shadowPinned, 1800);
  updateShadowActionUi();
  updateCoach();
  return true;
}

function toggleLantern() {
  if (!level().lantern || !game.lanternHeld || game.controlMode !== 'body' || controlsLocked()) return false;
  game.lanternOn = !game.lanternOn;
  rebuild(false);
  if (!playerLit()) {
    game.lanternOn = !game.lanternOn;
    rebuild(false);
    setMiss(COPY.missSelf);
    return false;
  }
  const held = player.getObjectByName('held-lantern');
  if (held) held.visible = game.lanternOn;
  saveCheckpoint(COPY.checkpointLantern);
  audio.page();
  fireReveal(game.lanternOn ? 'lanternOn' : 'lanternOff');
  updateShadowActionUi();
  return true;
}

function activateAbility() {
  if (level().lantern && game.lanternHeld) return toggleLantern();
  if (level().shadowCast) return castPlayerShadow();
  return false;
}

function hazardKind(ref = game.face, world = game.world) {
  if (!ref || !world) return null;
  const n = lightCount(world, ref);
  if (n === 1) return null;
  return n >= 2 ? 'overexposure' : 'void';
}

function stampIfSafe() {
  if (!playerLit()) return false;
  saveCheckpoint();
  return true;
}

function stepIntoHazard(ref, kind) {
  game.hazardStep = kind || hazardKind(ref) || 'void';
  game.path = [game.face, ref];
  game.pathT = 0;
  game.pathFrom = player.position.clone();
}

function controlsLocked() {
  const now = performance.now();
  return !!game.dying || now < game.inputGraceUntil || inputLocked(game.run, now);
}

function doFall(kind) {
  if (game.dying || game.screen !== 'play') return;
  game.dying = true;
  game.path = null;
  game.shadowWalk = null;
  game.hazardStep = null;
  game.drag = null;
  game.lookDrag = null;
  game.lastFall = kind;
  game.lastFallUntil = game.time + 4.2;
  game.coachMiss = null;
  game.runFalls += 1;
  persistResume();
  pulseGamepad(kind === 'overexposure' ? 0.92 : 0.72, 260, 0.45);
  if (kind === 'overexposure' && level().slowmoOnOverexposure && !game.sawWhite) {
    game.sawWhite = true;
    game.slowmo = 0.42;
    game.slowmoUntil = game.time + 0.52;
  }
  checkpointFall(game.run, kind, performance.now());
  audio[kind === 'overexposure' ? 'whiteFall' : 'voidFall']();
  const shred = shredsAt(app.scene, player.position.clone(), kind, save.quality);
  if (shred) game.shreds.push(shred);
  flashEl.className = `flash ${kind === 'overexposure' ? 'white' : 'black'}`;
  flashEl.style.opacity = save.reduceFlash && kind === 'overexposure' ? '0.22' : '1';
  setTimeout(() => { flashEl.style.opacity = '0'; }, 280);
  player.visible = false;
  shadowAvatar.visible = false;
  setTimeout(() => {
    if (game.screen !== 'play' && game.screen !== 'pause') return;
    restoreCheckpoint();
    if (game.screen === 'pause') {
      show('pause');
      setPlayChrome(false);
    } else {
      show();
      setPlayChrome(true);
    }
  }, 720);
}

function saveRunRecord() {
  const result = mergeRunRecord(save.records[game.index], {
    elapsed: game.runElapsed,
    falls: game.runFalls,
    hintUsed: game.runHintUsed
  });
  const records = save.records.slice();
  records[game.index] = result.record;
  game.clearResult = result;
  save = writeSave({
    highest: Math.max(save.highest, game.index + 1),
    current: Math.min(LEVELS.length - 1, game.index + 1),
    records,
    resume: null
  });
  return result;
}

function tryWin() {
  if (game.won || game.dying) return;
  const lv = level();
  if (!game.face || game.face.boxId !== lv.goal.boxId) return;
  game.won = true;
  game.path = null;
  game.drag = null;
  const result = saveRunRecord();
  audio.win();
  pulseGamepad(result.flawless ? 0.82 : 0.58, 240, 0.72);
  if (lv.ending) {
    game.ending = 0.01;
    audio.finale();
    return;
  }
  openClear();
}

function openClear() {
  const lv = level();
  const next = LEVELS[game.index + 1];
  const beat = [2, 5, 8].indexOf(game.index);
  const card = overlays.clear;
  document.getElementById('clear-kicker').textContent = COPY.clearKicker;
  document.getElementById('clear-now').textContent = `${COPY.clearNow} · ${lv.name}`;
  document.getElementById('clear-line').textContent = beat >= 0 ? COPY.chapterLines[beat] : COPY.clearLine;
  const result = game.clearResult;
  document.getElementById('clear-stamp').textContent = result?.rank || '显影';
  document.getElementById('clear-time').textContent = formatRunTime(result?.elapsed || 0);
  document.getElementById('clear-falls').textContent = String(result?.falls || 0);
  document.getElementById('clear-hints').textContent = result?.hintUsed ? '已使用' : '未使用';
  const recordNotes = [];
  if (result?.newBest) recordNotes.push('新最佳时间');
  if (result?.newFlawless) recordNotes.push('无痕印记已收入档案');
  if (!recordNotes.length && result?.record?.clears > 1) recordNotes.push(`累计显影 ${result.record.clears} 次`);
  document.getElementById('clear-record').textContent = recordNotes.join(' · ');
  const nextWrap = document.getElementById('clear-next-wrap');
  const nextName = document.getElementById('clear-next');
  if (next) {
    nextWrap.classList.remove('hidden');
    nextWrap.firstChild.textContent = `${COPY.clearNext} · `;
    nextName.textContent = next.name;
  } else {
    nextWrap.classList.add('hidden');
  }
  document.getElementById('clear-go').textContent = COPY.clearGo;
  if (beat >= 0) {
    const still = game.index === 2 ? './assets/still-l4-v78.png' : game.index === 5 ? './assets/still-l7-v78.png' : './assets/still-l10-v78.png';
    card.classList.add('hero');
    card.style.setProperty('--hero', `url('${still}')`);
  } else {
    card.classList.remove('hero');
    card.style.removeProperty('--hero');
  }
  game.screen = 'clear';
  show('clear');
  setPlayChrome(false);
}

function finishEnding() {
  const extra = save.hidden.every(Boolean);
  document.getElementById('chapter-line').textContent = extra
    ? `${COPY.chapterLines[3]} ${COPY.hiddenLine}`
    : COPY.chapterLines[3];
  const result = game.clearResult;
  document.getElementById('ending-stats').textContent = result
    ? `${result.rank} · ${formatRunTime(result.elapsed)} · 碎裂 ${result.falls}`
    : '';
  overlays.chapter.style.setProperty('--hero', "url('./assets/still-l10-v78.png')");
  game.screen = 'ending-card';
  setPlayChrome(false);
  show('chapter');
}

function playerLit(world = game.world) {
  if (!game.face || !world) return true;
  return lightCount(world, game.face) === 1;
}

function afterLampChange() {
  const n = currentCount();
  if (n < 1) doFall('void');
  else if (n >= 2) doFall('overexposure');
  else {
    stampIfSafe();
    fireReveal('lamp');
  }
}

function handLampIds() {
  const ids = [];
  for (const light of level().lights || []) {
    if (lampInteractable(light)) ids.push(light.id);
  }
  for (const mirror of level().mirrors || []) {
    if (mirrorInteractable(mirror)) ids.push(mirror.id);
  }
  return ids;
}

function currentHandLamp() {
  const ids = handLampIds();
  if (!ids.length) return null;
  if (game.aim?.kind === 'lamp' && ids.includes(game.aim.id)) {
    game.handLamp = game.aim.id;
    return game.aim.id;
  }
  if (!ids.includes(game.handLamp)) game.handLamp = ids[0];
  return game.handLamp;
}

function currentCrate() {
  const id = Object.keys(game.cratePos || [])[0];
  return id ? game.cratePos[id] : null;
}

function currentLeverId() {
  const sw = (level().switches || []).find(item => item.kind !== 'shadow' && item.interactive !== false);
  return sw?.id || null;
}

function nearbyCandidates() {
  const lv = level();
  const candidates = [];
  for (const sw of lv.switches || []) {
    if (sw.kind !== 'lever' || !sw.origin || sw.interactive === false) continue;
    candidates.push({ kind: 'lever', id: sw.id, origin: sw.origin });
  }
  if (lv.pickup && !game.lanternHeld) {
    candidates.push({
      kind: 'pickup',
      id: 'pickup',
      origin: [lv.pickup.x, lv.pickup.y || 0, lv.pickup.z]
    });
  }
  for (const crate of Object.values(game.cratePos || {})) {
    const x = THREE.MathUtils.clamp(player.position.x, crate.min[0], crate.max[0]);
    const z = THREE.MathUtils.clamp(player.position.z, crate.min[2], crate.max[2]);
    candidates.push({
      kind: 'crate',
      id: crate.id,
      origin: [x, (crate.min[1] + crate.max[1]) / 2, z]
    });
  }
  for (const mirror of lv.mirrors || []) {
    if (mirror.origin && mirrorInteractable(mirror)) candidates.push({ kind: 'mirror', id: mirror.id, origin: mirror.origin });
  }
  for (const light of lv.lights || []) {
    if (!lampInteractable(light)) continue;
    candidates.push({ kind: 'lamp', id: light.id, origin: visualLampPos(light.id, light).toArray() });
  }
  return candidates;
}

function findNearbyAction() {
  const yaw = player.userData.yaw || 0;
  return selectContextAction(
    nearbyCandidates(),
    player.position,
    { x: Math.sin(yaw), z: Math.cos(yaw) }
  );
}

function nudgeCrate(dir, id = null) {
  const crate = id ? game.cratePos[id] : currentCrate();
  if (!crate) return;
  const axis = crate.axis || 'z';
  dragCrate(crate, axis, dir * 0.55, crate.limit || [-2, 4]);
  rebuild(false);
  afterLampChange();
  audio.stamp();
  fireReveal('crate');
  pulseGamepad(0.2, 55);
}

function takePickup() {
  if (game.lanternHeld || !level().pickup || game.dying || game.won) return;
  game.lanternHeld = true;
  game.lanternOn = true;
  saveCheckpoint(COPY.checkpointLantern);
  rebuild(false);
  audio.stamp();
  pulseGamepad(0.34, 90);
  syncHands();
}

function tryTouchPickup() {
  const p = level().pickup;
  if (!p || game.lanternHeld || game.screen !== 'play' || game.dying) return;
  const dx = player.position.x - p.x;
  const dz = player.position.z - p.z;
  const dy = player.position.y - (p.y || 0);
  if (dx * dx + dz * dz <= 0.88 * 0.88 && Math.abs(dy) < 1.25) takePickup();
}

function syncHands() {
  const hands = document.getElementById('hands');
  if (!hands || !game.firstPerson || game.screen !== 'play') return;
  const lamps = handLampIds();
  const lampId = currentHandLamp();
  const aimKind = game.aim?.kind;
  const showLamp = lamps.length > 0 && (!aimKind || aimKind === 'lamp' || aimKind === 'mirror');
  const showCrate = !!currentCrate() && (!aimKind || aimKind === 'crate');
  const showLever = !!currentLeverId() && aimKind === 'lever';
  const showPick = aimKind === 'pickup';
  document.getElementById('hands-lamp').classList.toggle('hidden', !showLamp);
  document.getElementById('hands-lamp-next').classList.toggle('hidden', lamps.length < 2);
  const title = document.getElementById('hands-lamp-title');
  if (title) title.textContent = lamps.length > 1 ? `${COPY.handsLamp} ${lamps.indexOf(lampId) + 1}` : COPY.handsLamp;
  const movable = lampMovable((level().lights || []).find(item => item.id === lampId));
  document.getElementById('hands-lamp-distance').classList.toggle('hidden', !showLamp || !movable);
  document.getElementById('hands-crate').classList.toggle('hidden', !showCrate);
  document.getElementById('hands-lever').classList.toggle('hidden', !showLever);
  document.getElementById('hands-pick').classList.toggle('hidden', !showPick);
  hands.classList.toggle('hands-empty', !showLamp && !showCrate && !showLever && !showPick);
}

function syncStandFloor() {
  const solids = levelRoot.getObjectByName('solids');
  const id = game.face?.boxId;
  if (!solids) return;
  for (const mesh of solids.children) {
    if (mesh.userData.fixture || !Array.isArray(mesh.material)) continue;
    const top = mesh.material[2];
    if (!top || !('roughness' in top)) continue;
    const stand = mesh.userData.boxId === id;
    const burn = mesh.userData.style?.over;
    top.roughness = stand ? 0.12 : 0.6;
    top.metalness = stand ? 0.14 : 0.03;
    top.envMapIntensity = stand ? 1.4 : 0.28;
    if ('clearcoat' in top) {
      top.clearcoat = stand ? 0.7 : 0;
      top.clearcoatRoughness = stand ? 0.16 : 1;
    }
    const rim = mesh.getObjectByName('rim');
    if (rim?.material && burn) {
      rim.material.opacity = 0.72 + Math.sin(game.time * 7) * 0.28;
    }
    const cap = mesh.getObjectByName('cap');
    if (cap?.material && burn) {
      cap.material.opacity = 0.18 + Math.sin(game.time * 7) * 0.1;
    }
  }
}

function updateHurtGlow(dt) {
  const glow = player.getObjectByName('hurt-glow');
  if (!glow) return;
  const on = !!game.hurt;
  glow.visible = on || glow.material.opacity > 0.02;
  const target = on ? 0.72 : 0;
  glow.material.opacity += (target - glow.material.opacity) * Math.min(1, dt * 8);
  if (on) {
    const pulse = 1.05 + Math.sin(game.time * 9) * 0.18;
    glow.scale.set(pulse, pulse, 1);
  }
  if (!on && glow.material.opacity < 0.02) {
    glow.visible = false;
    glow.material.opacity = 0;
  }
}

function commitLights() {
  rebuild(false);
  return playerLit();
}

function lampAimable(light) {
  return !!(light && !light.rotate && (light.aimable !== false || light.movable));
}

function lampMovable(light) {
  return !!(light?.movable && Array.isArray(game.lampPos?.[light.id]));
}

function nudgeLampDistance(id, direction) {
  const light = (level().lights || []).find(item => item.id === id);
  if (!lampMovable(light) || controlsLocked()) return false;
  const current = game.lampPos[id].slice();
  let dx = current[0] - player.position.x;
  let dz = current[2] - player.position.z;
  let distance = Math.hypot(dx, dz);
  if (distance < 0.05) {
    dx = (light.origin?.[0] || 0) - player.position.x;
    dz = (light.origin?.[2] || -1) - player.position.z;
    distance = Math.hypot(dx, dz) || 1;
  }
  const range = light.moveRange || [1.5, 10];
  const nextDistance = THREE.MathUtils.clamp(
    distance + direction * (light.moveStep || 0.6),
    range[0],
    range[1]
  );
  game.lampPos[id] = [
    player.position.x + dx / distance * nextDistance,
    current[1],
    player.position.z + dz / distance * nextDistance
  ];
  rebuild(false);
  if (!playerLit()) {
    game.lampPos[id] = current;
    rebuild(false);
    setMiss(COPY.missSelf);
    return false;
  }
  stampIfSafe();
  audio.page();
  pulseGamepad(0.16, 45);
  updateShadowActionUi();
  return true;
}

function lightHasPower(light) {
  if (!light?.power) return true;
  return game.enabled[light.id] !== false || !!game.levers[light.power];
}

function lampInteractable(light) {
  return lampAimable(light) && lightHasPower(light);
}

function mirrorInteractable(mirror) {
  if (!mirror) return false;
  const parent = (level().lights || []).find(light => light.id === mirror.parent);
  return !parent || lightHasPower(parent);
}

function viewBias(_light) {
  return 0;
}

function shownYaw(id, light) {
  return (game.yaw[id] || 0) + viewBias(light);
}

function setLampYaw(id, yaw) {
  const light = (level().lights || []).find(item => item.id === id);
  game.yaw[id] = yaw - viewBias(light);
  rebuild(false);
  return true;
}

function setLampEnabled(id, on) {
  const prev = game.enabled[id];
  game.enabled[id] = on;
  if (commitLights()) return true;
  game.enabled[id] = prev;
  rebuild(false);
  setMiss(COPY.missSelf);
  return false;
}

function visualLampPos(id, light) {
  const props = levelRoot.getObjectByName('props');
  if (props) {
    for (const child of props.children) {
      if (child.userData.kind !== 'lamp' || child.userData.id !== id) continue;
      const v = new THREE.Vector3();
      if (child.userData.shade) child.userData.shade.getWorldPosition(v);
      else child.getWorldPosition(v);
      return v;
    }
  }
  const spec = (level().lamps || []).find(item => item.id === id);
  if (spec?.origin) {
    return new THREE.Vector3(spec.origin[0], (spec.origin[1] || 0) + 1.35, spec.origin[2]);
  }
  const o = game.lampPos[id] || light?.origin || [0, 0, 0];
  return new THREE.Vector3(o[0], o[1], o[2]);
}

function lampScreen(id, light) {
  const v = visualLampPos(id, light).project(app.camera);
  const rect = canvas.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * rect.width + rect.left,
    y: (-v.y * 0.5 + 0.5) * rect.height + rect.top
  };
}

function orbitAngle(event, screen) {
  return Math.atan2(event.clientX - screen.x, screen.y - event.clientY);
}

function interactLamp(id) {
  const lv = level();
  const light = (lv.lights || []).find(item => item.id === id);
  const mirror = (lv.mirrors || []).find(item => item.id === id);
  if (light && !lampInteractable(light)) {
    if (lampAimable(light) && !lightHasPower(light)) setMiss(COPY.missPower);
    return;
  }
  if (mirror && !mirrorInteractable(mirror)) {
    setMiss(COPY.missPower);
    return;
  }
  game.focusLamp = id;
  audio.page();
  pulseGamepad(0.16, 45);
  if (mirror) {
    setLampYaw(id, rotateDetent(shownYaw(id, mirror), mirror.detents || 15, mirror.turn || 1));
    afterLampChange();
    return;
  }
  if (!light) return;
  if (!light.power && game.enabled[id] === false) {
    setLampEnabled(id, true);
    stampIfSafe();
    return;
  }
  setLampYaw(id, rotateDetent(shownYaw(id, light), light.detents || 15, light.turn || 1));
  afterLampChange();
}

function poseNow() {
  return {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    boxId: game.face?.boxId,
    face: game.face?.face,
    yaw: player.userData.yaw || 0
  };
}

function cloneCratePositions() {
  return Object.fromEntries(Object.entries(game.cratePos || {}).map(([id, crate]) => [id, {
    ...crate,
    min: crate.min.slice(),
    max: crate.max.slice()
  }]));
}

function cloneLampPositions() {
  return Object.fromEntries(Object.entries(game.lampPos || {}).map(([id, pos]) => [id, pos.slice()]));
}

function checkpointSnapshot(label) {
  return {
    label,
    time: game.time,
    pose: poseNow(),
    yaw: { ...game.yaw },
    enabled: { ...game.enabled },
    lampPos: cloneLampPositions(),
    cratePos: cloneCratePositions(),
    lanternHeld: game.lanternHeld,
    lanternOn: game.lanternOn,
    shadowCast: cloneShadowCast(),
    shadowPose: game.shadowPose ? cloneShadowPose(game.shadowPose) : null,
    shadowDetached: game.shadowDetached,
    shadowAnchor: game.shadowAnchor ? { ...game.shadowAnchor } : null,
    controlMode: game.controlMode,
    levers: { ...game.levers },
    viewIndex: game.viewIndex,
    slowmo: game.slowmo,
    slowmoUntil: game.slowmoUntil
  };
}

function persistResume() {
  if (!game.checkpoint || game.won) return;
  save = writeSave({
    resume: {
      version: RESUME_VERSION,
      index: game.index,
      snapshot: game.checkpoint,
      stats: {
        elapsed: game.runElapsed,
        falls: game.runFalls,
        hintUsed: game.runHintUsed
      }
    }
  });
}

function saveCheckpoint(label = COPY.checkpointSaved, record = true) {
  if (!game.run) return;
  if (record) stamp(game.run, poseNow());
  game.checkpoint = checkpointSnapshot(label);
  game.checkpointLabel = label;
  game.checkpointPulse = game.time + 1.4;
  persistResume();
}

function placeAtPose(pose) {
  if (!pose) return;
  game.face = { boxId: pose.boxId, face: pose.face || '+y' };
  player.userData.boxId = game.face.boxId;
  player.userData.yaw = pose.yaw || player.userData.yaw || Math.PI / 2;
  const box = findBox(game.face.boxId);
  const center = box ? faceCenter(box, game.face.face) : [pose.x, pose.y, pose.z];
  player.position.set(pose.x ?? center[0], pose.y ?? center[1], pose.z ?? center[2]);
  player.rotation.y = player.userData.yaw;
}

function recoverUnsafeCheckpoint() {
  const stats = {
    elapsed: game.runElapsed,
    falls: game.runFalls,
    hintUsed: game.runHintUsed
  };
  const index = game.index;
  spawnLevel(index);
  game.runElapsed = stats.elapsed;
  game.runFalls = stats.falls;
  game.runHintUsed = stats.hintUsed;
  game.resumed = false;
  game.inputGraceUntil = performance.now() + START_INPUT_GRACE_MS;
  game.coachMiss = null;
  game.coachMissUntil = 0;
  persistResume();
  flashInputStatus(COPY.checkpointReset, 3600);
  updateCoach();
}

function restoreCheckpoint(options = {}) {
  const snap = game.checkpoint;
  if (!snap) {
    startPlay(game.index);
    return;
  }
  if (options.resume) {
    game.runElapsed = options.resume.stats?.elapsed || 0;
    game.runFalls = options.resume.stats?.falls || 0;
    game.runHintUsed = !!options.resume.stats?.hintUsed;
    game.resumed = true;
  }
  game.time = snap.time;
  game.yaw = restoreKnownMap(game.yaw, snap.yaw);
  game.enabled = restoreKnownMap(game.enabled, snap.enabled);
  game.lampPos = restoreKnownMap(game.lampPos, snap.lampPos, pos => pos.slice());
  game.cratePos = restoreKnownMap(game.cratePos, snap.cratePos, crate => ({
    ...crate,
    min: crate.min.slice(),
    max: crate.max.slice()
  }));
  game.lanternHeld = !!snap.lanternHeld;
  game.lanternOn = !!snap.lanternOn;
  game.shadowCast = cloneShadowCast(snap.shadowCast);
  game.shadowPose = cloneShadowPose(snap.shadowPose);
  game.shadowDetached = !!snap.shadowDetached || !!game.shadowPose?.detached;
  game.shadowAnchor = snap.shadowAnchor ? { ...snap.shadowAnchor } : null;
  game.shadowLastSafePose = game.shadowPose ? cloneShadowPose(game.shadowPose) : null;
  game.shadowRoute = [];
  game.shadowPath = null;
  game.shadowPathT = 0;
  game.shadowPathFrom = null;
  game.shadowWalk = null;
  game.controlMode = snap.controlMode === 'shadow' && game.shadowPose ? 'shadow' : 'body';
  const switchIds = new Set((level().switches || []).map(sw => sw.id));
  game.levers = Object.fromEntries(Object.entries(snap.levers || {})
    .filter(([id]) => switchIds.has(id))
    .map(([id, value]) => [id, !!value]));
  game.viewIndex = snap.viewIndex || 0;
  game.slowmo = snap.slowmo || 1;
  game.slowmoUntil = snap.slowmoUntil || 0;
  game.checkpointLabel = snap.label || COPY.checkpointSaved;
  game.path = null;
  game.pathFrom = null;
  game.hazardStep = null;
  game.drag = null;
  game.lookDrag = null;
  game.dying = false;
  game.won = false;
  game.hurt = false;
  game.intro = level().referenceStyle ? 0 : LEVEL_INTRO_SECONDS;
  game.run.pose = { ...snap.pose };
  game.run.lockedUntil = performance.now() + START_INPUT_GRACE_MS;
  placeAtPose(snap.pose);
  player.visible = !game.firstPerson;
  rebuild(false);
  if (!checkpointIsSafe(game.world, snap)) {
    recoverUnsafeCheckpoint();
    return;
  }
  const held = player.getObjectByName('held-lantern');
  if (held) held.visible = game.lanternHeld && game.lanternOn && !game.firstPerson;
  refreshShadowPose();
  updateControlUi();
  game.lastFall = null;
  game.lastFallUntil = 0;
  game.coachMiss = null;
  game.coachMissUntil = 0;
  flashInputStatus(options.resume ? COPY.resumeRecovered : COPY.checkpointRecovered, options.resume ? 3000 : 1900);
  renderViews();
  syncFpsHud(game.screen === 'play');
  if (options.resume) persistResume();
  updateCoach();
}

// 每关的核心机制第一次生效时放慢一拍并把镜头推近，让玩家看清自己做成了什么。
function fireReveal(kind) {
  const spec = level().reveal;
  if (!spec || spec.on !== kind || game.revealFired || game.screen !== 'play') return;
  game.revealFired = true;
  const hold = Math.max(0.2, Number(spec.hold) || 0.6);
  game.slowmo = Math.max(0.2, Math.min(1, Number(spec.slowmo) || 0.45));
  game.slowmoUntil = game.time + hold * game.slowmo;
  game.revealUntil = game.time + hold * game.slowmo;
  if (Array.isArray(spec.focus)) {
    game.hintTarget = new THREE.Vector3(spec.focus[0], spec.focus[1], spec.focus[2]);
    game.hintUntil = game.time + hold * game.slowmo;
  }
  audio.reveal?.();
  persistResume();
}

function moveTo(ref) {
  if (!ref || !game.graph) return;
  const path = findPath(game.graph, game.face, ref);
  if (!path || path.length < 2) {
    startPinnedShadowWalk(ref);
    return;
  }
  game.path = path;
  game.pathT = 0;
  game.pathFrom = player.position.clone();
}

function startPinnedShadowWalk(ref) {
  const shape = game.shadowCast?.shape;
  const points = shape?.path;
  const target = findBox(ref?.boxId);
  if (!shape || !Array.isArray(points) || points.length < 2 || ref?.face !== '+y' || !target) return false;
  if (Math.hypot(player.position.x - shape.start[0], player.position.z - shape.start[2]) > 0.72) return false;
  const tip = points.at(-1);
  const onTarget = tip[0] >= target.min[0] - 0.2 && tip[0] <= target.max[0] + 0.2
    && tip[2] >= target.min[2] - 0.2 && tip[2] <= target.max[2] + 0.2
    && Math.abs(tip[1] - target.max[1]) <= 0.2;
  if (!onTarget) return false;
  const walkPoints = [[player.position.x, player.position.y, player.position.z], ...points.slice(1).map(point => point.slice())];
  if (!bodyPathClearsRaisedSolids(game.world?.boxes, walkPoints, {
    radius: PLAYER_RADIUS,
    height: PLAYER_HEIGHT
  })) return false;
  game.path = null;
  game.shadowWalk = {
    points: walkPoints,
    target: { boxId: ref.boxId, face: '+y' },
    distance: 0
  };
  return true;
}

function followPinnedShadowWalk(dt) {
  const walk = game.shadowWalk;
  if (!walk) return false;
  walk.distance += 3.15 * dt;
  let remaining = walk.distance;
  for (let i = 1; i < walk.points.length; i += 1) {
    const a = walk.points[i - 1];
    const b = walk.points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (remaining <= length) {
      const t = length > 1e-6 ? remaining / length : 1;
      player.position.set(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
      );
      player.userData.yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
      return true;
    }
    remaining -= length;
  }
  const end = walk.points.at(-1);
  player.position.set(end[0], end[1], end[2]);
  game.face = walk.target;
  player.userData.boxId = walk.target.boxId;
  game.shadowWalk = null;
  audio.step();
  stampIfSafe();
  tryWin();
  return false;
}

function moveBasis() {
  const yaw = THREE.MathUtils.degToRad(currentView()?.yaw ?? -38);
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  return { forward, right };
}

function facesTouch(a, b) {
  const boxA = findBox(a.boxId);
  const boxB = findBox(b.boxId);
  if (!boxA || !boxB) return false;
  return facesShareEdge(boxA, a.face, boxB, b.face) || facesStepAdjacent(boxA, a.face, boxB, b.face);
}

function moveToOrFall(ref) {
  if (!ref || !game.face) return;
  const kind = hazardKind(ref);
  if (!kind) {
    moveTo(ref);
    return;
  }
  if (facesTouch(game.face, ref)) {
    stepIntoHazard(ref, kind);
    return;
  }
  if (!game.graph) {
    doFall(kind);
    return;
  }
  let best = null;
  for (const node of game.graph.nodes.values()) {
    if (!facesTouch(node.ref, ref)) continue;
    const path = findPath(game.graph, game.face, node.ref);
    if (!path) continue;
    if (!best || path.length < best.length) best = [...path, ref];
  }
  if (!best) {
    setMiss(kind === 'overexposure' ? COPY.missWhite : COPY.missVoid);
    return;
  }
  game.hazardStep = kind;
  game.path = best;
  game.pathT = 0;
  game.pathFrom = player.position.clone();
}

function neighborStep(dir) {
  if (!game.world || !game.face) return;
  const { forward, right } = moveBasis();
  const wish = new THREE.Vector3().addScaledVector(right, dir.x).addScaledVector(forward, dir.z);
  if (wish.lengthSq() < 0.04) return;
  wish.normalize();
  const candidates = [];
  const node = game.graph?.nodes.get(faceKey(game.face));
  if (node) candidates.push(...node.neighbors);
  for (const box of game.world.boxes) {
    if (!isWalkRole(box)) continue;
    const ref = { boxId: boxId(box), face: '+y' };
    if (ref.boxId === game.face.boxId) continue;
    if (hazardKind(ref) == null) continue;
    if (!facesTouch(game.face, ref)) continue;
    candidates.push(ref);
  }
  let best = null;
  let score = 0.08;
  for (const next of candidates) {
    const box = findBox(next.boxId);
    if (!box) continue;
    const c = faceCenter(box, next.face);
    const dx = c[0] - player.position.x;
    const dy = c[1] - player.position.y;
    const dz = c[2] - player.position.z;
    const hLen = Math.hypot(dx, dz);
    let s;
    if (hLen < 0.28) {
      s = (dy > 0 ? 1 : dy < 0 ? -1 : 0) * dir.z;
    } else {
      s = (dx * wish.x + dz * wish.z) / hLen;
    }
    if (s > score) {
      score = s;
      best = next;
    }
  }
  if (!best) return;
  moveToOrFall(best);
}

const WALK_PAD = 0.02;
const PLAYER_RADIUS = 0.31;
const PLAYER_HEIGHT = 1.45;
const PAPER_STEP_UP = 0.65;
const SHADOW_STEP_UP = 0.85;
const SHADOW_EDGE_GRACE = 0.16;
const HAZARD_INSET = 0.015;

function isLitTop(box) {
  if (!box || !game.world || !isWalkRole(box)) return false;
  return lightCount(game.world, { boxId: boxId(box), face: '+y' }) === 1;
}

function xzOnTop(box, x, z, pad = 0) {
  const minX = box.min[0] + pad;
  const maxX = box.max[0] - pad;
  const minZ = box.min[2] + pad;
  const maxZ = box.max[2] - pad;
  if (maxX < minX || maxZ < minZ) {
    const cx = (box.min[0] + box.max[0]) / 2;
    const cz = (box.min[2] + box.max[2]) / 2;
    return Math.hypot(x - cx, z - cz) <= Math.max(pad, 0.08);
  }
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

function walkHitAt(x, z, y, pad = 0) {
  let best = null;
  let bestTop = -Infinity;
  for (const box of game.world?.boxes || []) {
    if (!isLitTop(box) || !xzOnTop(box, x, z, pad)) continue;
    const top = box.max[1];
    // 台面重叠时站上最高的一层，否则永远踩不上高出脚底的那一级。
    if (Math.abs(top - y) > PAPER_STEP_UP || top <= bestTop) continue;
    bestTop = top;
    best = { x, z, y: top, ref: { boxId: boxId(box), face: '+y' } };
  }
  return best;
}

function frozenShadowHitAt(x, z, y, pad = SHADOW_EDGE_GRACE) {
  const hit = shadowShapeAt(game.shadowCast?.shape, x, z, pad, y);
  if (!hit || Math.abs(hit.y - y) > SHADOW_STEP_UP) return null;
  if (shadowHitBlockedBySolid(game.world?.boxes, hit)) return null;
  return { x, z, y: hit.y, ref: null, shadow: true };
}

function bodyCanStandAt(hit) {
  return !!hit && !bodyOverlapsRaisedSolid(game.world?.boxes, hit, {
    radius: PLAYER_RADIUS,
    height: PLAYER_HEIGHT,
    stepUp: PAPER_STEP_UP,
    steppable: isLitTop
  });
}

function slideWalk(x, z) {
  const y = player.position.y;
  const direct = walkHitAt(x, z, y);
  if (bodyCanStandAt(direct)) return direct;
  const frozen = frozenShadowHitAt(x, z, y);
  if (bodyCanStandAt(frozen)) return frozen;
  // The widened shadow gets first refusal. If it does not carry this step and
  // the player's center has crossed into a pit, the hazard is real rather
  // than being converted into harmless movement along the paper edge.
  const hazard = hazardAtPoint(level().hazards, x, z, HAZARD_INSET);
  if (hazard) return { x, z, y, ref: game.face, hazard: hazard.kind };
  const alongX = walkHitAt(x, player.position.z, y);
  if (bodyCanStandAt(alongX)) return alongX;
  const frozenX = frozenShadowHitAt(x, player.position.z, y);
  if (bodyCanStandAt(frozenX)) return frozenX;
  const alongZ = walkHitAt(player.position.x, z, y);
  if (bodyCanStandAt(alongZ)) return alongZ;
  const frozenZ = frozenShadowHitAt(player.position.x, z, y);
  if (bodyCanStandAt(frozenZ)) return frozenZ;
  const standingOnShadow = frozenShadowHitAt(
    player.position.x,
    player.position.z,
    y,
    SHADOW_EDGE_GRACE
  );
  if (bodyCanStandAt(standingOnShadow)) {
    return { x: player.position.x, z: player.position.z, y, ref: null, shadow: true };
  }
  const here = findBox(game.face?.boxId);
  if (here && isLitTop(here) && xzOnTop(here, player.position.x, player.position.z, -WALK_PAD)) {
    const minX = Math.min(here.min[0] + WALK_PAD, here.max[0] - WALK_PAD);
    const maxX = Math.max(here.min[0] + WALK_PAD, here.max[0] - WALK_PAD);
    const minZ = Math.min(here.min[2] + WALK_PAD, here.max[2] - WALK_PAD);
    const maxZ = Math.max(here.min[2] + WALK_PAD, here.max[2] - WALK_PAD);
    const clamped = {
      x: Math.min(maxX, Math.max(minX, x)),
      z: Math.min(maxZ, Math.max(minZ, z)),
      y: here.max[1],
      ref: { boxId: boxId(here), face: '+y' }
    };
    if (bodyCanStandAt(clamped)) return clamped;
  }
  return { x: player.position.x, z: player.position.z, y, ref: game.face };
}

function shadowWalkHitAt(x, z, y, pad = 0) {
  let best = null;
  let bestDy = Infinity;
  for (const box of game.world?.boxes || []) {
    if (!isWalkRole(box) || !xzOnTop(box, x, z, pad)) continue;
    const top = box.max[1] + 0.035;
    const dy = Math.abs(top - y);
    if (dy > 1.7 || dy >= bestDy) continue;
    bestDy = dy;
    best = { x, z, y: top, ref: { boxId: boxId(box), face: '+y' } };
  }
  return best;
}

function shadowSlideWalk(x, z) {
  if (!game.shadowPose) return null;
  const y = game.shadowPose.y;
  const direct = shadowWalkHitAt(x, z, y);
  if (direct) return direct;
  const alongX = shadowWalkHitAt(x, game.shadowPose.z, y);
  if (alongX) return alongX;
  const alongZ = shadowWalkHitAt(game.shadowPose.x, z, y);
  if (alongZ) return alongZ;
  const here = findBox(game.shadowPose.boxId);
  if (here && isWalkRole(here)) {
    const minX = Math.min(here.min[0] + WALK_PAD, here.max[0] - WALK_PAD);
    const maxX = Math.max(here.min[0] + WALK_PAD, here.max[0] - WALK_PAD);
    const minZ = Math.min(here.min[2] + WALK_PAD, here.max[2] - WALK_PAD);
    const maxZ = Math.max(here.min[2] + WALK_PAD, here.max[2] - WALK_PAD);
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      z: Math.min(maxZ, Math.max(minZ, z)),
      y: here.max[1] + 0.035,
      ref: { boxId: boxId(here), face: '+y' }
    };
  }
  return { x: game.shadowPose.x, z: game.shadowPose.z, y, ref: game.shadowPose };
}

function wishFromInput(x, z) {
  if (game.firstPerson) {
    const fx = -Math.sin(game.lookYaw);
    const fz = -Math.cos(game.lookYaw);
    const rx = Math.cos(game.lookYaw);
    const rz = -Math.sin(game.lookYaw);
    return { x: rx * x + fx * z, z: rz * x + fz * z };
  }
  const { forward, right } = moveBasis();
  return {
    x: right.x * x + forward.x * z,
    z: right.z * x + forward.z * z
  };
}

function tickFreeMove(dt, x, z) {
  const mag = Math.min(1, Math.hypot(x, z));
  if (mag < 0.12) {
    game.freeMoving = false;
    if (game.wasFreeMoving) {
      game.wasFreeMoving = false;
      stampIfSafe();
      tryWin();
    }
    return;
  }
  if (game.path && !game.hazardStep) {
    game.path = null;
    game.pathFrom = null;
  }
  const nx = x / mag;
  const nz = z / mag;
  const wish = wishFromInput(nx, nz);
  const len = Math.hypot(wish.x, wish.z) || 1;
  const speed = 3.2 * mag * dt;
  const next = slideWalk(
    player.position.x + (wish.x / len) * speed,
    player.position.z + (wish.z / len) * speed
  );
  if (!next) return;
  const moved = Math.hypot(next.x - player.position.x, next.z - player.position.z) > 0.0004;
  const prevFace = game.face?.boxId;
  player.position.set(next.x, next.y, next.z);
  if (next.hazard) {
    game.freeMoving = false;
    doFall(next.hazard);
    return;
  }
  if (next.ref) {
    game.face = next.ref;
    player.userData.boxId = next.ref.boxId;
    if (next.ref.boxId !== prevFace) {
      if ((level().switches || []).some(sw => sw.kind === 'plate')) rebuild(false);
      if (prevFace && (level().lights || []).some(light => light.rotate)) fireReveal('seamSweep');
    }
  }
  game.freeMoving = moved;
  if (moved) {
    game.wasFreeMoving = true;
    player.userData.yaw = Math.atan2(wish.x, wish.z);
    if (next.ref?.boxId === level().goal.boxId) tryWin();
  }
}

function tickShadowFreeMove(dt, x, z) {
  if (!game.shadowPose) return;
  if (game.shadowPath) {
    followShadowPath(dt);
    return;
  }
  const mag = Math.min(1, Math.hypot(x, z));
  if (mag < 0.12) {
    game.freeMoving = false;
    return;
  }
  const nx = x / mag;
  const nz = z / mag;
  const wish = wishFromInput(nx, nz);
  const len = Math.hypot(wish.x, wish.z) || 1;
  const speed = 3.35 * mag * dt;
  const next = shadowSlideWalk(
    game.shadowPose.x + (wish.x / len) * speed,
    game.shadowPose.z + (wish.z / len) * speed
  );
  if (!next) return;
  const moved = Math.hypot(next.x - game.shadowPose.x, next.z - game.shadowPose.z) > 0.0004;
  if (!moved) {
    const wish = wishFromInput(nx, nz);
    const node = game.shadowGraph?.nodes.get(faceKey({ boxId: game.shadowPose.boxId, face: '+y' }));
    let best = null;
    let bestScore = 0.16;
    for (const candidate of node?.neighbors || []) {
      const box = findBox(candidate.boxId);
      if (!box) continue;
      const c = faceCenter(box, '+y');
      const dx = c[0] - game.shadowPose.x;
      const dz = c[2] - game.shadowPose.z;
      const length = Math.hypot(dx, dz) || 1;
      const score = (dx * wish.x + dz * wish.z) / length;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (best) shadowMoveTo(best);
    return;
  }
  const tethered = clampShadowToTether(
    next,
    game.shadowAnchor,
    level().shadowControl?.maxDistance || 10
  );
  game.shadowPose.x = tethered.x;
  game.shadowPose.y = tethered.y;
  game.shadowPose.z = tethered.z;
  game.shadowPose.length = Math.hypot(
    game.shadowPose.x - player.position.x,
    game.shadowPose.z - player.position.z
  );
  if (next.ref) {
    game.shadowPose.boxId = next.ref.boxId;
    game.shadowPose.face = next.ref.face;
  }
  game.shadowPose.yaw = Math.atan2(wish.x, wish.z);
  game.shadowPose.detached = true;
  game.freeMoving = true;
  game.shadowSync = 0;
  refreshShadowPose();
}

function nudgeLamp(id, dir) {
  const light = (level().lights || []).find(item => item.id === id);
  const mirror = (level().mirrors || []).find(item => item.id === id);
  if (light && !lampInteractable(light)) {
    if (lampAimable(light) && !lightHasPower(light)) setMiss(COPY.missPower);
    return;
  }
  if (mirror && !mirrorInteractable(mirror)) {
    setMiss(COPY.missPower);
    return;
  }
  if (!light && !mirror) return;
  game.focusLamp = id;
  audio.page();
  const spec = light || mirror;
  setLampYaw(id, rotateDetent(shownYaw(id, spec), spec.detents || 15, dir));
  afterLampChange();
}

function aimFromHits(hits) {
  for (const hit of hits) {
    let obj = hit.object;
    while (obj && !obj.userData.kind) obj = obj.parent;
    const data = obj?.userData;
    if (!data) continue;
    if (data.kind === 'lamp') {
      const light = (level().lights || []).find(item => item.id === data.id);
      if (!lampInteractable(light)) continue;
      return { kind: 'lamp', id: data.id, obj };
    }
    if (data.kind === 'mirror') {
      const mirror = (level().mirrors || []).find(item => item.id === data.id);
      if (!mirrorInteractable(mirror)) continue;
    }
    if (['lever', 'pickup', 'mirror', 'crate'].includes(data.kind)) {
      return { kind: data.kind, id: data.id || data.boxId, boxId: data.boxId, obj };
    }
  }
  return null;
}

function actionKey() {
  if (game.lastInput === 'gamepad') return 'A';
  if (game.lastInput === 'touch') return '点按';
  return 'E';
}

function actionLabel(aim) {
  if (aim?.kind === 'lamp') return '转动路灯';
  if (aim?.kind === 'mirror') return '转动纸镜';
  if (aim?.kind === 'lever') return '扳动纸闸';
  if (aim?.kind === 'pickup') return '拾起提灯';
  if (aim?.kind === 'crate') return '推开障碍';
  return '';
}

function promptForAim(aim) {
  const label = actionLabel(aim);
  return label ? `${actionKey()} · ${label}` : '';
}

function activateTarget(target) {
  if (!target || controlsLocked()) return false;
  if (target.kind === 'lamp' || target.kind === 'mirror') {
    interactLamp(target.id);
    return true;
  }
  if (target.kind === 'lever') return toggleLever(target.id);
  if (target.kind === 'pickup') {
    takePickup();
    return true;
  }
  if (target.kind === 'crate') {
    nudgeCrate(1, target.id || target.boxId);
    return true;
  }
  return false;
}

function activateAim() {
  return activateTarget(game.aim);
}

function updateNearbyAction() {
  if (game.controlMode === 'shadow') {
    game.nearbyAction = null;
    game.shadowTarget = null;
    const shadowSwitch = shadowSwitchTarget();
    const label = shadowSwitch ? COPY.shadowSwitchNear : '';
    if (shadowSwitch) game.shadowSwitchLatched = true;
    nearbyPrompt.classList.toggle('hidden', !label);
    if (label) {
      nearbyPromptKey.textContent = '影';
      nearbyPromptText.textContent = label;
    }
    updateShadowActionUi(null);
    updateControlUi();
    return;
  }
  const enabled = game.screen === 'play' && !game.firstPerson && game.lastInput !== 'touch' && !game.dying && !game.won;
  game.nearbyAction = enabled && game.world ? findNearbyAction() : null;
  const target = enabled ? findShadowTarget() : null;
  game.shadowTarget = target;
  const contextLabel = actionLabel(game.nearbyAction);
  const shadowLabel = shadowActionLabel(target);
  const preferShadow = !!target && !!shadowLabel;
  const label = preferShadow ? shadowLabel : contextLabel || shadowLabel;
  nearbyPrompt.classList.toggle('hidden', !label);
  updateShadowActionUi(target);
  if (!label) return;
  const key = preferShadow || (!contextLabel && shadowLabel) ? shadowActionKey() : actionKey();
  if (nearbyPromptKey.textContent !== key) nearbyPromptKey.textContent = key;
  if (nearbyPromptText.textContent !== label) nearbyPromptText.textContent = label;
}

function activateContextAction() {
  if (game.controlMode === 'shadow') return false;
  if (game.firstPerson && game.aim) return activateAim();
  const target = findNearbyAction();
  game.nearbyAction = target;
  if (activateTarget(target)) {
    updateNearbyAction();
    return true;
  }
  setMiss(COPY.missInteract);
  return false;
}

function updateAim() {
  if (!game.firstPerson || game.screen !== 'play') {
    syncFpsHud(false);
    return;
  }
  pointer.set(0, 0);
  raycaster.setFromCamera(pointer, app.camera);
  const props = levelRoot.getObjectByName('props');
  const objects = [...game.pickables, ...(props ? props.children : [])];
  const hits = raycaster.intersectObjects(objects, true);
  game.aim = aimFromHits(hits);
  const cross = document.getElementById('crosshair');
  const pop = document.getElementById('lamp-pop');
  const lampOn = game.aim?.kind === 'lamp';
  cross.classList.toggle('hidden', false);
  cross.classList.toggle('aim', !!(lampOn || game.aim?.kind === 'lever' || game.aim?.kind === 'pickup' || game.aim?.kind === 'mirror' || game.aim?.kind === 'crate'));
  const shadowTarget = findShadowTarget();
  game.shadowTarget = shadowTarget;
  const shadowLabel = shadowActionLabel(shadowTarget);
  const prompt = promptForAim(game.aim) || (shadowLabel ? `${shadowActionKey()} · ${shadowLabel}` : '');
  actionPrompt.textContent = prompt;
  actionPrompt.classList.toggle('hidden', !prompt);
  pop.classList.toggle('hidden', !lampOn);
  const aimedLight = lampOn ? (level().lights || []).find(item => item.id === game.aim.id) : null;
  document.getElementById('lamp-distance-row').classList.toggle('hidden', !lampMovable(aimedLight));
  const hint = document.getElementById('lamp-pop-hint');
  if (hint) hint.textContent = COPY.lampPopHint;
  syncHands();
  updateShadowActionUi(shadowTarget);
}

function startLampDrag(event, id) {
  const light = (level().lights || []).find(item => item.id === id);
  if (!lampInteractable(light)) {
    if (lampAimable(light) && !lightHasPower(light)) setMiss(COPY.missPower);
    return;
  }
  game.focusLamp = id;
  const screen = lampScreen(id, light);
  const shown = shownYaw(id, light);
  game.drag = {
    kind: 'lamp',
    id,
    sx: event.clientX,
    sy: event.clientY,
    moved: false,
    screen,
    startAngle: orbitAngle(event, screen),
    startYaw: shown,
    acc: 0,
    fps: !!game.firstPerson,
    pointerId: event.pointerId
  };
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }
  canvas.style.cursor = 'grabbing';
}

function pointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function hitsFrom(event) {
  pointerFromEvent(event);
  raycaster.setFromCamera(pointer, app.camera);
  const props = levelRoot.getObjectByName('props');
  const objects = [...game.pickables, ...(props ? props.children : [])];
  return raycaster.intersectObjects(objects, true);
}

function setMiss(text) {
  game.coachMiss = text;
  game.coachMissUntil = game.time + 3.4;
  updateCoach();
}

function syncObjective(text = '') {
  if (!objectiveText) return;
  objectiveText.textContent = text;
  const progress = `${String(game.index + 1).padStart(2, '0')} / ${String(LEVELS.length).padStart(2, '0')}`;
  levelState.textContent = save.showTimer ? `${progress} · ${formatRunTime(game.runElapsed)}` : progress;
  const fresh = game.checkpointPulse && game.time < game.checkpointPulse;
  checkpointState.textContent = fresh
    ? '检查点 · 已固化'
    : `检查点 · ${game.checkpointLabel || COPY.checkpointStart}`;
  objective.classList.toggle('checkpoint-flash', !!fresh);
}

function updateCoach() {
  if (game.screen !== 'play' || !game.world) {
    marker.visible = false;
    return;
  }
  if (game.coachMissUntil && game.time > game.coachMissUntil) {
    game.coachMiss = null;
    game.coachMissUntil = 0;
  }
  if (game.lastFallUntil && game.time > game.lastFallUntil) {
    game.lastFall = null;
    game.lastFallUntil = 0;
  }
  const pathOpen = !!(game.graph && game.face && findPath(game.graph, game.face, level().goal));
  const state = coachState(game, level(), game.world, { pathOpen });
  coachText.textContent = state.text;
  syncObjective(state.text);
  const hideMark = !!(game.coachMiss || game.lastFall || game.firstPerson || level().referenceStyle);
  const pos = hideMark ? null : resolveCoachTarget(state.target, game.world);
  if (pos) {
    marker.visible = true;
    marker.position.set(pos[0], pos[1] + 0.06, pos[2]);
    const pulse = 1 + Math.sin(game.time * 4.2) * 0.14;
    marker.scale.setScalar(pulse);
    markerMat.opacity = 0.55 + Math.sin(game.time * 4.2) * 0.28;
  } else {
    marker.visible = false;
  }
}

function showHint() {
  if ((game.screen !== 'play' && game.screen !== 'pause') || !game.world) return;
  const pathOpen = !!(game.graph && game.face && findPath(game.graph, game.face, level().goal));
  const state = coachState(game, level(), game.world, { pathOpen });
  const pos = resolveCoachTarget(state.target, game.world);
  game.hintTarget = pos
    ? new THREE.Vector3(pos[0], pos[1], pos[2])
    : player.position.clone();
  game.hintUntil = game.time + 2.6;
  game.runHintUsed = true;
  persistResume();
  save = writeSave({ hintUsed: true });
  game.pauseReason = '';
  pauseReason.textContent = '';
  pauseReason.classList.add('hidden');
  game.screen = 'play';
  show();
  setPlayChrome(true);
  updateCoach();
}

function onDown(event) {
  if (game.screen !== 'play') return;
  if (controlsLocked()) return;
  audio.start();
  const hits = hitsFrom(event);
  if (game.controlMode === 'shadow') {
    const floorHit = hits.find(hit => {
      let obj = hit.object;
      while (obj && !obj.userData.kind) obj = obj.parent;
      return obj?.userData.kind === 'solid';
    });
    const ref = floorHit ? worldToFaceRef(floorHit) : null;
    if (ref && shadowMoveTo({ boxId: ref.boxId, face: '+y' })) {
      flashInputStatus(COPY.shadowRoute, 900);
      return;
    }
    setMiss(COPY.shadowNoPath);
    return;
  }
  for (const hit of hits) {
    let obj = hit.object;
    while (obj && !obj.userData.kind) obj = obj.parent;
    const data = obj?.userData;
    if (!data) continue;
    if (data.kind === 'crate') {
      game.drag = { kind: 'crate', id: data.boxId, axis: (level().crates.find(c => c.id === data.boxId) || {}).axis || 'z' };
      return;
    }
    if (data.kind === 'lever') {
      toggleLever(data.id);
      return;
    }
    if (data.kind === 'lamp') {
      startLampDrag(event, data.id);
      return;
    }
    if (data.kind === 'mirror') {
      interactLamp(data.id);
      return;
    }
    if (data.kind === 'pickup') {
      return;
    }
  }
  if (game.firstPerson) {
    game.lookDrag = { lastX: event.clientX, lastY: event.clientY };
    if (event.pointerType === 'mouse' && event.button === 0) {
      canvas.requestPointerLock?.();
    }
    return;
  }
  const floorHit = hits.find(hit => {
    let obj = hit.object;
    while (obj && !obj.userData.kind) obj = obj.parent;
    return obj?.userData.kind === 'solid';
  });
  if (!floorHit) {
    setMiss(COPY.missEmpty);
    return;
  }
  const refHit = worldToFaceRef(floorHit);
  let ref = refHit;
  const count = ref && game.world ? lightCount(game.world, ref) : 0;
  if (ref && count !== 1) {
    const top = { boxId: ref.boxId, face: '+y' };
    if (lightCount(game.world, top) === 1) {
      ref = top;
    }
  }
  const lit = ref && game.world ? lightCount(game.world, ref) : 0;
  if (!ref || lit !== 1) {
    if (ref) moveToOrFall(ref);
    else setMiss(COPY.missEmpty);
    return;
  }
  game.coachMiss = null;
  game.lastFall = null;
  moveTo(ref);
}

let hoverMesh = null;
function setHover(mesh) {
  if (hoverMesh && hoverMesh !== mesh && hoverMesh.material && 'emissiveIntensity' in hoverMesh.material) {
    hoverMesh.material.emissiveIntensity = hoverMesh.userData.emi ?? 0.08;
  }
  hoverMesh = mesh && mesh.isMesh ? mesh : null;
  if (hoverMesh?.material && 'emissiveIntensity' in hoverMesh.material) {
    if (hoverMesh.userData.emi == null) hoverMesh.userData.emi = hoverMesh.material.emissiveIntensity;
    hoverMesh.material.emissiveIntensity = Math.max(0.35, hoverMesh.userData.emi + 0.25);
  }
}

function onMove(event) {
  if (game.screen !== 'play') return;
  if (game.drag?.kind === 'lamp') {
    if (game.drag.fps) {
      const dx = event.movementX || (event.clientX - game.drag.sx);
      game.drag.sx = event.clientX;
      game.drag.sy = event.clientY;
      if (!game.drag.moved && Math.abs(dx) < 2) return;
      game.drag.moved = true;
      const light = (level().lights || []).find(item => item.id === game.drag.id);
      if (!lampInteractable(light)) return;
      game.drag.acc = (game.drag.acc || 0) + dx;
      setLampYaw(game.drag.id, game.drag.startYaw - game.drag.acc * 0.008);
      canvas.style.cursor = 'grabbing';
      return;
    }
    const dx = event.clientX - game.drag.sx;
    const dy = event.clientY - game.drag.sy;
    if (!game.drag.moved && Math.hypot(dx, dy) < 10) return;
    game.drag.moved = true;
    const light = (level().lights || []).find(item => item.id === game.drag.id);
    if (!lampInteractable(light)) return;
    const yaw = game.drag.startYaw - (orbitAngle(event, game.drag.screen) - game.drag.startAngle);
    setLampYaw(game.drag.id, yaw);
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (game.firstPerson && (document.pointerLockElement || game.lookDrag) && game.drag?.kind !== 'crate') {
    let mx = event.movementX || 0;
    let my = event.movementY || 0;
    if (!document.pointerLockElement && game.lookDrag) {
      mx = event.clientX - game.lookDrag.lastX;
      my = event.clientY - game.lookDrag.lastY;
      game.lookDrag.lastX = event.clientX;
      game.lookDrag.lastY = event.clientY;
    }
    game.lookYaw -= mx * 0.0024;
    game.lookPitch -= my * 0.0022;
    game.lookPitch = Math.max(-1.15, Math.min(1.15, game.lookPitch));
    if (document.pointerLockElement) return;
  }
  if (game.drag?.kind === 'crate') {
    const crate = game.cratePos[game.drag.id];
    if (!crate) return;
    pointerFromEvent(event);
    raycaster.setFromCamera(pointer, app.camera);
    const y = (crate.min[1] + crate.max[1]) / 2;
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), hit)) return;
    const axis = crate.axis || game.drag.axis || 'z';
    const index = axis === 'x' ? 0 : 2;
    const span = crate.max[index] - crate.min[index];
    const target = (axis === 'x' ? hit.x : hit.z) - span / 2;
    dragCrate(crate, axis, target - crate.min[index], crate.limit || [-2, 4]);
    rebuild(false);
    canvas.style.cursor = 'grabbing';
    return;
  }
  const hits = hitsFrom(event);
  let cursor = 'default';
  let mesh = null;
  for (const hit of hits) {
    let obj = hit.object;
    while (obj && !obj.userData.kind) obj = obj.parent;
    if (!obj) continue;
    if (['crate', 'lamp', 'mirror', 'pickup', 'lever'].includes(obj.userData.kind)) {
      if (obj.userData.kind === 'lamp') {
        const light = (level().lights || []).find(item => item.id === obj.userData.id);
        if (!lampInteractable(light)) continue;
      }
      if (obj.userData.kind === 'mirror') {
        const mirror = (level().mirrors || []).find(item => item.id === obj.userData.id);
        if (!mirrorInteractable(mirror)) continue;
      }
      const aimable = obj.userData.kind === 'lamp'
        && lampInteractable((level().lights || []).find(item => item.id === obj.userData.id));
      cursor = obj.userData.kind === 'crate' || aimable ? 'grab' : 'pointer';
      mesh = obj.isMesh ? obj : hit.object;
      break;
    }
    if (obj.userData.kind === 'solid') {
      const ref = worldToFaceRef(hit);
      if (ref && game.world) {
        const n = lightCount(game.world, ref);
        if (n === 1 || (mesh == null && n !== 1 && obj.visible !== false)) {
          cursor = 'pointer';
          mesh = obj.isMesh ? obj : hit.object;
        }
      }
      break;
    }
  }
  canvas.style.cursor = cursor;
  setHover(mesh);
}

function onUp() {
  game.lookDrag = null;
  if (game.drag?.kind === 'lamp') {
    if (!game.drag.moved) interactLamp(game.drag.id);
    else afterLampChange();
    game.drag = null;
    return;
  }
  if (game.drag) {
    afterLampChange();
    audio.stamp();
  }
  game.drag = null;
}

canvas.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
window.addEventListener('wheel', event => {
  if (!game.firstPerson || game.screen !== 'play') return;
  if (game.aim?.kind !== 'lamp') return;
  event.preventDefault();
  const light = (level().lights || []).find(item => item.id === game.aim.id);
  if (event.shiftKey && lampMovable(light)) nudgeLampDistance(game.aim.id, event.deltaY > 0 ? 1 : -1);
  else nudgeLamp(game.aim.id, event.deltaY > 0 ? 1 : -1);
}, { passive: false });

document.getElementById('lamp-pop').addEventListener('pointerdown', event => {
  event.stopPropagation();
});
document.getElementById('lamp-left').addEventListener('click', event => {
  event.preventDefault();
  const id = game.aim?.kind === 'lamp' ? game.aim.id : currentHandLamp();
  if (id) nudgeLamp(id, -1);
});
document.getElementById('lamp-right').addEventListener('click', event => {
  event.preventDefault();
  const id = game.aim?.kind === 'lamp' ? game.aim.id : currentHandLamp();
  if (id) nudgeLamp(id, 1);
});
document.getElementById('lamp-near').addEventListener('click', event => {
  event.preventDefault();
  const id = game.aim?.kind === 'lamp' ? game.aim.id : currentHandLamp();
  if (id) nudgeLampDistance(id, -1);
});
document.getElementById('lamp-far').addEventListener('click', event => {
  event.preventDefault();
  const id = game.aim?.kind === 'lamp' ? game.aim.id : currentHandLamp();
  if (id) nudgeLampDistance(id, 1);
});

document.getElementById('hands').addEventListener('pointerdown', event => {
  event.stopPropagation();
  game.lookDrag = null;
});
document.getElementById('hands-lamp-left').addEventListener('click', event => {
  event.preventDefault();
  const id = currentHandLamp();
  if (id) nudgeLamp(id, -1);
});
document.getElementById('hands-lamp-right').addEventListener('click', event => {
  event.preventDefault();
  const id = currentHandLamp();
  if (id) nudgeLamp(id, 1);
});
document.getElementById('hands-lamp-near').addEventListener('click', event => {
  event.preventDefault();
  const id = currentHandLamp();
  if (id) nudgeLampDistance(id, -1);
});
document.getElementById('hands-lamp-far').addEventListener('click', event => {
  event.preventDefault();
  const id = currentHandLamp();
  if (id) nudgeLampDistance(id, 1);
});
document.getElementById('hands-lamp-next').addEventListener('click', event => {
  event.preventDefault();
  const ids = handLampIds();
  if (ids.length < 2) return;
  const i = Math.max(0, ids.indexOf(currentHandLamp()));
  game.handLamp = ids[(i + 1) % ids.length];
  syncHands();
  audio.page();
});
document.getElementById('hands-crate-push').addEventListener('click', event => {
  event.preventDefault();
  nudgeCrate(1);
});
document.getElementById('hands-crate-pull').addEventListener('click', event => {
  event.preventDefault();
  nudgeCrate(-1);
});
document.getElementById('hands-lever-toggle').addEventListener('click', event => {
  event.preventDefault();
  const id = currentLeverId();
  if (id) toggleLever(id);
});
document.getElementById('hands-pick-btn').addEventListener('click', event => {
  event.preventDefault();
  takePickup();
});

const heldKeys = new Set();
const stickVec = { x: 0, z: 0 };
let stickActive = false;
let gamepadState = null;
let activeGamepadIndex = null;
let inputStatusUntil = 0;

const keyDir = {
  KeyW: { x: 0, z: 1 }, ArrowUp: { x: 0, z: 1 },
  KeyS: { x: 0, z: -1 }, ArrowDown: { x: 0, z: -1 },
  KeyA: { x: -1, z: 0 }, ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 }, ArrowRight: { x: 1, z: 0 }
};

function tickMove(dt) {
  if (game.screen !== 'play' || controlsLocked()) return;
  let x = 0;
  let z = 0;
  for (const code of heldKeys) {
    const dir = keyDir[code];
    if (!dir) continue;
    x += dir.x;
    z += dir.z;
  }
  if (stickActive && (stickVec.x || stickVec.z)) {
    x += stickVec.x;
    z += stickVec.z;
  }
  if (gamepadState?.move) {
    x += gamepadState.move.x;
    z += gamepadState.move.z;
  }
  if (game.awaitingNeutralInput) {
    if (Math.hypot(x, z) <= 0.08) game.awaitingNeutralInput = false;
    return;
  }
  if (game.controlMode === 'shadow') tickShadowFreeMove(dt, x, z);
  else tickFreeMove(dt, x, z);
}

const stickEl = document.getElementById('stick');
const stickKnob = document.getElementById('stick-knob');
const STICK_MAX = 32;

function setStickOffset(dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, STICK_MAX / len);
  const nx = dx * k;
  const ny = dy * k;
  stickKnob.style.transform = `translate(${nx}px, ${ny}px)`;
  stickVec.x = nx / STICK_MAX;
  stickVec.z = -ny / STICK_MAX;
  stickActive = Math.hypot(stickVec.x, stickVec.z) > 0.12;
}

stickEl.addEventListener('pointerdown', event => {
  event.preventDefault();
  event.stopPropagation();
  stickEl.setPointerCapture(event.pointerId);
  const rect = document.getElementById('stick-base').getBoundingClientRect();
  setStickOffset(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
});
stickEl.addEventListener('pointermove', event => {
  if (!stickEl.hasPointerCapture(event.pointerId)) return;
  event.preventDefault();
  const rect = document.getElementById('stick-base').getBoundingClientRect();
  setStickOffset(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
});
function resetStick() {
  stickKnob.style.transform = 'translate(0px, 0px)';
  stickVec.x = 0;
  stickVec.z = 0;
  stickActive = false;
}
stickEl.addEventListener('pointerup', resetStick);
stickEl.addEventListener('pointercancel', resetStick);

function setInputMode(mode) {
  if (!mode || game.lastInput === mode) return;
  game.lastInput = mode;
  document.body.classList.toggle('using-gamepad', mode === 'gamepad');
  document.body.classList.toggle('using-touch', mode === 'touch');
  if (mode === 'gamepad') audio.start();
  updateNearbyAction();
  updateControlUi();
}

function flashInputStatus(text, duration = 2200) {
  if (!inputStatus) return;
  inputStatus.textContent = text;
  inputStatus.classList.remove('hidden');
  inputStatusUntil = performance.now() + duration;
}

function pulseGamepad(strong = 0.25, duration = 70, weak = strong * 0.55) {
  if (!save.vibration) return;
  let pad = null;
  try {
    pad = selectGamepad(navigator.getGamepads?.() || []);
  } catch {
    return;
  }
  const actuator = pad?.vibrationActuator;
  try {
    if (actuator?.playEffect) {
      actuator.playEffect('dual-rumble', {
        duration,
        startDelay: 0,
        strongMagnitude: Math.max(0, Math.min(1, strong)),
        weakMagnitude: Math.max(0, Math.min(1, weak))
      })?.catch?.(() => {});
    } else if (actuator?.pulse) {
      actuator.pulse(Math.max(0, Math.min(1, strong)), duration)?.catch?.(() => {});
    } else {
      pad?.hapticActuators?.[0]?.pulse?.(Math.max(0, Math.min(1, strong)), duration)?.catch?.(() => {});
    }
  } catch {
    /* Haptics are optional and vary by browser/controller. */
  }
}

function updateInputStatus(now = performance.now()) {
  if (inputStatusUntil && now >= inputStatusUntil) {
    inputStatusUntil = 0;
    inputStatus.classList.add('hidden');
  }
}

function activeOverlayEntry() {
  return Object.entries(overlays).find(([, overlay]) => overlay.classList.contains('open')) || null;
}

function adjustFocusedControl(control, direction) {
  if (!control || !direction) return false;
  if (control.matches('input[type="range"]')) {
    if (direction > 0) control.stepUp();
    else control.stepDown();
    control.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  if (control.matches('input[type="checkbox"]')) {
    const next = direction > 0;
    if (control.checked !== next) {
      control.checked = next;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }
  return false;
}

function moveMenuFocus(dx, dy) {
  const entry = activeOverlayEntry();
  if (!entry) return false;
  const items = focusableElements(entry[1]);
  if (!items.length) return false;
  const active = items.includes(document.activeElement) ? document.activeElement : null;
  if (!active) {
    const first = items.find(item => item.hasAttribute('data-autofocus'))
      || items.find(item => item.classList.contains('primary'))
      || items[0];
    first.focus({ preventScroll: true });
    return true;
  }
  if (dx && adjustFocusedControl(active, dx)) {
    audio.page();
    return true;
  }

  const rect = active.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  let best = null;
  let bestScore = Infinity;
  for (const item of items) {
    if (item === active) continue;
    const next = item.getBoundingClientRect();
    const rx = next.left + next.width / 2 - cx;
    const ry = next.top + next.height / 2 - cy;
    const forward = rx * ux + ry * uy;
    if (forward <= 4) continue;
    const side = Math.abs(rx * uy - ry * ux);
    const score = forward + side * 2.4;
    if (score < bestScore) {
      best = item;
      bestScore = score;
    }
  }
  if (!best) {
    const index = items.indexOf(active);
    const step = dx < 0 || dy < 0 ? -1 : 1;
    best = items[(index + step + items.length) % items.length];
  }
  best.focus({ preventScroll: false });
  audio.page();
  return true;
}

function activateMenuFocus() {
  const entry = activeOverlayEntry();
  if (!entry) return false;
  const items = focusableElements(entry[1]);
  if (!items.length) return false;
  const active = items.includes(document.activeElement)
    ? document.activeElement
    : items.find(item => item.hasAttribute('data-autofocus'))
      || items.find(item => item.classList.contains('primary'))
      || items[0];
  active.focus({ preventScroll: true });
  if (active.matches('button, input[type="checkbox"]')) {
    active.click();
    return true;
  }
  return false;
}

function clearTransientInput() {
  if (game.drag) onUp();
  if (game.wasFreeMoving) stampIfSafe();
  heldKeys.clear();
  resetStick();
  game.freeMoving = false;
  game.wasFreeMoving = false;
  game.lookDrag = null;
  game.drag = null;
  canvas.style.cursor = 'default';
  setHover(null);
  document.exitPointerLock?.();
}

function pauseGame(reason = '') {
  if (game.screen !== 'play') return false;
  clearTransientInput();
  game.pauseReason = reason;
  pauseReason.textContent = reason;
  pauseReason.classList.toggle('hidden', !reason);
  game.screen = 'pause';
  show('pause');
  setPlayChrome(false);
  return true;
}

function resumeGame() {
  if (game.screen !== 'pause') return false;
  game.pauseReason = '';
  pauseReason.textContent = '';
  pauseReason.classList.add('hidden');
  game.screen = 'play';
  clock.getDelta();
  show();
  setPlayChrome(true);
  return true;
}

function returnFromGuide() {
  if (guideStep > 0) {
    guideStep -= 1;
    renderGuide();
    return;
  }
  if (guideMode === 'pause') {
    show('pause');
    game.screen = 'pause';
    setPlayChrome(false);
    return;
  }
  openTitle();
}

function backFromCurrentOverlay() {
  const name = activeOverlayEntry()?.[0];
  if (name === 'pause') return resumeGame();
  if (name === 'guide') {
    returnFromGuide();
    return true;
  }
  if (name === 'settings') {
    if (game.prevScreen === 'pause') {
      game.screen = 'pause';
      show('pause');
      setPlayChrome(false);
    } else openTitle();
    return true;
  }
  if (name === 'chapters' || name === 'credits' || name === 'confirm' || name === 'clear') {
    openTitle();
    return true;
  }
  if (name === 'chapter') {
    show('credits');
    game.screen = 'credits';
    return true;
  }
  return false;
}

function cycleView(direction) {
  const list = level().views || [];
  if (!list.length) return;
  if (game.firstPerson) toggleFirstPerson(false);
  setView((game.viewIndex + direction + list.length) % list.length);
}

function tickGamepad(dt) {
  const now = performance.now();
  let pad = null;
  try {
    pad = selectGamepad(navigator.getGamepads?.() || []);
  } catch {
    pad = null;
  }
  gamepadState = gamepadTracker.poll(pad, now);
  if (!gamepadState) {
    if (activeGamepadIndex != null) {
      flashInputStatus('手柄已断开');
      const fallback = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'keyboard';
      setInputMode(fallback);
    }
    activeGamepadIndex = null;
    updateInputStatus(now);
    return;
  }
  if (activeGamepadIndex !== gamepadState.index) {
    activeGamepadIndex = gamepadState.index;
    flashInputStatus('手柄已连接');
  }

  const used = Math.hypot(gamepadState.move.x, gamepadState.move.z) > 0.08
    || Math.hypot(gamepadState.look.x, gamepadState.look.y) > 0.08
    || Object.values(gamepadState.pressed).some(Boolean)
    || gamepadState.navStep.x !== 0
    || gamepadState.navStep.y !== 0;
  if (used) {
    setInputMode('gamepad');
  }

  if (gamepadState.pressed.start) {
    if (game.screen === 'play') pauseGame();
    else if (game.screen === 'pause') resumeGame();
    updateInputStatus(now);
    return;
  }

  if (game.screen === 'play') {
    if (game.firstPerson && !controlsLocked()) {
      game.lookYaw -= gamepadState.look.x * dt * 2.8;
      game.lookPitch -= gamepadState.look.y * dt * 2.35;
      game.lookPitch = Math.max(-1.15, Math.min(1.15, game.lookPitch));
    }
    if (gamepadState.pressed.north) toggleFirstPerson();
    if (gamepadState.pressed.lb) cycleView(-1);
    if (gamepadState.pressed.rb) cycleView(1);
    if (gamepadState.pressed.west) showHint();
    if (gamepadState.pressed.back) toggleShadowControl();
    if (gamepadState.pressed.south) activateContextAction();
    if (gamepadState.pressed.east) activateAbility();
  } else {
    if (gamepadState.navStep.x || gamepadState.navStep.y) {
      moveMenuFocus(gamepadState.navStep.x, gamepadState.navStep.y);
    }
    if (gamepadState.pressed.south) activateMenuFocus();
    if (gamepadState.pressed.east) backFromCurrentOverlay();
  }
  updateInputStatus(now);
}

window.addEventListener('keydown', event => {
  setInputMode('keyboard');
  if (event.code === 'Escape') {
    if (document.pointerLockElement) {
      document.exitPointerLock();
      return;
    }
    event.preventDefault();
    if (game.screen === 'play') pauseGame();
    else backFromCurrentOverlay();
    return;
  }
  if (game.screen !== 'play') {
    const menuDirection = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0]
    }[event.code];
    if (menuDirection) {
      event.preventDefault();
      moveMenuFocus(menuDirection[0], menuDirection[1]);
    } else if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) {
      event.preventDefault();
      activateMenuFocus();
    }
    return;
  }
  if (event.code === 'KeyF') {
    event.preventDefault();
    toggleFirstPerson();
    return;
  }
  if (event.code === 'KeyX') {
    event.preventDefault();
    toggleShadowControl();
    return;
  }
  if (event.code === 'KeyR') {
    event.preventDefault();
    startPlay(game.index);
    return;
  }
  if (event.code === 'KeyH') {
    event.preventDefault();
    showHint();
    return;
  }
  if (event.code === 'KeyM') {
    event.preventDefault();
    save = writeSave({ muted: !save.muted });
    audio.muteAll(save.muted || (save.music <= 0 && save.sfx <= 0));
    flashInputStatus(save.muted ? '声音已关闭' : '声音已开启');
    return;
  }
  if (keyDir[event.code]) {
    event.preventDefault();
    heldKeys.add(event.code);
    return;
  }
  if (controlsLocked()) return;
  if (event.code === 'Space' && (level().shadowCast || (level().lantern && game.lanternHeld))) {
    event.preventDefault();
    if (!event.repeat) activateAbility();
    return;
  }
  if (event.code === 'KeyE' || event.code === 'Enter') {
    event.preventDefault();
    activateContextAction();
    return;
  }
  if (event.code === 'KeyQ' || event.code === 'KeyC') {
    event.preventDefault();
    const dir = event.code === 'KeyC' ? 1 : -1;
    cycleView(dir);
  }
});

window.addEventListener('keyup', event => {
  heldKeys.delete(event.code);
});

document.addEventListener('pointerdown', event => {
  setInputMode(event.pointerType === 'touch' ? 'touch' : 'keyboard');
}, { capture: true });

shadowAction.addEventListener('pointerdown', event => {
  event.preventDefault();
  event.stopPropagation();
});
shadowAction.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  activateAbility();
});

shadowPin.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  if (!game.shadowCast) castPlayerShadow();
});

shadowRelease.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  releasePlayerShadow();
});

document.getElementById('shadow-light-near').addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  const light = shadowLightForBody();
  if (light) nudgeLampDistance(light.id, -1);
});

document.getElementById('shadow-light-far').addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  const light = shadowLightForBody();
  if (light) nudgeLampDistance(light.id, 1);
});

shadowSwitch.addEventListener('pointerdown', event => {
  event.preventDefault();
  event.stopPropagation();
});
shadowSwitch.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  toggleShadowControl();
});

function autoPause(reason) {
  if (!pauseGame(reason)) {
    heldKeys.clear();
    resetStick();
    game.lookDrag = null;
  }
}

window.addEventListener('blur', () => autoPause('窗口失去焦点，游戏已自动暂停。'));
window.addEventListener('pagehide', () => autoPause('游戏已自动暂停。'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) autoPause('页面切到后台，游戏已自动暂停。');
});

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  autoPause('画面设备暂时中断，游戏已暂停。');
  flashInputStatus('正在恢复画面', 5000);
});
canvas.addEventListener('webglcontextrestored', () => window.location.reload());

pauseBtn.addEventListener('click', () => {
  pauseGame();
});

document.getElementById('btn-start').addEventListener('click', () => {
  audio.start();
  if (hasProgress()) {
    game.prevScreen = 'title';
    game.screen = 'confirm';
    show('confirm');
    return;
  }
  if (!save.seenTutorial) openGuide('start');
  else startPlay(0);
});
document.getElementById('btn-continue').addEventListener('click', () => {
  audio.start();
  startPlay(Math.min(save.current, LEVELS.length - 1), { resume: true });
});
document.getElementById('btn-how').addEventListener('click', () => openGuide('how'));
document.getElementById('btn-how-pause').addEventListener('click', () => openGuide('pause'));
document.getElementById('guide-next').addEventListener('click', () => {
  if (guideStep < COPY.guide.length - 1) {
    guideStep += 1;
    renderGuide();
    return;
  }
  leaveGuide();
});
document.getElementById('guide-back').addEventListener('click', returnFromGuide);
document.getElementById('confirm-no').addEventListener('click', openTitle);
document.getElementById('confirm-yes').addEventListener('click', () => {
  save = writeSave({
    highest: 0,
    current: 0,
    hidden: [false, false, false],
    records: Array.from({ length: LEVELS.length }, () => null),
    resume: null,
    started: false
  });
  audio.start();
  if (!save.seenTutorial) openGuide('start');
  else startPlay(0);
});
document.getElementById('btn-chapters').addEventListener('click', () => {
  fillChapters();
  game.screen = 'chapters';
  show('chapters');
});
document.getElementById('btn-credits').addEventListener('click', () => {
  game.screen = 'credits';
  show('credits');
});
document.getElementById('btn-settings').addEventListener('click', () => {
  game.prevScreen = 'title';
  game.screen = 'settings';
  syncSettingsUi();
  show('settings');
});
document.getElementById('btn-pause-settings').addEventListener('click', () => {
  game.prevScreen = 'pause';
  game.screen = 'settings';
  syncSettingsUi();
  show('settings');
});
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-restart').addEventListener('click', () => startPlay(game.index));
document.getElementById('btn-back-title').addEventListener('click', openTitle);
document.getElementById('btn-hint').addEventListener('click', showHint);
document.getElementById('clear-go').addEventListener('click', () => {
  if (game.screen !== 'clear') return;
  startPlay(Math.min(game.index + 1, LEVELS.length - 1));
});
document.getElementById('chapter-skip').addEventListener('click', () => {
  if (game.screen === 'ending-card') {
    show('credits');
    game.screen = 'credits';
    return;
  }
  startPlay(Math.min(game.index + 1, LEVELS.length - 1));
});
document.getElementById('credits-back').addEventListener('click', openTitle);

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.back === 'title') openTitle();
    else backFromCurrentOverlay();
  });
});

document.getElementById('vol-music').addEventListener('input', e => {
  save = writeSave({ music: Number(e.target.value) / 100 });
  audio.setMusic(save.music);
});
document.getElementById('vol-sfx').addEventListener('input', e => {
  save = writeSave({ sfx: Number(e.target.value) / 100 });
  audio.setSfx(save.sfx);
});
document.getElementById('mute-audio').addEventListener('change', e => {
  save = writeSave({ muted: e.target.checked });
  audio.muteAll(save.muted || (save.music <= 0 && save.sfx <= 0));
});
document.getElementById('reduce-flash').addEventListener('change', e => {
  save = writeSave({ reduceFlash: e.target.checked });
  materials.over.color.setHex(save.reduceFlash ? 0xd8d2c8 : 0xffffff);
});
document.getElementById('show-timer').addEventListener('change', e => {
  save = writeSave({ showTimer: e.target.checked });
  updateCoach();
});
document.getElementById('gamepad-vibration').addEventListener('change', e => {
  save = writeSave({ vibration: e.target.checked });
  if (save.vibration) pulseGamepad(0.2, 60);
});
document.getElementById('q-high').addEventListener('click', () => {
  save = writeSave({ quality: 'high' });
  syncSettingsUi();
});
document.getElementById('q-low').addEventListener('click', () => {
  save = writeSave({ quality: 'low' });
  syncSettingsUi();
});

document.getElementById('fullscreen-toggle').addEventListener('click', async () => {
  const root = document.documentElement;
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (fullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      await exit?.call(document);
    } else {
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      await request?.call(root);
    }
  } catch {
    flashInputStatus('未能切换全屏');
  }
  syncSettingsUi();
});
document.addEventListener('fullscreenchange', syncSettingsUi);
document.addEventListener('webkitfullscreenchange', syncSettingsUi);

function tickHidden(dt) {
  const mark = level().hidden;
  if (!mark || !game.face) return;
  const idx = secretIndexForLevel(game.index);
  if (idx < 0 || save.hidden[idx]) return;
  if (game.face.boxId === mark.boxId) {
    game.hiddenHold += dt;
    if (game.hiddenHold > 1.15) {
      const hidden = save.hidden.slice();
      hidden[idx] = true;
      save = writeSave({ hidden });
      audio.stamp();
      pulseGamepad(0.42, 140, 0.28);
      flashInputStatus(`暗页已找到 · ${hidden.filter(Boolean).length} / ${hidden.length}`, 3200);
    }
  } else game.hiddenHold = 0;
}

function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  requestAnimationFrame(loop);
  tickGamepad(dt);
  audio.tick(dt);
  game.shreds = game.shreds.filter(group => tickShreds(group, dt));

  if (game.screen !== 'play' && game.ending <= 0) {
    tickPlayer(player, dt, false);
    tickShadowAvatar(shadowAvatar, dt, game.time);
    tickAtmosphere(atmosphere, dt, player.position);
    app.renderer.render(app.scene, app.camera);
    return;
  }

  if (game.ending > 0) {
    game.ending += dt;
    levelRoot.scale.set(Math.max(0.04, 1 - game.ending * 0.22), 1, Math.max(0.02, 1 - game.ending * 0.35));
    springLook(app.camera, new THREE.Vector3(9.4, 2.2, 1.3), { pitch: 18, dist: 12, yaw: 20 }, dt);
    app.renderer.render(app.scene, app.camera);
    if (game.ending > 3.2) {
      game.ending = 0;
      finishEnding();
    }
    return;
  }

  const scaled = dt * game.slowmo;
  if (game.slowmoUntil && game.time > game.slowmoUntil) game.slowmo = 1;
  game.time += scaled;
  game.runElapsed += dt;
  if (game.intro > 0) game.intro = Math.max(0, game.intro - dt / 1.2);

  if (level().lights.some(light => light.rotate) || (game.lanternHeld && game.lanternOn)) {
    game.lightSync -= scaled;
    if (game.lightSync <= 0) {
      game.lightSync = save.quality === 'low' ? 0.1 : 0.05;
      rebuild(false);
    }
  }

  let moving = false;
  if (game.shadowWalk) {
    moving = followPinnedShadowWalk(scaled);
  } else if (game.path) {
    const result = followPath(player, game.world, game.path, game.pathT, 3.15, game.pathFrom);
    game.pathT += scaled;
    moving = !result.done;
    if (result.face) {
      game.face = result.face;
      player.userData.boxId = result.face.boxId;
    }
    if (result.done) {
      const hazard = game.hazardStep || hazardKind();
      game.path = null;
      game.pathFrom = null;
      game.hazardStep = null;
      audio.step();
      if (hazard) doFall(hazard);
      else tryWin();
    }
  }

  if (game.intro <= 0 && game.controlMode === 'body' && game.face && !game.path && !game.shadowWalk && game.drag?.kind !== 'lamp' && !controlsLocked()) {
    const n = currentCount();
    if (n < 1) doFall('void');
    else if (n >= 2) doFall('overexposure');
  }

  tickHidden(dt);
  tickMove(dt);
  if (game.controlMode === 'body') tryTouchPickup();
  if (game.controlMode === 'body') refreshShadowPose();
  syncShadowCircuit(scaled);
  updateNearbyAction();
  const held = player.getObjectByName('held-lantern');
  if (held) held.visible = game.lanternHeld && game.lanternOn && !game.firstPerson;
  const blob = player.getObjectByName('blob-shadow');
  if (blob) {
    // 站在过曝区意味着光从四面来，接地暗部要跟着散掉。
    const lit = currentCount();
    blob.material.opacity = lit >= 2 ? 0 : 0.16;
  }
  tickPlayer(player, dt, moving || game.freeMoving);
  tickShadowAvatar(shadowAvatar, dt, game.time);

  const goalMesh = game.pickables.find(mesh => mesh.userData.goal);
  if (goalMesh?.material && 'emissiveIntensity' in goalMesh.material) {
    goalMesh.material.emissiveIntensity = 0.22 + Math.sin(game.time * 3.1) * 0.14;
  }
  const ring = goalMesh?.getObjectByName('goal-ring');
  if (ring) {
    const pulse = 1 + Math.sin(game.time * 2.6) * 0.08;
    ring.scale.set(pulse, pulse, pulse);
    if (ring.material) ring.material.opacity = 0.55 + Math.sin(game.time * 2.6) * 0.3;
  }
  const pickup = levelRoot.getObjectByName('pickup');
  if (pickup?.visible) {
    const p = level().pickup;
    const near = p && Math.hypot(player.position.x - p.x, player.position.z - p.z) < 1.6;
    pickup.position.y = (p?.y || 0) + 0.52 + Math.sin(game.time * (near ? 4.2 : 2.2)) * (near ? 0.1 : 0.06);
    pickup.rotation.y += dt * (near ? 1.6 : 0.8);
    if (pickup.userData.glow?.material) {
      pickup.userData.glow.material.opacity = near ? 0.72 + Math.sin(game.time * 7) * 0.16 : 0.42;
    }
  }
  const props = levelRoot.getObjectByName('props');
  if (props) {
    for (const child of props.children) {
      if (child.userData.kind === 'monument') {
        const halo = child.getObjectByName('monument-halo');
        if (halo?.material) {
          const base = halo.userData.baseScale || halo.scale.x || 1;
          const pulse = 1 + Math.sin(game.time * 1.7) * 0.035;
          halo.scale.setScalar(base * pulse);
          halo.material.opacity = child.userData.id === 'eclipse'
            ? 0.42 + Math.sin(game.time * 1.3) * 0.05
            : 0.24 + Math.sin(game.time * 2.1) * 0.05;
        }
        if (child.userData.id === 'prism') {
          const body = child.getObjectByName('monument-body');
          const core = child.getObjectByName('monument-core');
          if (body) body.rotation.y += dt * 0.1;
          if (core) core.rotation.y -= dt * 0.16;
        }
      }
      if (child.userData.glow?.visible && child.userData.glow.material) {
        child.userData.glow.material.opacity = 0.28 + Math.sin(game.time * 2.5 + (child.position.x || 0)) * 0.12;
      }
      if (child.userData.kind === 'wire') {
        const on = !!game.world?.closed?.[child.userData.from];
        for (const bead of child.userData.beads || []) {
          if (!on || !bead.material) continue;
          bead.material.emissiveIntensity = 0.42 + Math.sin(game.time * 6 + bead.position.x) * 0.18;
        }
      }
    }
  }
  tickAtmosphere(atmosphere, dt, controlledPosition());
  tickReveals(levelRoot, dt);
  tickShadowField(levelRoot, game.time);
  syncStandFloor();
  game.hurt = !!(game.drag?.kind === 'lamp' && game.face && currentCount() !== 1);
  updateHurtGlow(dt);
  const look = levelFocus();
  if (!game.firstPerson) {
    look.lerp(controlledPosition(), level().focusFollow ?? 0.12);
    if (game.hintUntil > game.time && game.hintTarget) look.lerp(game.hintTarget, 0.18);
  }
  const view = currentView();
  if (game.firstPerson) {
    if (game.hintUntil > game.time && game.hintTarget) {
      const dx = game.hintTarget.x - player.position.x;
      const dy = game.hintTarget.y - (player.position.y + 1.22);
      const dz = game.hintTarget.z - player.position.z;
      const wantYaw = Math.atan2(-dx, -dz);
      const wantPitch = Math.max(-1.15, Math.min(1.15, Math.atan2(dy, Math.hypot(dx, dz) || 1)));
      let delta = wantYaw - game.lookYaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const k = 1 - Math.exp(-dt * 6);
      game.lookYaw += delta * k;
      game.lookPitch += (wantPitch - game.lookPitch) * k;
    }
    applyFirstPerson(app.camera, player.position, game.lookYaw, game.lookPitch);
    updateAim();
  } else if (game.intro > 0) {
    rigCamera(app.camera, look, view, game.intro);
  } else if (game.revealUntil > game.time) {
    springLook(app.camera, look, { ...view, dist: (view.dist ?? 16) * 0.82 }, dt);
  } else {
    springLook(app.camera, look, view, dt);
  }

  updateCoach();
  updateExposureUi();
  app.renderer.render(app.scene, app.camera);
}

fillGuideRules();
syncSettingsUi();
document.getElementById('lamp-pop-title').textContent = COPY.lampPopTitle;
document.getElementById('lamp-pop-hint').textContent = COPY.lampPopHint;
document.getElementById('lamp-left').textContent = COPY.lampLeft;
document.getElementById('lamp-right').textContent = COPY.lampRight;
document.getElementById('hands-lamp-title').textContent = COPY.handsLamp;
document.getElementById('hands-lamp-left').textContent = COPY.lampLeft;
document.getElementById('hands-lamp-right').textContent = COPY.lampRight;
document.getElementById('hands-lamp-next').textContent = COPY.handsLampNext;
document.getElementById('hands-crate-push').textContent = COPY.handsCratePush;
document.getElementById('hands-crate-pull').textContent = COPY.handsCratePull;
document.getElementById('hands-lever-toggle').textContent = COPY.handsLeverToggle;
document.getElementById('hands-pick-btn').textContent = COPY.handsPick;
player.visible = false;
openTitle();
document.body.dataset.ready = 'true';
requestAnimationFrame(() => {
  bootScreen?.classList.add('ready');
  setTimeout(() => bootScreen?.classList.add('hidden'), 420);
});
loop();
