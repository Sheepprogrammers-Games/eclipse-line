import { closedSwitches, circuitEnabled } from './circuit.js';

export function dirFromYawTilt(yaw = 0, tilt = 0) {
  return [
    Math.sin(yaw) * Math.sin(tilt),
    -Math.cos(tilt),
    Math.cos(yaw) * Math.sin(tilt)
  ];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(a) {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

export function reflectPoint(point, planePoint, normal) {
  const n = normalize(normal);
  return sub(point, scale(n, 2 * dot(sub(point, planePoint), n)));
}

export function reflectDir(direction, normal) {
  const n = normalize(normal);
  const d = normalize(direction);
  return sub(d, scale(n, 2 * dot(d, n)));
}

export function mirrorNormal(yaw) {
  return [Math.sin(yaw), 0, Math.cos(yaw)];
}

export function applyLightPose(light, time = 0, extras = {}) {
  const yawMap = extras.yaw || extras.yawOverrides || {};
  const enabledMap = extras.enabled || extras.yawOverrides?.enabled || {};
  let yaw = light.yaw || 0;
  if (yawMap[light.id] != null) yaw = yawMap[light.id];
  else if (light.rotate) yaw = (light.baseYaw || 0) + Math.max(0, time - (light.delay || 0)) * light.rotate;
  let tilt = light.tilt || 0;
  const view = extras.view;
  if (view && light.followView && !light.rotate && extras.viewSteer) {
    yaw += view.yawBias || 0;
    if (view.sunTilt != null) tilt = view.sunTilt;
  }
  const direction = dirFromYawTilt(yaw, tilt);
  const enabled = enabledMap[light.id] != null ? enabledMap[light.id] : light.enabled !== false;
  const origin = extras.lampPos?.[light.id]
    ? extras.lampPos[light.id].slice()
    : (light.origin || [0, 0, 0]).slice();
  return { ...light, yaw, tilt, direction, enabled, origin };
}

export function virtualFromMirror(parent, mirror) {
  const n = mirrorNormal(mirror.yaw || 0);
  const point = mirror.origin;
  const origin = reflectPoint(parent.origin, point, n);
  const direction = reflectDir(parent.direction, n);
  return {
    id: `${parent.id}->${mirror.id}`,
    type: 'virtual',
    origin,
    direction,
    angle: Math.min(parent.angle || Math.PI / 8, Math.PI / 12),
    range: (parent.range || 10) * 0.8,
    enabled: parent.enabled !== false,
    plane: { point, normal: n },
    skipBoxIds: parent.skipBoxIds,
    ignoreBoxIds: parent.ignoreBoxIds,
    onlyBoxIds: parent.onlyBoxIds
  };
}

function copyBox(box) {
  return { ...box, min: box.min.slice(), max: box.max.slice() };
}

export function resolveWorld(level, time = 0, extras = {}) {
  const crates = (level.crates || []).map(crate => {
    const posed = extras.cratePos?.[crate.id];
    return copyBox(posed || crate);
  });
  const shadowSource = Array.isArray(extras.shadows)
    ? extras.shadows
    : extras.shadows === false ? [] : (level.shadows || []);
  const shadows = shadowSource.map(copyBox);
  const boxes = [...level.boxes.map(copyBox), ...crates, ...shadows, ...(extras.extraBoxes || [])];
  const shadowMasks = Array.isArray(extras.shadowMasks)
    ? extras.shadowMasks.map(mask => ({
        ...mask,
        origin: mask.origin?.slice?.() || mask.origin,
        shape: mask.shape ? {
          ...mask.shape,
          start: mask.shape.start?.slice?.() || mask.shape.start,
          tip: mask.shape.tip?.slice?.() || mask.shape.tip,
          direction: mask.shape.direction?.slice?.() || mask.shape.direction,
          path: Array.isArray(mask.shape.path)
            ? mask.shape.path.map(point => point.slice())
            : null
        } : null
      }))
    : [];

  function pose(enabled) {
    const next = { ...extras, enabled };
    const posed = (level.lights || []).map(light => applyLightPose(light, time, next));
    const virtuals = [];
    for (const mirror of level.mirrors || []) {
      const parent = posed.find(item => item.id === (mirror.parent || posed[0]?.id));
      if (!parent || parent.enabled === false) continue;
      const yaw = extras.yaw?.[mirror.id] != null ? extras.yaw[mirror.id] : (mirror.yaw || 0);
      virtuals.push(virtualFromMirror(parent, { ...mirror, yaw }));
    }
    const lights = [...posed, ...virtuals];
    if (extras.lantern?.light) lights.push(extras.lantern.light);
    return lights;
  }

  const baseEnabled = extras.enabled || {};
  const closed1 = closedSwitches(level, extras, null);
  let enabled = circuitEnabled(level, closed1, baseEnabled);
  let lights = pose(enabled);
  let world = { boxes, lights, shadowMasks, walls: !!level.walls, crates, mirrors: level.mirrors || [], closed: closed1 };
  const closed2 = closedSwitches(level, extras, world);
  const enabled2 = circuitEnabled(level, closed2, baseEnabled);
  const changed = (level.lights || []).some(light => enabled[light.id] !== enabled2[light.id]);
  if (changed) {
    enabled = enabled2;
    lights = pose(enabled);
    world = { boxes, lights, shadowMasks, walls: !!level.walls, crates, mirrors: level.mirrors || [], closed: closed2 };
  } else {
    world.closed = closed2;
  }
  if (extras.lantern?.box) world.boxes = [...boxes, extras.lantern.box];
  return world;
}
