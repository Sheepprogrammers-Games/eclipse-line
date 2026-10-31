import { lightCount } from './lights.js';
import { shadowPoseNearSwitch } from './shadow.js';

export function switchClosed(sw, extras = {}, world = null) {
  if (sw.kind === 'lever') return !!extras.levers?.[sw.id];
  if (sw.kind === 'plate') {
    if (extras.levers?.[sw.id]) return true;
    return extras.face?.boxId === sw.boxId;
  }
  if (sw.kind === 'lit') {
    if (extras.levers?.[sw.id]) return true;
    if (!world) return false;
    return lightCount(world, { boxId: sw.boxId, face: sw.face || '+y' }) === 1;
  }
  if (sw.kind === 'shadow') {
    if (sw.latch && extras.levers?.[sw.id]) return true;
    const pinned = extras.shadowCast;
    if (!sw.requiresPose && pinned?.shape
      && pinned.boxId === sw.boxId
      && (pinned.face || '+y') === (sw.face || '+y')) return true;
    if (extras.shadowPose && extras.shadowDetached !== false
      && (!sw.requiresDetached || extras.shadowPose.detached)
      && shadowPoseNearSwitch(
      extras.shadowPose,
      sw,
      world,
      extras.shadowRadius ?? 0.72
    )) return true;
    if (sw.requiresPose || !world) return false;
    return lightCount(world, { boxId: sw.boxId, face: sw.face || '+y' }) === 0;
  }
  return false;
}

export function closedSwitches(level, extras = {}, world = null) {
  const map = {};
  for (const sw of level.switches || []) {
    map[sw.id] = switchClosed(sw, extras, world);
  }
  return map;
}

export function lightPowered(power, closed) {
  if (power == null) return null;
  if (typeof power === 'string') return !!closed[power];
  if (Array.isArray(power.any)) return power.any.some(id => closed[id]);
  if (Array.isArray(power.all)) return power.all.every(id => closed[id]);
  return false;
}

export function circuitEnabled(level, closed, baseEnabled = {}) {
  const enabled = { ...baseEnabled };
  for (const light of level.lights || []) {
    if (light.power != null) enabled[light.id] = lightPowered(light.power, closed);
    const disabledBy = light.disabledBy ?? light.disableWhen;
    if (disabledBy != null && lightPowered(disabledBy, closed)) enabled[light.id] = false;
  }
  return enabled;
}
